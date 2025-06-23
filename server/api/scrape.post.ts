import { readBody, createError } from 'h3'
import * as cheerio from 'cheerio'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const pageUrl = body?.url

  if (!pageUrl) {
    throw createError({ statusCode: 400, statusMessage: 'Missing URL' })
  }

  try {
    const res = await fetch(pageUrl)
    if (!res.ok) throw new Error(`Failed to fetch: ${res.statusText}`)
    const html = await res.text()
    const $ = cheerio.load(html)

    const imageUrls = $('img')
      .map((_, img) => $(img).attr('src') || $(img).attr('data-src') || '')
      .get()
      .filter((src) => src.startsWith('http'))

    return imageUrls
  } catch (err) {
    console.error('Scraping failed:', err)
    throw createError({ statusCode: 500, statusMessage: 'Scraping failed' })
  }
})
