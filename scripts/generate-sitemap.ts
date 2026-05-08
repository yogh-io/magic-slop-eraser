/**
 * Emits public/sitemap.xml from the static routes plus every catalogue entry.
 * Run before vite-ssg build.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { patterns } from '../src/catalog/patterns'
import { categories } from '../src/catalog/categories'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ORIGIN = 'https://magicsloperaser.com'

interface Entry {
  loc: string
  changefreq: string
  priority: string
}

const entries: Entry[] = [
  { loc: '/', changefreq: 'monthly', priority: '0.8' },
  { loc: '/about', changefreq: 'monthly', priority: '0.9' },
  { loc: '/rungs', changefreq: 'monthly', priority: '0.9' },
  { loc: '/categories', changefreq: 'weekly', priority: '0.9' },
  { loc: '/skill/eraser', changefreq: 'monthly', priority: '0.7' },
]

for (const c of categories) {
  entries.push({ loc: `/categories/${c.id}`, changefreq: 'monthly', priority: '0.7' })
}
for (const p of patterns) {
  entries.push({ loc: `/patterns/${p.id}`, changefreq: 'monthly', priority: '0.6' })
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    (e) => `  <url>
    <loc>${ORIGIN}${e.loc}</loc>
    <changefreq>${e.changefreq}</changefreq>
    <priority>${e.priority}</priority>
  </url>`,
  )
  .join('\n')}
</urlset>
`

const outDir = resolve(__dirname, '../public')
mkdirSync(outDir, { recursive: true })
writeFileSync(resolve(outDir, 'sitemap.xml'), xml)
console.log(`generate-sitemap: wrote ${entries.length} URLs`)

// Also emit a robots.txt that points at the sitemap.
const robots = `User-agent: *
Allow: /
Disallow: /d/

Sitemap: ${ORIGIN}/sitemap.xml
`
writeFileSync(resolve(outDir, 'robots.txt'), robots)
console.log('generate-sitemap: wrote robots.txt')
