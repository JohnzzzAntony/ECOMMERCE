// AI try-on: garment types the try-on model understands, and a best guess from the product's name and category.
// The shopper can always change the guess; accessories are not supported by the model.

export const TRY_ON_CATEGORIES = ['tops', 'bottoms', 'one-pieces'] as const
export type TryOnCategory = (typeof TRY_ON_CATEGORIES)[number]

export const TRY_ON_LABELS: Record<TryOnCategory, string> = {
  tops: 'Top (shirt, jacket, sweater)',
  bottoms: 'Bottom (trousers, skirt, shorts)',
  'one-pieces': 'Full outfit (dress, jumpsuit)',
}

// Checked in this order: accessories first (so "denim cap" is not read as clothing), then one-pieces before tops ("shirt dress").
const RULES: [TryOnCategory | 'accessory', RegExp][] = [
  ['accessory', /\b(sun ?glass(es)?|eyeglass(es)?|glasses|eyewear|goggles?|caps?(?![ -]?sleeve)|hats?|beanies?|helmets?|watch(es)?|jewell?ery|necklaces?|earrings?|bracelets?|rings?|bags?|handbags?|backpacks?|wallets?|belts?|scarf|scarves|gloves?|socks?|shoes?|sneakers?|boots?|sandals?|heels|slippers?|neckties?|bow ties?|headbands?)\b/i],
  ['one-pieces', /\b(dress(es)?|gowns?|jumpsuits?|rompers?|overalls?|abayas?|kaftans?|caftans?|jalabiyas?|kandoras?|sarees?|saris?|onesies?|playsuits?|co-?ords?|suits?)\b/i],
  ['bottoms', /\b(trousers?|pants|jeans|shorts|skirts?|leggings?|joggers?|chinos?|culottes?|sweatpants)\b/i],
  ['tops', /\b(shirts?|t-?shirts?|tees?|tops?|blouses?|sweaters?|jumpers?|hoodies?|sweatshirts?|jackets?|coats?|blazers?|cardigans?|vests?|polos?|tunics?|kurtas?|tanks?|camis?|crop)\b/i],
]

/** Best guess of what a product is, from its name then its category names; null when nothing matches. */
export function guessTryOnKind(...texts: (string | null | undefined)[]): TryOnCategory | 'accessory' | null {
  for (const text of texts) {
    if (!text) continue
    for (const [kind, re] of RULES) if (re.test(text)) return kind
  }
  return null
}
