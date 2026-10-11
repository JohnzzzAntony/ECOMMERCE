// Categories form a tree of any depth (parentId). Imports create deep paths such as
// "Health & Beauty > Personal Care > Perfumes"; the storefront browses and filters by any node.
import { db } from './db'
import { memo } from './memo'

type Row = { id: string; parentId: string | null; _count?: { products: number } }
export type TreeNode<T extends Row> = Omit<T, '_count'> & { children: TreeNode<T>[]; _count: { products: number } }

/** Nest flat rows; product counts include all descendants. Orphans (inactive parent) become roots. */
export function categoryTree<T extends Row>(rows: T[]): TreeNode<T>[] {
  const nodes = new Map<string, TreeNode<T>>(rows.map((r) => [r.id, { ...r, children: [], _count: { products: r._count?.products ?? 0 } }]))
  const roots: TreeNode<T>[] = []
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined
    if (parent) parent.children.push(node)
    else roots.push(node)
  }
  const total = (n: TreeNode<T>, seen = new Set<string>()): number => {
    if (seen.has(n.id)) return 0
    seen.add(n.id)
    n._count.products += n.children.reduce((sum, c) => sum + total(c, seen), 0)
    return n._count.products
  }
  roots.forEach((r) => total(r))
  return roots
}

/** IDs of the category with this slug and all its descendants (empty if unknown). */
export async function categoryWithDescendants(slug: string): Promise<string[]> {
  const all = await memo('catalog:category-links', () => db.category.findMany({ select: { id: true, slug: true, parentId: true } }))
  const start = all.find((c) => c.slug === slug)
  if (!start) return []
  const ids = new Set([start.id])
  for (let grew = true; grew;) {
    grew = false
    for (const c of all) if (c.parentId && ids.has(c.parentId) && !ids.has(c.id)) { ids.add(c.id); grew = true }
  }
  return [...ids]
}
