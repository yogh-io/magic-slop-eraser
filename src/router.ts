import { createRouter, createWebHistory } from 'vue-router'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'analyze',
      component: () => import('./pages/AnalyzePage.vue'),
      meta: { title: 'Analyse' },
    },
    {
      path: '/categories',
      name: 'categories',
      component: () => import('./pages/CategoriesPage.vue'),
      meta: { title: 'Catalogue' },
    },
    {
      path: '/categories/:id',
      name: 'category',
      component: () => import('./pages/CategoryPage.vue'),
      props: true,
      meta: { title: 'Category' },
    },
    {
      path: '/patterns/:id',
      name: 'pattern',
      component: () => import('./pages/PatternPage.vue'),
      props: true,
      meta: { title: 'Pattern' },
    },
    {
      path: '/rungs',
      name: 'rungs',
      component: () => import('./pages/RungsPage.vue'),
      meta: { title: 'Rungs' },
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('./pages/AboutPage.vue'),
      meta: { title: 'About' },
    },
    {
      path: '/d/:id',
      name: 'online-doc',
      component: () => import('./pages/OnlineDocPage.vue'),
      meta: { title: 'Document' },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('./pages/NotFoundPage.vue'),
      meta: { title: 'Not found' },
    },
  ],
  scrollBehavior(_to, _from, savedPosition) {
    if (savedPosition) return savedPosition
    return { top: 0 }
  },
})

const BASE_TITLE = 'Magic Slop Eraser'
router.afterEach((to) => {
  const part = typeof to.meta.title === 'string' ? to.meta.title : ''
  document.title = part ? `${part} · ${BASE_TITLE}` : BASE_TITLE
})
