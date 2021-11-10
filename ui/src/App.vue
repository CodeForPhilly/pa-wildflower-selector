<template>
  <div>
    <menu id="nav">
      <router-link to="/">Home</router-link> |
      <router-link to="/people-page">People Page</router-link> |
      <router-link to="/how-to-use">How to Use</router-link>
    </menu>
    <router-view />
  </div>
</template>
