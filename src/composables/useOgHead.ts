import { computed, type ComputedRef, type MaybeRefOrGetter, toValue } from 'vue'
import { useHead } from '@unhead/vue'

const SITE_NAME = 'Magic Slop Eraser'
const SITE_TAGLINE = 'AI slop detector and guided fixer'
const ORIGIN = 'https://slopmop.io'

export interface PageMeta {
  title: string
  description: string
  /** Path without origin, leading slash. e.g. "/rungs" or "/patterns/closers". */
  path: string
  /** og:type. Defaults to 'website'. Use 'article' for content pages. */
  ogType?: 'website' | 'article'
  /** Optional path to an OG image (relative to ORIGIN). */
  ogImage?: string
  /** ISO date string for article pages. */
  date?: string
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '')
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s
  return s.slice(0, n - 1).trimEnd() + '…'
}

/**
 * Sets the page <head> for SEO and link previews. Title, canonical URL,
 * description, OG and Twitter tags, and a JSON-LD blob.
 *
 * Pass either a static PageMeta or a computed/getter for reactive cases
 * (e.g. param-driven pages).
 */
export function useOgHead(data: MaybeRefOrGetter<PageMeta | null>): void {
  const meta: ComputedRef<PageMeta | null> = computed(() => toValue(data))
  useHead(
    computed(() => {
      const d = meta.value
      if (!d) return {}
      const description = truncate(stripHtml(d.description), 200)
      const url = `${ORIGIN}${d.path}`
      const image = d.ogImage ? `${ORIGIN}${d.ogImage}` : undefined
      const ogType = d.ogType ?? 'website'

      const metaTags = [
        { name: 'description', content: description },
        { property: 'og:type', content: ogType },
        { property: 'og:title', content: d.title },
        { property: 'og:description', content: description },
        { property: 'og:url', content: url },
        { property: 'og:site_name', content: SITE_NAME },
        ...(image
          ? [
              { property: 'og:image', content: image },
              { property: 'og:image:width', content: '1200' },
              { property: 'og:image:height', content: '630' },
            ]
          : []),
        { name: 'twitter:card', content: image ? 'summary_large_image' : 'summary' },
        { name: 'twitter:title', content: d.title },
        { name: 'twitter:description', content: description },
        ...(image ? [{ name: 'twitter:image', content: image }] : []),
      ]

      const jsonLd = {
        '@context': 'https://schema.org',
        '@type': ogType === 'article' ? 'Article' : 'WebSite',
        name: d.title,
        url,
        description,
        ...(d.date && ogType === 'article' ? { datePublished: d.date } : {}),
        ...(ogType === 'website'
          ? { publisher: { '@type': 'Organization', name: SITE_NAME, description: SITE_TAGLINE } }
          : {
              author: { '@type': 'Organization', name: SITE_NAME },
              publisher: { '@type': 'Organization', name: SITE_NAME },
            }),
      }

      const fullTitle = d.title === SITE_NAME ? SITE_NAME : `${d.title} · ${SITE_NAME}`
      return {
        title: fullTitle,
        link: [{ rel: 'canonical', href: url }],
        meta: metaTags,
        script: [{ type: 'application/ld+json', innerHTML: JSON.stringify(jsonLd) }],
      }
    }),
  )
}

export { SITE_NAME, ORIGIN }
