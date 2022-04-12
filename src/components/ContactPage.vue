<template>
  <Page slug="/how-to-use" title="Contact Us" h1="Contact Us">
    <article>
      <p>
        Thanks for choosing PA native plants! Please provide feedback about your experience and/or issue using our application today.
      </p>
      <form @submit.prevent="submit">
        <fieldset>
          <input v-model="email" required type="email" name="email" placeholder="Email" />
        </fieldset>
        <p>
          Did you encounter a bug on our application? If so, what type of bug did you experience today?
        </p>
        <fieldset>
          <label>
            <input v-model="type" required type="radio" name="type" value="bug" />
            <p>App Malfunction: a button, page, image, etc. did not work properly</p>
          </label>
          <label>
            <input v-model="type" required type="radio" name="type" value="plant" />
            <p>Missing Plant: Missing Plant: I'm aware of a native plant not in your database/application</p>
          </label>
          <label>
            <input v-model="type" required type="radio" name="type" value="picture" />
            <p>Missing Picture: I have a picture of a plant in your database that is not depicted on your application</p>
          </label>
          <label>
            <input v-model="type" required type="radio" name="type" value="other" />
            <p class="other"><span>Other:</span><input :disabled="type !== 'other'" type="text" name="other" /></p>
          </label>
        </fieldset>
        <p>
          If able, please provide a screenshot of your issue (or missing plant image you want to contribute).
        </p>
        <fieldset>
          <input ref="file" type="file" name="file" placeholder="Attach File" />
        </fieldset>
        <p>
          Please describe your issue in your own words here: 
        </p>
        <fieldset>
          <textarea required v-model="body" name="body"></textarea>
        </fieldset>
        <fieldset class="actions">
          <button class="primary" type="submit">Send Message</button>
        </fieldset>
      </form>
    </article>
    <div class="tone">
      <div class="carrier-wave">
        <img src="/assets/images/wave-top-light.png" class="wave" />
      </div>
    </div>
  </Page>
</template>

<script>
import Page from './Page.vue';

export default {
  name: 'ContactPage',
  components: {
    Page
  },
  data() {
    return {
      email: '',
      type: '',
      body: '',
      busy: false,
      error: false,
      thankYou: false
    };
  },
  methods: {
    async submit() {
      console.log('in submit method');
      const formData = new FormData();
      formData.append('email', this.email);
      formData.append('type', this.type);
      formData.append('other', this.other);
      formData.append('body', this.body);
      if (this.file?.files?.[0]) {
        formData.append('file', this.file.files[0]);
      }
      this.busy = true;
      try {
        const response = await fetch('/api/v1/contact', {
          method: 'POST',
          body: formData
        });
        if (response.status >= 400) {
          this.error = true;
          setTimeout(() => {
            this.error = false;
          }, 5000);
        } else {
          this.thankYou = true;
          setTimeout(() => {
            this.thankYou = false;
          }, 5000);
        }
      } finally {
        this.busy = false;
      }
    }
  }
};

</script>

<style scoped>
  article {
    max-width: 640px;
    margin: auto;
    padding: 0 16px;
  }
  p, label {
    font-size: 16px;
    line-height: 20px;
  }
  label {
    display: flex;
  }

  label input[type="radio"] {
    -webkit-appearance: none;
    appearance: none;
    background-color: #fcf9f4;
    margin: 16px 8px 0 0;
    font: inherit;
    color: #B74D15;
    flex-basis: 20px;
    flex-grow: 0;
    flex-shrink: 0;
    height: 20px;
    border: 2px solid #B74D15;
    border-radius: 50%;
    display: grid;
    place-content: center;
  }

  label input[type="radio"]::before {
    content: "";
    width: 0.65em;
    height: 0.65em;
    border-radius: 50%;
    transform: scale(0);
    transition: 120ms transform ease-in-out;
    box-shadow: inset 1em 1em #B74D15;
  }

  label input[type="radio"]:checked::before {
    transform: scale(1);
  }

  label p {
    flex-grow: 1.0;
  }
  fieldset {
    border: 0;
  }
  input[type="email"],input[type="text"] {
    display: inline-block;
    height: 32px;
    padding: 16px;
    border: 1px solid #aaa;
    border-radius: 4px;
  }
  input {
    background-color: inherit;
    width: 100%;
    margin: 0;
  }
  .other {
    display: flex;
  }
  .other .span {
    flex-grow: 0;
  }
  .other input {
    flex-grow: 1.0;
    margin-left: 16px;
    transform: translate(0, -6px);
  }
  textarea {
    background-color: inherit;
    margin: 0;
    width: 100%;
    height: 240px;
    border: 1px solid #aaa;
    border-radius: 4px;
    resize: none;
    font-size: 16px;
    font-family: inherit;
    font-size: inherit;
    font-weight: normal;
  }
  button {
    background-color: #FCF9F4;
    color: #B74D15;
    border: 1px solid #B74D15;
    border-radius: 8px;
    padding: 12px;
    font-size: 17px;
    font-family: Roboto;
  }

  .actions {
    text-align: right;
  }

  button.primary {
    background-color: #B74D15;
    color: #FCF9F4;
  }
</style>