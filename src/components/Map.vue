<template>
  <div class="wrapper">
    <Header h1="Nurseries" :large-h1="false" :seamless="true" />
    <div class="map-and-list">
      <div class="list">
        <h1>Nurseries for Native Plants</h1>
        <p class="instructions">Call nursery to confirm availability. Nursery catalog data provided by <a href="https://www.plantagents.org/" target="_blank">
  Plant Agent's Native Plant Retail Catalog</a>. Only nurseries with a plant catalog on their site are listed. Contact Plant Agents to report missing ones.</p>
        <div v-if="nurseries">
          <ul>
            <li :ref="nursery._id" v-for="nursery in nurseries" v-bind:key="nursery._id" :class="{ nursery: true, focused: nursery === focused }">
              <h4><a @click.prevent="setFocusedNursery(nursery)" target="_blank" :href="nursery.URL">{{ nursery.SOURCE }}</a></h4>
              <div class="details">
                <p><a :href="addressLink(nursery)">{{ nursery.ADDRESS }}</a></p>
                <p><a :href="phoneLink(nursery)">{{ nursery.PHONE }}</a></p>
                <p>{{ nursery.EMAIL }}</p>
              </div>
            </li>
          </ul>
        </div>
        <p v-else>Loading...</p>
      </div>
      <div ref="map" class="map">Loading...</div>
    </div>
  </div>
</template>

<script>
import "leaflet/dist/leaflet.css";
import Header from "./Header.vue";

export default {
  name: 'Map',
  data() {
    return {
      nurseries: null,
      focused: null
    };
  },
  components: {
    Header
  },
  // Server only
  async serverPrefetch() {
    this.server = true;
    await this.fetchNurseries();
  },
  // Browser only
  async mounted() {
    const L = await import('leaflet');

    // Workaround for: https://github.com/Leaflet/Leaflet/issues/4968

    delete L.Icon.Default.prototype._getIconUrl;

    L.Icon.Default.mergeOptions({
      iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
      iconUrl: require('leaflet/dist/images/marker-icon.png'),
      shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
    });

    await this.fetchNurseries();
    this.map = L.map(this.$refs.map).setView([ 39.8097343, -98.5556199 ], 4);
    L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
        attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
        maxZoom: 18,
        id: 'mapbox/streets-v11',
        tileSize: 512,
        zoomOffset: -1,
        accessToken: 'pk.eyJ1IjoidGJvdXRlbGwiLCJhIjoiY2wwcGl6eXZvMDdodjNrbml5ZjRoa3VsbCJ9.ShbnljPojsq-ymys2ortkw'
    }).addTo(this.map);
    for (const nursery of this.nurseries) {
      if (nursery.lat !== undefined) {
        const marker = L.marker([ nursery.lat, nursery.lon ]).addTo(this.map);
        const name = esc(nursery.SOURCE);
        const address = `${esc(nursery.ADDRESS)}`;
        const phone = esc(nursery.PHONE);
        const email = esc(nursery.EMAIL);
        const url = esc(nursery.URL);
        nursery.marker = marker;
        marker.bindPopup(`
          <div class="map-popup">
            <h3><a href="${url}">${name}</a></h3>
            <p class="map-address">
              <a href="${this.addressLink(nursery)}">${address}</a>
            </p>
            <p class="map-phone">
             <a href="${this.phoneLink(nursery)}">${phone}</a>
            </p>
            <p class="map-email">
              <a href="mailto:${email}">${email}</a>
            </p>
          </div>
        `
        );
        marker.on('click', () => {
          this.setFocusedNursery(nursery);
        });
      }
    }
  },
  unmounted() {
    if (this.map) {
      this.map.off();
      this.map.remove();
    }
  },
  methods: {
    async fetchNurseries() {
      var state = localStorage.getItem("state") || "ALL";
      const data = await this.get(`/api/v1/nurseries?state=${state}`);
      this.nurseries = data.results;
      // Trim to match on data with space issues
      if (this.$route.query.name) {
        this.focused = this.nurseries.find(nursery => nursery.SOURCE.trim() === this.$route.query.name.trim());
      } else {
        this.focused = null;
      }
      if (this.focused && (!this.server)) {
        setTimeout(() => {
          this.setFocusedNursery(this.focused);
        }, 100);
      }
    },
    async get(url) {
      const response = await fetch(url);
      if (response.status >= 400) {
        throw response;
      }
      return response.json();
    },
    setFocusedNursery(nursery) {
      this.focused = nursery;
      this.map.panTo([ nursery.lat, nursery.lon ]);
      this.$refs.map.scrollIntoView();
      nursery.marker.openPopup();
    },
    addressLink(nursery) {
      const text = `${nursery.ADDRESS}`;
      return `https://www.google.com/maps/place/${encodeURIComponent(text)}`;
    },
    phoneLink(nursery) {
      return `tel:${esc(nursery.PHONE)}`;
    }
  }
};

function esc(text) {
  return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g, '&quot;');
}

</script>

<style scoped>
  .wrapper {
    display: flex;
    flex-direction: column;
    height: 100vh;
  }
  .map-and-list {
    display: flex;
    flex-direction: column;
    flex-grow: 1.0;
  }
  .map {
    flex-grow: 1.0;
    flex-basis: 40vh;
  }
  .list {
    order: 1;
    margin: 0 32px;
    color: #B74D15;
    flex-grow: 1.0;
    flex-basis: 0;
  }
  .list h1 {
    font-weight: bold;
    font-size: 18px;
    font-family: Lato;
    letter-spacing: 0.1em;
    text-align: center;
  }
  .list .instructions {
    text-align: center;
  }
  .list h4 {
    font-weight: 400;
  }
  .list p {
    font-size: 12px;
    font-family: Roboto;
  }
  .list ul {
    list-style: none;
    padding-left: 0;
  }
  .list a {
    color: #1D2E26;
    font-size: 12px;
    font-family: Roboto;
  }
  .list .focused a {
    color: #B74D15;
  }
  .list .nursery .details {
    display: none;
  }
  @media all and (min-width: 1280px) {
    .map-and-list {
      display: block;
    }
    /* Because padding or margin on the list
       messes up the 50-50 split */
    .list > * {
      padding: 0 180px;
    }
    .list {
      /* Unfortunately flex-direction: row causes leaflet to
        scroll away from the center when the zoom buttons are used,
        so split the page the old-school way */
      display: inline-block;
      width: 50%;
      height: 100vh;
      overflow: scroll;
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    .list .instructions {
      text-align: left;
    }
    .list .nursery .details {
      display: block;
    }
    .map {
      display: inline-block;
      width: 50%;
      height: 100vh;
    }
    .list p {
      font-size: 16px;
    }
    .list h1 {
      color: #1D2E26;
      font-family: Arvo;
      font-weight: 400;
      font-size: 60px;
      text-align: center;
      padding: 0;
      margin-block-end: 24px;
      letter-spacing: 0;
    }
    .nursery h4 {
      font-size: 20px;
      font-weight: 400;
      margin: 0.5em 0;
    }
    .nursery h4 a {
      text-decoration: none;
      font-size: 16px;
      font-family: Lato;
    }
    .nursery p {
      color: rgba(29, 46, 38, 0.7);
      margin: 0;
      padding: 0;
      line-height: 24px;
    }
  }
</style>
