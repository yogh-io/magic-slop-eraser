import type { RouteRecordRaw } from 'vue-router'

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'analyze',
    component: () => import('./pages/AnalyzePage.vue'),
    meta: { title: 'Analyse' },
  },
  {
    path: '/local',
    name: 'local',
    component: () => import('./pages/LocalAnalysisPage.vue'),
    meta: { title: 'Local scratchpad' },
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
    meta: { title: 'Methodology' },
  },
  {
    path: '/skill',
    name: 'skill',
    component: () => import('./pages/SkillPage.vue'),
    meta: { title: 'Eraser skill' },
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
]
