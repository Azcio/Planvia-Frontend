<template>
  <Logo />
  <router-view></router-view>
</template>

<script>
import Logo from './components/Logo.vue'

export default {
  name: 'App',
  components: { Logo },
}
</script>
