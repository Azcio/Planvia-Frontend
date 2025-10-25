import { createRouter, createWebHistory } from 'vue-router'
import StartPage from '../components/StartPage.vue'
import HomePage from '../components/HomePage.vue'
import Timetable from '../components/Timetable.vue'
import EditActivities from '../components/EditActivities.vue'

const routes = [
  { path: '/', component: StartPage },
  { path: '/home', component: HomePage },
  { path: '/timetable', component: Timetable },
  { path: '/tasks', component: EditActivities },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
