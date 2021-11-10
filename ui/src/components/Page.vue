<template>
  <div>
    <header>
      <nav>
        <a href="/"><img src="/assets/logo.png" alt="Choose Native Plants PA" /></a>
        <button class="page-hamburger-open">open</button>
        <button class="page-hamburger-close">close</button>
      </nav>
      <h1>{{ title }}</h1>
      <slot></slot>
    </header>
    <main>
      <slot></slot>
    </main>
  </div>
</template>

<script>
export default {
  props: {
    title: String
  }
};
</script>
