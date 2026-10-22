import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './styles/tokens.css'
import { migrateLegacyKeys } from './stores/storage-keys'

// Before any store reads localStorage: copy keys saved under their pre-rename names (storage-keys.ts).
migrateLegacyKeys()
createApp(App).use(createPinia()).mount('#app')
