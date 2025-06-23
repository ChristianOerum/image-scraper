import { readBody, setHeader, createError } from 'h3'
import { removeBackground } from '@imgly/background-removal-node'

export default defineEventHandler(async (event) => {
  const { imageUrl } = await readBody(event)

  if (!imageUrl) {
    throw createError({ statusCode: 400, statusMessage: 'Missing imageUrl' })
  }

  try {
    const blob = await removeBackground(imageUrl)
    const arrayBuffer = await blob.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    setHeader(event, 'Content-Type', 'image/png')
    return buffer
  } catch (err) {
    console.error('Background removal failed:', err)
    throw createError({ statusCode: 500, statusMessage: 'Background removal failed' })
  }
})
