import { categories } from '../../src/catalog/categories'
import { patterns } from '../../src/catalog/patterns'
import { json } from '../shared'

export function handleCatalogue(): Response {
  return json({ categories, patterns })
}
