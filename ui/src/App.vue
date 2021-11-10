<template>
  <div>
    <header>
      <nav>
        <router-link to="/"><img class="logo" src="/assets/images/logo.png" alt="Choose Native Plants PA" /></router-link>
        <button class="material-icons router-button">menu</button>
        <button class="material-icons router-button">close</button>
        <menu id="nav">
          <router-link to="/people-page">People Page</router-link>
          <router-link to="/how-to-use">How to Use</router-link>
        </menu>
      </nav>
    </header>
    <router-view />
  </div>
</template>

<style>
.logo {
  width: 120px;
}
@font-face {
  font-family: Arvo;
  src: url("/fonts/Arvo-Regular.ttf") format("truetype");
}
@font-face {
  font-family: Arvo;
  font-weight: 700;
  font-style: normal;
  src: url("/fonts/Arvo-Bold.ttf") format("truetype");
}
@font-face {
  font-family: Arvo;
  font-style: italic;
  src: url("/fonts/Arvo-Italic.ttf") format("truetype");
}
@font-face {
  font-family: Arvo;
  font-weight: 700;
  font-style: italic;
  src: url("/fonts/Arvo-BoldItalic.ttf") format("truetype");
}

@font-face {
  font-family: Roboto;
  src: url("/fonts/Roboto-Regular.ttf") format("truetype");
}
@font-face {
  font-family: Roboto;
  font-weight: 700;
  font-style: normal;
  src: url("/fonts/Roboto-Bold.ttf") format("truetype");
}
@font-face {
  font-family: Roboto;
  font-style: italic;
  src: url("/fonts/Roboto-Italic.ttf") format("truetype");
}
@font-face {
  font-family: Roboto;
  font-weight: 700;
  font-style: italic;
  src: url("/fonts/Roboto-BoldItalic.ttf") format("truetype");
}

@font-face {
  font-family: Lato;
  src: url("/fonts/Lato-Regular.ttf") format("truetype");
}
@font-face {
  font-family: Lato;
  font-weight: 700;
  font-style: normal;
  src: url("/fonts/Lato-Bold.ttf") format("truetype");
}
@font-face {
  font-family: Lato;
  font-style: italic;
  src: url("/fonts/Lato-Italic.ttf") format("truetype");
}
@font-face {
  font-family: Lato;
  font-weight: 700;
  font-style: italic;
  src: url("/fonts/Lato-BoldItalic.ttf") format("truetype");
}
@font-face {
  font-family: 'Material Icons';
  font-style: normal;
  font-weight: 400;
  src: url("/fonts/MaterialIcons-Regular.ttf") format("truetype");
}
.material-icons {
  font-family: 'Material Icons';
  font-weight: normal;
  font-style: normal;
  display: inline-block;
  line-height: 1;
  text-transform: none;
  letter-spacing: normal;
  word-wrap: normal;
  white-space: nowrap;
  direction: ltr;

  /* Support for all WebKit browsers. */
  -webkit-font-smoothing: antialiased;
  /* Support for Safari and Chrome. */
  text-rendering: optimizeLegibility;

  /* Support for Firefox. */
  -moz-osx-font-smoothing: grayscale;

  /* Support for IE. */
  font-feature-settings: 'liga';

  vertical-align: middle;
  
  font-size: 120%;
}

.material-align {
  display: inline-flex;
  vertical-align: bottom;  
}

.router-button {
  border: 0;
  background: none;
  font-size: 36px;
}
</style>