<template>
  <div class="bg-background w-screen h-screen flex items-center justify-center font-primary text-md">
    <a href="https://github.com/ChristianOerum" class="absolute bottom-4 text-primary/[0.2]">Developed by @ChristianOerum</a>
    <div class="p-6 max-w-6xl mx-auto">
      
    <Transition name="fade" tag="div" class="" mode="out-in">
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

      <div v-else-if="images.length" class="">

        <div class="flex gap-2 items-center mb-4">

          <button
              @click="resetScraper"
              class="bg-accent/[0.2] text-accent px-3 py-2 rounded"
              >
              Scrape a new site
          </button>

          <p v-if="scrapedSite"
            class="text-sm text-text">
            Current images scraped from
            <a :href="url"
              target="_blank"
              rel="noopener"
              class="underline font-semibold">
              {{ scrapedSite }}
            </a>
          </p>

        </div>

        <div class="flex gap-2 mb-4">

          <button
              @click="selectAll"
              class="bg-text text-background px-3 py-2 rounded text-sm"
              >
              Select All
          </button>
          <button
              @click="deselectAll"
              class="bg-text text-background px-3 py-2 rounded text-sm"
              >
              Deselect All
          </button>

          <button
            @click="downloadAll(false)"
            class="bg-accent text-white px-4 py-2 rounded text-sm"
            :disabled="selectedImages.length === 0"
          >
            Download selected (Originals)
          </button>
          <button
            @click="downloadAll(true)"
            class="bg-accent text-white px-4 py-2 rounded text-sm"
            :disabled="selectedImages.length === 0"
          >
            Download selected (Without BG)
          </button>
        </div>

        <p class="text-sm text-text mb-2 text-md">
          Selected: {{ selectedImages.length }} / {{ images.length }}
        </p>

        <div v-if="fileTypes.length" class="flex flex-wrap gap-2 items-center mb-4 text-md">
        <span class="text-sm text-text mr-1 text-md">Filter by filetype</span>

        <button
          v-for="type in fileTypes"
          :key="type"
          @click="toggleType(type)"
          :class="[
            'px-3 py-1 rounded-md border text-xs uppercase',
            selectedTypes.has(type)
              ? 'bg-text text-background border-text'
              : 'bg-transparent text-text border-text/[0.4]'
          ]"
        >
          {{ type }}
        </button>

        <button
          v-if="selectedTypes.size"
          @click="clearFilter"
          class="ml-2 underline text-xs text-accent/[0.7]"
        >
          Clear
        </button>
        </div>

        <div class="scroll-window h-[65vh] overflow-y-auto pr-1">
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

            <span
              class="absolute top-1 right-1 bg-background/70 backdrop-blur
                    border border-secondary/[0.4] rounded px-[4px] py-[2px]
                    text-[10px] uppercase text-text/[0.65]"
            >
              {{ getExt(img) }}
            </span>
            
            <img
              :src="result[img] || img"
              class="w-28 h-28 object-contain rounded-md"
            />
            <button
              v-if="!result[img]"
              class="mt-1 bg-accent/[0.2] text-accent px-2 py-1 text-xs rounded-md w-full"
              @click="removeBg(img); $event.stopPropagation()"
              :disabled="loadingMap[img] || !!result[img] || isSvg(img)"
            >
              {{ isSvg(img) ? 'SVG – Not supported' : result[img] ? '✔' : loadingMap[img] ? '…' : 'Remove BG' }}
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
      </div>  
      </Transition>  
    </div>
  </div>
</template>

<script setup>
import JSZip from 'jszip'
import { saveAs } from 'file-saver'

useHead({
  title: 'Image Scraper + Background Remover'
})

function toggleType(t) {
  selectedTypes.value.has(t)
    ? selectedTypes.value.delete(t)
    : selectedTypes.value.add(t)
}
function clearFilter() {
  selectedTypes.value.clear()
}

function getExt(src) {
  try {
    return new URL(src).pathname.split('.').pop().split(/[?#]/)[0].toLowerCase()
  } catch {
    return ''
  }
}

function isSvg(src) {
  return getExt(src) === 'svg'
}


const url            = ref('')
const scrapedSite   = ref('')
const allImages      = ref([])              // raw list from backend
const selectedTypes  = ref(new Set())       // active filters
const selectedImages = ref([])
const result         = ref({})
const loading        = ref(false)
const loadingMap     = reactive({})

/* computed: unique types + filtered list */
const fileTypes = computed(() => [...new Set(allImages.value.map(getExt))])
const images    = computed(() =>
  selectedTypes.value.size
    ? allImages.value.filter(i => selectedTypes.value.has(getExt(i)))
    : allImages.value
)


function resetScraper() {
  url.value           = ''          // clear the input
  scrapedSite.value   = ''          // forget last hostname (if you added this)
  allImages.value     = []          // raw list
  selectedTypes.value.clear()       // remove active filters
  selectedImages.value = []
  result.value        = {}
  loading.value       = false

  // empty the reactive loading map
  for (const key in loadingMap) delete loadingMap[key]
}

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
  scrapedSite.value = ''               // reset
  result.value = {}
  selectedImages.value = []
  allImages.value = []

  try {
    const res = await $fetch('/api/scrape', { method: 'POST', body: { url: url.value } })
    allImages.value = res.slice(0, 20)

    /* store neat hostname like “apple.com” */
    if (allImages.value.length) {
      scrapedSite.value = new URL(url.value).hostname   //
    }
  } catch (err) {
    alert('Failed to scrape site')
    console.error(err)
  } finally {
    loading.value = false
  }
}


async function removeBg(imgUrl) {
  if (isSvg(imgUrl)) {
    alert('⚠️ Background removal is not supported for SVG images.')
    return
  }

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



.scroll-window::-webkit-scrollbar {
  width: 8px;              /* thin bar */
  height: 8px;             /* in case of horizontal scrolling */
}

.scroll-window::-webkit-scrollbar-track {
  background: transparent; /* no background */
}

.scroll-window::-webkit-scrollbar-thumb {
  background: #eb4288;  /* Tailwind’s accent colour */
  border-radius: 4px;
}

/* ─── Firefox ─── */
.scroll-window {
  scrollbar-width: thin;                                      /* thin bar */
  scrollbar-color: #eb4288 transparent; /* thumb | track */
}

</style>