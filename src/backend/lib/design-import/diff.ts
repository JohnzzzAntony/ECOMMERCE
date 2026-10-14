// Re-sync diff: compares a fresh import with the store's current pages by Figma node id, and applies the
// admin's per-section decisions. Fields listed in a section's overriddenFields keep the admin's value unless the
// admin explicitly accepts the Figma value for that field. Pure: no I/O.
import type { DesignTokens } from '@/shared/design-tokens'
import type { SectionInstance } from '@/shared/sections/registry'

export type FieldChange = { field: string; overridden: boolean }
export type SectionChange =
  | { kind: 'added'; key: string; section: SectionInstance; index: number }
  | { kind: 'removed'; key: string; section: SectionInstance }
  | { kind: 'changed'; key: string; before: SectionInstance; after: SectionInstance; fields: FieldChange[] }
export type PageDiff = { pageKey: string; title: string; changes: SectionChange[] }
export type TokenDiff = { group: string; name: string; before?: unknown; after?: unknown }[]

const keyOf = (s: SectionInstance) => s.figmaNodeId ?? `local:${s.id}`
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** Settings keys (plus "blocks" and "type") whose Figma value changed. */
export function changedFields(before: SectionInstance, after: SectionInstance): FieldChange[] {
  const out: FieldChange[] = []
  if (before.type !== after.type) out.push({ field: 'type', overridden: before.overriddenFields.includes('type') })
  const keys = new Set([...Object.keys(before.settings), ...Object.keys(after.settings)])
  for (const k of keys) if (!same(before.settings[k], after.settings[k])) out.push({ field: k, overridden: before.overriddenFields.includes(k) })
  if (!same(before.blocks.map((b) => b.settings), after.blocks.map((b) => b.settings))) out.push({ field: 'blocks', overridden: before.overriddenFields.includes('blocks') })
  return out
}

/** Only Figma-sourced sections take part; sections an admin added in the editor are never touched. */
export function diffSections(current: SectionInstance[], incoming: SectionInstance[]): SectionChange[] {
  const changes: SectionChange[] = []
  const currentByKey = new Map(current.filter((s) => s.figmaNodeId).map((s) => [keyOf(s), s]))
  const incomingKeys = new Set(incoming.filter((s) => s.figmaNodeId).map(keyOf))
  incoming.forEach((s, index) => {
    if (!s.figmaNodeId) return
    const before = currentByKey.get(keyOf(s))
    if (!before) { changes.push({ kind: 'added', key: keyOf(s), section: s, index }); return }
    const fields = changedFields(before, s)
    if (fields.length) changes.push({ kind: 'changed', key: keyOf(s), before, after: s, fields })
  })
  for (const s of current) if (s.figmaNodeId && !incomingKeys.has(keyOf(s))) changes.push({ kind: 'removed', key: keyOf(s), section: s })
  return changes
}

export type Decision = { accept: boolean; acceptOverridden?: string[] }

/** New section list: current sections with accepted changes applied; rejected changes leave things as they are. */
export function applyDecisions(current: SectionInstance[], changes: SectionChange[], decisions: Record<string, Decision>): SectionInstance[] {
  let out = current.map((s) => ({ ...s, settings: { ...s.settings }, blocks: [...s.blocks] }))
  for (const change of changes) {
    const d = decisions[change.key]
    if (!d?.accept) continue
    if (change.kind === 'removed') out = out.filter((s) => keyOf(s) !== change.key)
    else if (change.kind === 'added') out.splice(Math.min(change.index, out.length), 0, { ...change.section, overriddenFields: [] })
    else {
      const i = out.findIndex((s) => keyOf(s) === change.key)
      if (i < 0) continue
      const before = out[i]
      const accepted = new Set(d.acceptOverridden ?? [])
      const keep = (field: string) => before.overriddenFields.includes(field) && !accepted.has(field)
      const typeChanges = change.fields.some((f) => f.field === 'type') && !keep('type')
      const settings: Record<string, unknown> = typeChanges ? { ...change.after.settings } : { ...before.settings }
      for (const f of change.fields) {
        if (f.field === 'type' || f.field === 'blocks') continue
        if (keep(f.field)) settings[f.field] = before.settings[f.field]
        else if (!typeChanges) settings[f.field] = change.after.settings[f.field]
      }
      out[i] = {
        ...before,
        type: typeChanges ? change.after.type : before.type,
        settings,
        blocks: keep('blocks') ? before.blocks : change.after.blocks,
        responsive: change.after.responsive,
        overriddenFields: before.overriddenFields.filter((f) => !accepted.has(f)),
        mappingConfidence: change.after.mappingConfidence,
      }
    }
  }
  return out
}

export function diffTokens(before: DesignTokens, after: DesignTokens): TokenDiff {
  const out: TokenDiff = []
  const named = (group: string, a: { name: string }[], b: { name: string }[]) => {
    const am = new Map(a.map((x) => [x.name, x])), bm = new Map(b.map((x) => [x.name, x]))
    for (const [name, v] of bm) if (!am.has(name) || !same(am.get(name), v)) out.push({ group, name, before: am.get(name), after: v })
    for (const [name, v] of am) if (!bm.has(name)) out.push({ group, name, before: v })
  }
  named('colors', before.colors.map((c) => ({ ...c, usage: 0 })), after.colors.map((c) => ({ ...c, usage: 0 })))
  named('typography', before.typography, after.typography)
  named('shadows', before.shadows, after.shadows)
  for (const k of ['spacing', 'radius', 'breakpoints', 'container', 'fonts'] as const) if (!same(before[k], after[k])) out.push({ group: k, name: k, before: before[k], after: after[k] })
  return out
}
