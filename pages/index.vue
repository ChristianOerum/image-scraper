<template>
  <div class="bg-background w-screen h-screen flex items-center justify-center font-railway">
    <a href="https://github.com/ChristianOerum" class="absolute bottom-4 text-primary/[0.2]">Developed by @ChristianOerum</a>
    <div class="p-6 max-w-6xl mx-auto">

      <div v-if="!images.length" class="flex flex-col items-center mb-20">
        <Icon name="fluent:image-sparkle-16-regular" class="text-primary/[0.2] text-[96px] mb-4" />
        <h1 class="text-3xl text-text font-bold mb-6 font-railway text-center">Image Scraper + Background Remover</h1>

        <div class="w-full h-auto flex gap-2 relative">

          <input
            v-model="url"
            type="text"
            placeholder="Paste site URL"
            class="border-3 border-text focus:outline-4 focus:outline-accent/[0.2] outline-offset-2 text-text/[0.7] px-4 py-3 w-full rounded-xl"
            @keyup.enter="scrape"
          />

          <button @click="scrape" class="bg-accent/[0.2] text-accent px-4 py-2 rounded-md col-span-1 absolute right-[7px] top-[7px]" :disabled="loading">
            {{ loading ? 'Scraping...' : 'Scrape Images' }}
          </button>

        </div>

      </div>

      <TransitionGroup name="fade" tag="div" class="">
      <div v-if="images.length" class="mt-6">
        <div class="flex gap-2 mb-4">

          <button
              @click="selectAll"
              class="bg-text text-background px-3 py-2 rounded"
              >
              Select All
          </button>
          <button
              @click="deselectAll"
              class="bg-text text-background px-3 py-2 rounded"
              >
              Deselect All
          </button>

          <button
            @click="downloadAll(false)"
            class="bg-accent text-white px-4 py-2 rounded"
            :disabled="selectedImages.length === 0"
          >
            Download selected (Originals)
          </button>
          <button
            @click="downloadAll(true)"
            class="bg-accent text-white px-4 py-2 rounded"
            :disabled="selectedImages.length === 0"
          >
            Download selected (Without BG)
          </button>
        </div>

        <p class="text-sm text-text mb-2">
          Selected: {{ selectedImages.length }} / {{ images.length }}
        </p>

        <div class="grid grid-cols-3 md:grid-cols-5 gap-4">
          <div
            v-for="img in images"
            :key="img"
            class="p-2 bg-primary/[0.1] rounded-md relative flex flex-col items-center border-[1px] border-secondary/[0.6]"
            @click="toggleImage(img)"
          >

            <Transition name="fadecheck" tag="div" class="">
              <div v-if="selectedImages.includes(img)" class="w-fit h-auto absolute top-0 left-0 flex items-center justify-center p-1">
                <Icon name="heroicons:check-circle" class="text-primary text-[24px]" />
              </div>
            </Transition>
            
            <img
              :src="result[img] || img"
              class="w-28 h-28 object-contain rounded-md"
            />
            <button v-if="!result[img]"
              class="mt-1 bg-accent/[0.2] text-accent px-2 py-1 text-xs rounded-md w-full"
              @click="removeBg(img), $event.stopPropagation()"
              :disabled="loadingMap[img] || !!result[img]"
            >
              {{ result[img] ? '✔' : loadingMap[img] ? '…' : 'Remove BG' }}
            </button>

            <a
              v-if="!result[img]"
              :href="`/api/proxy-image?url=${encodeURIComponent(img)}`"
              class="mt-1 inline-block text-center bg-accent/[0.2] text-accent px-2 py-1 text-xs rounded-md w-full opacity-50"
              @click="$event.stopPropagation()"
            >
              Download Original
            </a>

            <a
              v-if="result[img]"
              :href="result[img]"
              :download="getFilename(img, '-cutout')"
              class="mt-1 inline-block text-center bg-accent/[0.2] text-accent px-2 py-1 text-xs rounded-md w-full"
              @click="$event.stopPropagation()"
            >
              Download
            </a>
          </div>
        </div>
      </div>
      </TransitionGroup>
      
    </div>
  </div>
</template>

<script setup>
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { vAutoAnimate } from '@formkit/auto-animate'

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

  console.log(selectedImages.value)
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

<style scoped>
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.5s ease, transform 0.5s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
.fade-enter-to, .fade-leave-from {
  opacity: 1;
  transform: scale(1);
}

.fadecheck-enter-active, .fadecheck-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.fadecheck-enter-from, .fadecheck-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
.fadecheck-enter-to, .fadecheck-leave-from {
  opacity: 1;
  transform: scale(1);
}

</style>