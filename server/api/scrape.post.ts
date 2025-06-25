// /server/api/scrape.ts
import { readBody, createError } from 'h3'
import * as cheerio from 'cheerio'
import { chromium } from 'playwright'   //  npm i playwright

export default defineEventHandler(async (event) => {
  const { url, dynamic = false } = await readBody(event)
  if (!url) throw createError({ statusCode: 400, statusMessage: 'Missing URL' })

  // ---------- 1. quick static pass ---------- //
  const baseHTML = await $fetch<string>(url)      // same as node-fetch
  const staticImgs = extractFromHTML(baseHTML, url)
  if (staticImgs.length && !dynamic) return staticImgs   // success, done

  // ---------- 2. JS-aware pass with Playwright ---------- //
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ bypassCSP: true })
    await page.goto(url, { waitUntil: 'networkidle' })  // wait for JS / lazy imgs
    await autoScroll(page)                              // make sure lazy imgs load

    const dynamicImgs: string[] = await page.evaluate(() => {
      /* runs in the browser context */
      const urls = new Set<string>()

      // <img> tags
      document.querySelectorAll<HTMLImageElement>('img').forEach(img =>
        urls.add(img.currentSrc || img.src || img.dataset.src || '')
      )

      // <source srcset> inside <picture>
      document.querySelectorAll<HTMLSourceElement>('source[srcset]').forEach(src => {
        src.srcset.split(',').forEach(candidate => {
          const [u] = candidate.trim().split(/\s+/)
          if (u) urls.add(u)
        })
      })

      return Array.from(urls).filter(Boolean)
    })

    return dynamicImgs
  } catch (err) {
    console.error(err)
    throw createError({ statusCode: 500, statusMessage: 'Scraping failed' })
  } finally {
    await browser.close()
  }
})

/* ---------- helpers ---------- */
function extractFromHTML(html: string, base: string) {
  const $ = cheerio.load(html)
  const urls = $('img, source[srcset]')
    .map((_i, el) => {
      if (el.tagName === 'source') return $(el).attr('srcset')?.split(',')[0]?.trim()
      return $(el).attr('src') || $(el).attr('data-src')
    })
    .get()
    .map(src => new URL(src, base).href)               // make absolute
    .filter(u => /^https?:\/\//.test(u))
  return Array.from(new Set(urls))
}

/* naïve autoscroll to trigger lazy-loading */
async function autoScroll(page, step = 600, delay = 60) {
  await page.evaluate(
    async ({ step, delay }) => {
      await new Promise<void>(resolve => {
        let y = 0
        const scroll = () => {
          y += step
          window.scrollTo(0, y)
          if (y < document.body.scrollHeight) {
            setTimeout(scroll, delay)
          } else {
            window.scrollTo(0, 0)
            resolve()
          }
        }
        scroll()
      })
    },
    { step, delay }
  )
}
