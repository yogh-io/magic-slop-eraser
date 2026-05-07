import { createRouter, createWebHashHistory } from 'vue-router'
import AnalyzePage from './pages/AnalyzePage.vue'
import CategoriesPage from './pages/CategoriesPage.vue'
import CategoryPage from './pages/CategoryPage.vue'
import PatternPage from './pages/PatternPage.vue'
import AboutPage from './pages/AboutPage.vue'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'analyze', component: AnalyzePage },
    { path: '/categories', name: 'categories', component: CategoriesPage },
    { path: '/categories/:id', name: 'category', component: CategoryPage, props: true },
    { path: '/patterns/:id', name: 'pattern', component: PatternPage, props: true },
    { path: '/about', name: 'about', component: AboutPage },
  ],
  scrollBehavior: () => ({ top: 0 }),
})
