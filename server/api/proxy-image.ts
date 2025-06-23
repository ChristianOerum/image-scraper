import { getQuery, send } from 'h3'

export default defineEventHandler(async (event) => {
  const { url } = getQuery(event)

  if (!url || typeof url !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Missing image URL' })
  }

  const response = await fetch(url)
  const buffer = await response.arrayBuffer()

  event.node.res.setHeader('Content-Type', response.headers.get('content-type') || 'application/octet-stream')
  event.node.res.setHeader('Content-Disposition', `attachment; filename="${url.split('/').pop()}"`)

  return send(event, Buffer.from(buffer))
})
