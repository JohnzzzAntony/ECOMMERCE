// Catalogue export (.xlsx / .csv) and import with preview. Logic lives in lib/product-sheet.ts.
import { NextResponse } from 'next/server'
import { failure, HttpError, requireAdmin } from '@/backend/lib/auth'
import { applyImport, exportColumns, exportRows, instructionRows, loadCatalog, planImport } from '@/backend/lib/product-sheet'
import { readSpreadsheet, toCsv, toXlsx } from '@/backend/lib/spreadsheet'
import { invalidateAll } from '@/backend/lib/memo'

const MAX_BYTES = 10 * 1024 * 1024

// GET /api/admin/products/export?format=xlsx|csv[&template=1]
export async function exportCatalog(request: Request) {
  try {
    await requireAdmin(request)
    const params = new URL(request.url).searchParams
    const format = params.get('format') === 'csv' ? 'csv' : 'xlsx'
    const template = params.get('template') === '1'
    const catalog = await loadCatalog()
    const columns = exportColumns(catalog)
    const rows = template ? [] : exportRows(catalog)
    const stamp = new Date().toISOString().slice(0, 10)
    const filename = `${template ? 'product-import-template' : `products-${stamp}`}.${format}`

    const body = format === 'csv'
      ? toCsv(columns, rows)
      : await toXlsx([
        { name: 'Products', columns, rows },
        { name: 'Instructions', columns: [{ header: 'Topic', width: 34 }, { header: 'Details', width: 110 }], rows: instructionRows(catalog) },
      ])
    return new NextResponse(body, {
      headers: {
        'Content-Type': format === 'csv' ? 'text/csv; charset=utf-8' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) { return failure(error) }
}

// POST /api/admin/products/import  (multipart: file, dryRun=true|false)
export async function importCatalog(request: Request) {
  try {
    await requireAdmin(request)
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File) || file.size === 0) throw new HttpError(400, 'Choose a .xlsx or .csv file')
    if (file.size > MAX_BYTES) throw new HttpError(400, 'File must be 10 MB or smaller')
    const dryRun = form.get('dryRun') !== 'false'

    const grid = await readSpreadsheet(file)
    const catalog = await loadCatalog()
    const result = await applyImport(planImport(grid, catalog), catalog, dryRun)
    if (!dryRun) invalidateAll()
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return failure(error) }
}
