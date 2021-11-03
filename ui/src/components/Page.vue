<template>
  <div>
    <header>
      <nav>
        <a href="/"><img src="/assets/logo.png" alt="Choose Native Plants PA" /></a>
        <button class="page-hamburger-open">open</button>
        <button class="page-hamburger-close">close</button>
        <menu>
          <a v-for="subpage in subpages" :key="subpage.slug" :href="page.slug" :class="page.slug === subpage.slug ? 'active' : ''">
            {{ subpage.title }}
          </a>
        </menu>
      </nav>
      <h1>{{ page.title }}</h1>
    </header>
    <main>

    </main>
  </div>
</template>