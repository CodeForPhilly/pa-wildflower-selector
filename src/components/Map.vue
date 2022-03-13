<template>
  <div class="wrapper">
    <Header h1="PA Nurseries" />
    <div class="map-and-list">
      <div ref="map" class="map">Loading...</div>
      <div class="list">
        <h2>PA Native Plant Nurseries</h2>
        <p>Please call the Nursery first to be sure the items you want are currently stocked</p>
        <div v-if="nurseries">
          <ul v-for="nursery in nurseries" v-bind:key="nursery._id">
            <li><a @click.prevent="flyToNursery(nursery)" :href="nursery.URL">{{ nursery.Name }}</a></li>
          </ul>
        </div>
        <p v-else>Loading...</p>
      </div>
    </div>
  </div>
</template>

<script>
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import Header from "./Header.vue";

// Workaround for: https://github.com/Leaflet/Leaflet/issues/4968

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

export default {
  name: 'Map',
  data() {
    return {
      nurseries: null
    };
  },
  components: {
    Header
  },
  // Server only
  async serverPrefetch() {
    await this.fetchNurseries();
  },
  // Browser only
  async mounted() {
    await this.fetchNurseries();
    this.map = L.map(this.$refs.map).setView([ 40.79873, -77.5 ], 6);
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
        const name = esc(nursery.Name);
        const address = esc(nursery.Address);
        const phone = esc(nursery.Phone);
        const email = esc(nursery.Email);
        nursery.marker = marker;
        marker.bindPopup(`
          <div class="map-popup">
            <h3>${name}</h3>
            <p class="map-address">
              ${address}
            </p>
            <p class="map-phone">
              ${phone}
            </p>
            <p class="map-email">
              <a href="mailto:${email}">${email}</a>
            </p>
          </div>
        `
        );
        marker.on('click', () => marker.openPopup());
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
      const data = await this.get('/api/v1/nurseries');
      this.nurseries = data.results;
      const fakeData = {
        'Arcadia Washington': {
          Address: '2273 S Main St Extension, Washington, PA 15301',
          Phone: '(724) 986-0907',
          URL: 'https://arcadianatives.com/',
          Email: ''
        },
        'Bowman\'s New Hope': {
          Address: '1635 River Rd, New Hope, PA 18938',
          Phone: '(215) 862-2924',
          URL: 'https://bhwp.org/',
          Email: 'bhwp@bhwp.org'
        }
      };
      for (const nursery of this.nurseries) {
        Object.assign(nursery, fakeData[nursery.Name] || {});
        if (nursery.Address) {
          const location = await this.get(`https://nominatim.openstreetmap.org/?format=json&q=${encodeURIComponent(nursery.Address)}&addressdetails=1&limit=1`);
          if (!(location && location[0])) {
            continue;
          }
          nursery.lon = location[0].lon;
          nursery.lat = location[0].lat;
        }
      }
    },
    async get(url) {
      const response = await fetch(url);
      if (response.status >= 400) {
        throw response;
      }
      return response.json();
    },
    flyToNursery(nursery) {
      if (nursery.lat !== undefined) {
        this.map.panTo([ nursery.lat, nursery.lon ]);
        nursery.marker.openPopup();
      }
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
  }
  .list {
    margin: 0 32px;
    color: #B74D15;
    flex-grow: 0;
    height: 224px;
    overflow: scroll;
  }
  .list h2 {
    font-weight: bold;
    font-size: 18px;
    font-family: Lato;
    letter-spacing: 0.1em;
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
</style>
