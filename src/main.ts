import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import './styles/tokens.css'
import './styles/base.css'
import './styles/themes/normal.css'
import './styles/themes/magic.css'
import './styles/themes/scholar.css'
import { initTheme } from './state/theme'
import { bootstrapGuard } from './state/guard'

bootstrapGuard()

const app = createApp(App)
app.use(createPinia())
app.use(router)

initTheme()

app.mount('#app')
