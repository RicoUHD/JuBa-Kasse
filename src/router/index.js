import { createRouter, createWebHistory } from 'vue-router';
import { useAppStore } from '../stores/app';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue')
    },
    {
      path: '/admin',
      name: 'admin',
      component: () => import('../views/AdminDashboard.vue'),
      meta: { requiresAuth: true, requiresAdmin: true }
    },
    {
      path: '/user',
      name: 'user',
      component: () => import('../views/UserDashboard.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/',
      redirect: '/login'
    }
  ]
});

router.beforeEach(async (to, from, next) => {
  const store = useAppStore();

  if (!store.user && store.authLoading) {
      await store.initAuth();
  }

  const isAuthenticated = store.isAuthenticated;
  const isAdmin = store.isAdmin;

  if (to.meta.requiresAuth && !isAuthenticated) {
    next({ name: 'login' });
  } else if (to.meta.requiresAdmin && !isAdmin) {
    next({ name: 'user' });
  } else if (to.name === 'login' && isAuthenticated) {
    if (isAdmin) next({ name: 'admin' });
    else next({ name: 'user' });
  } else {
    next();
  }
});

export default router;
