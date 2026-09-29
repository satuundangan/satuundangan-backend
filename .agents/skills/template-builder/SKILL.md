---
name: template-builder
description: >-
  Standard template architecture and guidelines for creating new wedding invitation themes in SatuUndangan.
  Use this skill when developing a new template or refactoring existing templates in src/templates/.
---

# Template Builder Guide for SatuUndangan

All wedding invitation themes reside in `satuundangan-frontend/src/templates/`.

## 📐 Mandatory Requirements for All Templates

### 1. Script Setup & Props Declaration
Vue 3 in `<script setup>` **does not** automatically declare the `props` variable in template scope:
```vue
<script setup>
import { ref, computed, onMounted } from 'vue'

const props = defineProps({
  data: {
    type: Object,
    default: () => ({})
  }
})

const data = computed(() => props.data || {})
</script>
```

### 2. Standard Core Sections
Each template should support optional rendering controlled by `data.selectedSections`:
- `hero` / Cover gate with "Buka Undangan" trigger
- `couple` (Mempelai Pria & Wanita, orang tua, foto)
- `event` (Akad Nikah & Resepsi, tanggal, jam, Google Maps)
- `gallery` (`data.galleryImages` using `<GalleryInvitation />`)
- `love-story` (Kisah perjalanan cinta)
- `video` (YouTube embed prewedding)
- `menu` (Menu makanan hidangan)
- `gift` (Bank Accounts, QRIS / E-Wallet, Alamat Pengiriman Kado)
- `rsvp` (Form konfirmasi kehadiran)
- `wishes` (Buku tamu & ucapan doa)
- `extended-family` (Turut mengundang)

### 3. Background Music
Always integrate the audio player:
```vue
<MusicControl
  v-if="data.musicChoice"
  :musicUrl="data.musicChoice"
  :start="data.audioStart || 0"
  :end="data.audioEnd || 0"
  :isAutoplay="true"
/>
```
