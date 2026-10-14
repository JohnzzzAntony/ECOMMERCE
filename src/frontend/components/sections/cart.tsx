import { Container, Heading, SectionShell, settingsOf, type SectionProps } from './shared'
import { CartContents } from './commerce-client'

export default function Cart({ section, page }: SectionProps) {
  const s = settingsOf<{ title: string; headingLevel: string; emptyMessage: string; checkoutLabel: string }>(section)
  return (
    <SectionShell section={section}>
      <Container section={section} className="space-y-8">
        {s.title && <Heading level={s.headingLevel} className="text-3xl md:text-4xl">{s.title}</Heading>}
        <CartContents emptyMessage={s.emptyMessage} checkoutLabel={s.checkoutLabel} currency={page.currency} />
      </Container>
    </SectionShell>
  )
}
