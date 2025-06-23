<template>
  <div class="p-6 max-w-6xl mx-auto">
    <h1 class="text-3xl font-bold mb-6">🖼 Image Scraper + Background Remover</h1>

    <input
      v-model="url"
      type="text"
      placeholder="Paste site URL"
      class="border px-4 py-2 w-full rounded mb-4"
    />

    <button @click="scrape" class="bg-blue-600 text-white px-4 py-2 rounded" :disabled="loading">
      {{ loading ? 'Scraping...' : 'Scrape Images' }}
    </button>

    <div v-if="images.length" class="mt-6">
      <div class="flex gap-4 mb-4">

        <button
            @click="selectAll"
            class="bg-gray-400 text-white px-3 py-2 rounded"
            >
            Select All
        </button>
        <button
            @click="deselectAll"
            class="bg-gray-400 text-white px-3 py-2 rounded"
            >
            Deselect All
        </button>

        <button
          @click="downloadAll(false)"
          class="bg-green-600 text-white px-4 py-2 rounded"
          :disabled="selectedImages.length === 0"
        >
          Download All (Originals)
        </button>
        <button
          @click="downloadAll(true)"
          class="bg-pink-600 text-white px-4 py-2 rounded"
          :disabled="selectedImages.length === 0"
        >
          Download All (Without BG)
        </button>
      </div>

      <p class="text-sm text-gray-600 mb-2">
        Selected: {{ selectedImages.length }} / {{ images.length }}
      </p>

      <div class="grid grid-cols-3 md:grid-cols-5 gap-4">
        <div
          v-for="img in images"
          :key="img"
          class="border p-2 rounded relative flex flex-col items-center"
        >
          <input
            type="checkbox"
            class="absolute top-2 left-2 w-4 h-4"
            :checked="selectedImages.includes(img)"
            @change="toggleImage(img)"
          />
          <img
            :src="result[img] || img"
            class="w-28 h-28 object-contain rounded"
          />
          <button
            class="mt-2 bg-purple-600 text-white px-2 py-1 text-xs rounded w-full"
            @click="removeBg(img)"
            :disabled="loadingMap[img] || !!result[img]"
          >
            {{ result[img] ? '✔ Cutout' : loadingMap[img] ? '…' : 'Remove BG' }}
          </button>

          <a
            v-if="!result[img]"
            :href="`/api/proxy-image?url=${encodeURIComponent(img)}`"
            class="mt-2 inline-block text-center bg-gray-600 text-white px-2 py-1 text-xs rounded w-full"
          >
            Download Original
          </a>

          <a
            v-if="result[img]"
            :href="result[img]"
            :download="getFilename(img, '-cutout')"
            class="mt-2 inline-block text-center bg-green-600 text-white px-2 py-1 text-xs rounded w-full"
          >
            Download Cutout
          </a>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import JSZip from 'jszip'
import { saveAs } from 'file-saver'

const url = ref('')
const images = ref([])
const result = ref({})
const selectedImages = ref([])
const loading = ref(false)
const loadingMap = reactive({})

function toggleImage(img) {
  if (selectedImages.value.includes(img)) {
    selectedImages.value = selectedImages.value.filter((i) => i !== img)
  } else {
    selectedImages.value.push(img)
  }
}

async function scrape() {
  loading.value = true
  result.value = {}
  selectedImages.value = []
  images.value = []
  try {
    const res = await $fetch('/api/scrape', { method: 'POST', body: { url: url.value } })
    images.value = res.slice(0, 20)
  } catch (err) {
    alert('Failed to scrape site')
    console.error(err)
  } finally {
    loading.value = false
  }
}

async function removeBg(imgUrl) {
  loadingMap[imgUrl] = true
  try {
    const blob = await $fetch('/api/remove', {
      method: 'POST',
      body: { imageUrl: imgUrl },
      responseType: 'blob'
    })
    result.value[imgUrl] = URL.createObjectURL(blob)
  } catch (err) {
    alert('Background removal failed')
    console.error(err)
  } finally {
    loadingMap[imgUrl] = false
  }
}

function getFilename(src, suffix = '') {
  try {
    const path = new URL(src).pathname
    const name = path.substring(path.lastIndexOf('/') + 1).replace(/\.[a-z]+$/, '')
    return `${name}${suffix}.png`
  } catch {
    return 'image.png'
  }
}

async function downloadAll(withoutBg = false) {
  const zip = new JSZip()
  const queue = [...selectedImages.value]

  for (const img of queue) {
    try {
      let blob
      let filename

      if (withoutBg) {
        if (!result.value[img]) {
          await removeBg(img)
        }

        const bgBlob = await fetch(result.value[img]).then((r) => r.blob())
        blob = bgBlob
        filename = getFilename(img, '-cutout')
      } else {
        const originalBlob = await $fetch('/api/proxy-image', {
          method: 'GET',
          query: { url: img },
          responseType: 'blob'
        })
        blob = originalBlob
        filename = getFilename(img)
      }

      zip.file(filename, blob)
    } catch (err) {
      console.error(`Failed to fetch ${withoutBg ? 'cutout' : 'original'} image:`, img, err)
    }
  }

  const content = await zip.generateAsync({ type: 'blob' })
  const zipName = withoutBg ? 'images-cutout.zip' : 'images-original.zip'
  saveAs(content, zipName)
}

function selectAll() {
  selectedImages.value = [...images.value]
}

function deselectAll() {
  selectedImages.value = []
}

</script>
