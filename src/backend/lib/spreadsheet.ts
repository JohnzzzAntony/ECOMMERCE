// Read/write tabular files (.xlsx via exceljs, .csv by hand) as plain string grids.
import ExcelJS from 'exceljs'
import { HttpError } from './auth'

export type Grid = string[][]

// ─── Reading ──────────────────────────────────────────────────────────────

/** Excel cell value → trimmed string. Handles rich text, formulas, hyperlinks and dates. */
function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object') {
    if ('richText' in value) return value.richText.map((r) => r.text).join('')
    if ('formula' in value || 'sharedFormula' in value) return cellText((value as ExcelJS.CellFormulaValue).result as ExcelJS.CellValue)
    if ('hyperlink' in value) return String((value as ExcelJS.CellHyperlinkValue).text ?? '')
    if ('error' in value) return ''
  }
  return String(value)
}

async function readXlsx(buffer: ArrayBuffer): Promise<Grid> {
  const workbook = new ExcelJS.Workbook()
  try {
    await workbook.xlsx.load(buffer)
  } catch {
    throw new HttpError(400, 'Could not read the Excel file. Save it as .xlsx and try again.')
  }
  // Prefer a sheet called "Products" (our export), otherwise the first sheet.
  const sheet = workbook.worksheets.find((s) => s.name.trim().toLowerCase() === 'products') ?? workbook.worksheets[0]
  if (!sheet) throw new HttpError(400, 'The workbook has no sheets')
  const grid: Grid = []
  sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const cells: string[] = []
    for (let c = 1; c <= sheet.columnCount; c++) cells.push(cellText(row.getCell(c).value).trim())
    grid[rowNumber - 1] = cells
  })
  return Array.from(grid, (r) => r ?? [])
}

/** RFC 4180 CSV parser. Auto-detects comma vs semicolon (Excel in some locales uses ';'). */
export function parseCsv(text: string): Grid {
  text = text.replace(/^﻿/, '')
  const firstLine = text.slice(0, text.search(/\r?\n|$/))
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ','
  const rows: Grid = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (ch === '"') quoted = false
      else field += ch
    } else if (ch === '"' && field === '') quoted = true
    else if (ch === delimiter) { row.push(field); field = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field); rows.push(row); row = []; field = ''
    } else field += ch
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row) }
  return rows.map((r) => r.map((v) => v.trim()))
}

export async function readSpreadsheet(file: File): Promise<Grid> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.csv') || file.type === 'text/csv') return parseCsv(await file.text())
  if (name.endsWith('.xlsx')) return readXlsx(await file.arrayBuffer())
  if (name.endsWith('.xls')) throw new HttpError(400, 'Old .xls files are not supported. In Excel choose File → Save As → .xlsx')
  throw new HttpError(400, 'Upload a .xlsx or .csv file')
}

// ─── Writing ──────────────────────────────────────────────────────────────

export interface SheetColumn { header: string; width?: number; readOnly?: boolean; required?: boolean }
type Cell = string | number | boolean | null

// Text starting with = + - @ would run as a formula when the CSV is opened in Excel; a leading
// apostrophe neutralises it (the importer strips it again, see product-sheet.ts).
const csvCell = (v: Cell) => {
  const s = v === null ? '' : typeof v === 'string' && /^[=+\-@]/.test(v) ? `'${v}` : String(v)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** UTF-8 with BOM so Excel shows Arabic and other non-Latin text correctly. */
export function toCsv(columns: SheetColumn[], rows: Cell[][]): string {
  return '﻿' + [columns.map((c) => csvCell(c.header)), ...rows.map((r) => r.map(csvCell))].map((r) => r.join(',')).join('\r\n')
}

export async function toXlsx(sheets: { name: string; columns: SheetColumn[]; rows: Cell[][] }[]): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.created = new Date()
  for (const s of sheets) {
    const sheet = workbook.addWorksheet(s.name, { views: [{ state: 'frozen', ySplit: 1 }] })
    sheet.columns = s.columns.map((c) => ({ header: c.header, width: c.width ?? 18 }))
    s.rows.forEach((r) => sheet.addRow(r))
    const header = sheet.getRow(1)
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    header.alignment = { vertical: 'middle' }
    s.columns.forEach((c, i) => {
      header.getCell(i + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: c.readOnly ? 'FF94A3B8' : c.required ? 'FF0D6B8C' : 'FF1A1A2E' } }
    })
  }
  return workbook.xlsx.writeBuffer() as Promise<ArrayBuffer>
}
