<template>
  <div>
    <Header
      :h1="
        favorites
          ? 'Favorites'
          : questions
          ? 'Quick Search'
          : 'Choose Native Plants'
      "
      :large-h1="false"
    >
      <template v-if="!(questions || favorites)" v-slot:after-bar>
        <p class="not-large-help">
          <router-link to="/quick-search"
            >Not sure where to start?<br />Try quick search</router-link
          >
        </p>
        <div class="not-large-help" v-if="zipCode">
          <button class="primary primary-bar" @click="setLocation()">
              <span class="material-icons">place</span> Change Location [{{
                zipCode
              }}]
            </button>
          </div>
        <div v-else class="hide-desk">
          <button class="primary primary-bar" @click="setLocation()">
            <span class="material-icons">place</span> Set Location
          </button>
        </div>
       
        <div class="two-up large-help">
          <div class="two-up-text">
            <h2>
              Native plants promote a healthier ecosystem in your garden
              <div v-if="zipCode">
                <button @click="setLocation()">
                  <span class="material-icons">place</span> change location [{{
                    zipCode
                  }}]
                </button>
              </div>
              <div v-else>
                <button @click="setLocation()">
                  <span class="material-icons">place</span> set location
                </button>
              </div>
            </h2>
            <p>
              Find which native shrubs, plants and flowers <span v-if="displayLocation">from
              <strong>{{ displayLocation }}</strong></span> have the right conditions
              to flourish in your garden. Use the quick search option or side
              filters to get started. Detailed instructions are found
              <router-link to="/how-to-use#the-directions">here</router-link>
            </p>
            <button class="primary" @click="$router.push('/quick-search')">
              Quick Search
            </button>
          </div>
          <div class="two-up-image" :style="twoUpImage(twoUpIndex)">
            <span class="two-up-credit"
              ><a target="_blank" :href="twoUpImageCredit(twoUpIndex).href">{{
                twoUpImageCredit(twoUpIndex).title
              }}</a></span
            >
          </div>
        </div>
      </template>
    </Header>
    <div class="search-desktop-parent" v-if="!(questions || favorites)">
      <form class="search-desktop" @submit.prevent="submit">
        <span class="material-icons">search</span>
        <input v-model="q" id="q" placeholder="Search plant name" />
        <button type="submit" class="text" :disabled="q.length == 0">
          <span class="material-icons">chevron_right</span>
        </button>
      </form>
    </div>
    <h1 class="large favorites" v-if="favorites">Favorites List</h1>
    <article v-if="selected" class="selected">
      <div class="modal-bar">
        <span class="title">More Info</span>
        <router-link to="/" class="material-icons router-button close-nav"
          >close</router-link
        >
      </div>
      <div class="two-up">
        <div class="two-up-image" :style="selectedImageStyle(selected)"></div>
        <div class="two-up-text">
          <h1>
            {{ selected["Common Name"]
            }}<button
              @click="toggleFavorite(selected._id)"
              class="favorite-selected text"
            >
              <span class="material-icons material-align">{{
                renderFavorite(selected._id)
              }}</span>
            </button>
          </h1>
          <h2>{{ selected["Scientific Name"] }}</h2>
          <p v-if="selected['Blurb']">{{ selected["Blurb"] }}</p>
          <p v-if="selected['Flowering Months']">
            Flowering Months:
            {{ selected["Flowering Months"] }}
          </p>
          <p v-if="selected['Height (feet)']">
            Height: {{ selected["Height (feet)"] }} feet
          </p>
          <h3 v-if="localStoreLinks.length || onlineStoreLinks.length">
            Nurseries that carry this native plant:
          </h3>
          <h4 class="enter-location" v-if="!this.zipCode"><a @click="setLocation()">Enter your location in order to see nearby stores</a></h4>
          <h4 v-if="this.zipCode && localStoreLinks.length">Local Nurseries</h4>
          <p class="store-links">
            <a
              v-for="storeLink in localStoreLinks"
              :key="storeLink.url"
              target="_blank"
              :href="storeLink.url"
              class="store-link"
              >{{ storeLink.label }} [{{ storeLink.distance }} miles]</a
            >
          </p>
          <h4 v-if="onlineStoreLinks.length">Online Stores</h4>
          <p class="store-links">
            <a
              v-for="storeLink in onlineStoreLinks"
              :key="storeLink.url"
              target="_blank"
              :href="storeLink.url"
              class="store-link"
              >{{ storeLink.label }}</a
            >
          </p>
          <h3 v-if="selected.Articles.length">Mentioned in these articles:</h3>
          <p class="store-links">
            <a
              v-for="articleLink in selected.Articles"
              :key="articleLink['Source']"
              target="_blank"
              :href="articleLink['Source URL']"
              class="store-link"
              >{{ articleLink["Source"] }}</a
            >
          </p>
          <div
            v-for="flagGroup in flagGroups(flags)"
            v-bind:key="flagGroup.title"
          >
            <h4 v-if="flagGroup.title">{{ flagGroup.title }}</h4>
            <div class="chips flags">
              <span
                class="chip"
                v-for="flag in flagGroup.flags"
                v-bind:key="flag.key"
              >
                <img
                  v-if="!flag.color"
                  :src="`/assets/images/${flag.svg}.svg`"
                  class="choice-icon"
                />
                <span v-else class="chip-color" :style="chipColor(flag)"></span>
                <span class="chip-label">{{ flag.label }}</span>
              </span>
            </div>
          </div>
          <p v-if="credit(selected)">
            Photo Credit:
            <span v-html="credit(selected).artist"></span>
            <a :href="credit(selected).licenseUrl">{{
              credit(selected).license
            }}</a>
          </p>
        </div>
      </div>
    </article>
    <main :class="mainClasses">
      <div v-if="questions" class="questions-box">
        <div :class="questionsClasses">
          <div v-if="!question" class="questions-prologue">
            <h1 class="large">Quick search</h1>
            <p class="small">Novice gardener?</p>
            <p class="small">Don't know where to start?</p>
            <p class="large">Novice gardener? Don't know where to start?</p>
            <p>
              Answering these easy questions will get you well on your way to a
              selection of plants for your garden.
            </p>
          </div>
          <form
            :class="questionClasses(index)"
            v-for="(questionDetail, index) in questionDetails"
            :key="index"
          >
            <h4>{{ questionDetail.title }}</h4>
            <div class="radio-inputs" v-if="questionDetail.type === 'boolean'">
              <label>
                <input
                  name="{{ questionDetail.name }}"
                  type="radio"
                  value="1"
                  v-model="questionDetail.value"
                />
                <span class="label">Yes</span>
              </label>
              <label>
                <input
                  name="{{ questionDetail.name }}"
                  type="radio"
                  value=""
                  v-model="questionDetail.value"
                />
                <span class="label">No</span>
              </label>
            </div>
            <div v-else-if="questionDetail.type === 'month'" class="month">
              <button @click.stop.prevent="toggleMonth" class="list-button">
                <span class="label">Planting Month</span>
                <span class="value">{{ currentMonthLabel }}</span>
                <span class="material-icons">{{
                  monthIsOpen ? "arrow_drop_up" : "arrow_drop_down"
                }}</span>
              </button>
              <Menu
                :open="monthIsOpen"
                :choices="questionDetail.choices"
                v-model="questionDetail.value"
                @close="toggleMonth"
              />
            </div>
            <div class="question-buttons">
              <div
                v-if="index + 1 === questionDetails.length"
                class="show-back"
              >
                <button
                  class="primary"
                  v-if="index + 1 === questionDetails.length"
                  @click.prevent="endQuestions"
                >
                  Show Plants
                </button>
                <button v-if="index > 0" @click.prevent="question = index - 1">
                  Back
                </button>
              </div>
              <div v-else class="next-back">
                <button
                  class="primary next"
                  v-if="index + 1 < questionDetails.length"
                  @click.prevent="nextQuestion"
                >
                  Next
                </button>
                <button
                  class="back"
                  v-if="index > 0"
                  @click.prevent="question = index - 1"
                >
                  Back
                </button>
              </div>
              <button @click="quitQuestions">Quit Questions</button>
            </div>
          </form>
        </div>
        <div
          class="questions-decoration"
          :style="twoUpImage(questionsHeroIndex)"
        >
          <span class="two-up-credit"
            ><a :href="twoUpImageCredit(twoUpIndex).href" target="_blank">{{
              twoUpImageCredit(twoUpIndex).title
            }}</a></span
          >
        </div>
      </div>
      <template v-else>
        <div class="controls">
          <div class="filter-toggle-and-sort">
            <button
              v-if="!favorites"
              class="primary primary-bar filter"
              @click="openFilters"
            >
              Filter
            </button>
            <div class="sort-and-favorites">
              <button
                class="favorites"
                :disabled="!favoritesAvailable"
                v-if="!favorites"
                @click="favoritesAvailable && $router.push('/favorites')"
              >
                <span class="material-icons material-align">favorite</span
                ><span class="favorites-label">&nbsp;Favorites</span>
              </button>
              <div class="sort">
                <button @click.stop="toggleSort" :class="sortButtonClasses">
                  <span class="label">Sort By</span>
                  <span class="value">{{ sortLabel(sort) }}</span>
                  <span class="material-icons">{{
                    sortIsOpen ? "arrow_drop_up" : "arrow_drop_down"
                  }}</span>
                </button>
                <Menu
                  :open="sortIsOpen"
                  :choices="sorts"
                  v-model="sort"
                  @close="toggleSort"
                />
              </div>
            </div>
          </div>
          <form
            v-if="!favorites"
            class="filters"
            id="form"
            @submit.prevent="submit"
          >
            <div class="inner-controls">
              <div class="search-mobile-box">
                <span class="material-icons">search</span>
                <input
                  v-model="q"
                  id="q"
                  type="text"
                  class="search-mobile"
                  placeholder="Search plant name"
                />
              </div>
              <div class="go">
                <button class="primary primary-bar clear" @click="clearAll">
                  Clear
                </button>
                <button class="primary primary-bar apply" type="submit">
                  Apply
                </button>
              </div>
            </div>
            <fieldset
              v-for="filter in filters"
              :key="filter.name"
              :class="filterClass(filter)"
            >
              <button
                class="fieldset-toggle"
                @click.prevent="toggleFilter(filter)"
              >
                {{ filter.label || filter.name }}
                <span v-if="!filter.alwaysOpen" class="material-icons">{{
                  filterIsOpen[filter.name]
                    ? "arrow_drop_up"
                    : "arrow_drop_down"
                }}</span>
              </button>
              <template v-if="filterIsOpen[filter.name]">
                <template v-if="filter.range">
                  <Range
                    :double="filter.double"
                    :exponent="filter.exponent"
                    :choices="filter.choices"
                    :min="filter.min"
                    :max="filter.max"
                    v-model="filterValues[filter.name]"
                  />
                </template>
                <template v-else>
                  <label v-for="choice in filter.choices" :key="choice">
                    <span class="filter-contents">
                      <Checkbox
                        :disabled="!filterCounts[filter.name][choice]"
                        v-model="filterValues[filter.name]"
                        :value="choice"
                      />
                      <span class="text"
                        >{{ choice }} ({{
                          filterCounts[filter.name][choice] || 0
                        }})</span
                      >
                    </span>
                    <div>
                      <span
                        v-if="filter.color"
                        :style="flowerColorStyle(choice)"
                        class="color-example"
                      />
                      <img
                        v-else
                        :src="`/assets/images/${choice}.svg`"
                        class="choice-icon"
                      />
                    </div>
                  </label>
                </template>
              </template>
            </fieldset>
          </form>
        </div>
        <div class="chips-and-plants">
          <div class="chips" v-if="!favorites && chips.length">
            <button
              class="chip"
              v-for="chip in chips"
              v-bind:key="chip.key"
              @click="removeChip(chip)"
            >
              <img
                v-if="!chip.color"
                :src="`/assets/images/${chip.svg}.svg`"
                class="choice-icon"
              />
              <span v-else class="chip-color" :style="chipColor(chip)"></span>
              <span class="chip-label">{{ chip.label }}</span
              ><span class="material-icons">close</span>
            </button>
            <button class="text clear" @click="clearAll">Clear all</button>
          </div>
          <article class="plants">
            <article
              v-for="result in results"
              :key="result._id"
              @click="this.$router.push(plantLink(result))"
              class="plant-preview-wrapper"
            >
              <div class="plant-preview">
                <div class="photo" :style="imageStyle(result, true)"></div>
                <div class="names">
                  <h4 class="common-name">{{ result["Common Name"] }}</h4>
                  <h5 class="scientific-name">
                    {{ result["Scientific Name"] }}
                  </h5>
                </div>
                <button
                  @click.stop="toggleFavorite(result._id)"
                  class="favorite-large text"
                >
                  <span class="material-icons material-align">{{
                    renderFavorite(result._id)
                  }}</span>
                </button>
                <div class="plant-controls-wrapper">
                  <div class="plant-controls">
                    <router-link :to="plantLink(result)" class="text">
                      <span class="material-icons material-align info"
                        >info_outline</span
                      >
                      More Info
                    </router-link>
                    <button
                      @click.stop="toggleFavorite(result._id)"
                      class="favorite-regular text"
                    >
                      <span class="material-icons material-align">{{
                        renderFavorite(result._id)
                      }}</span>
                    </button>
                  </div>
                </div>
              </div>
            </article>
            <!-- Placeholders to ensure minimum number of cells so the grid does not
              provide huge plant previews when there are only 3 plants on desktop -->
            <article
              v-for="extra in extras"
              :key="extra.id"
              class="extra"
            ></article>
          </article>
        </div>
      </template>
    </main>
    <!-- Useful if we go back to using an observer for infinite scroll -->
    <div ref="next"></div>
  </div>
</template>

<script>
import qs from "qs";
import Range from "./Range.vue";
import Checkbox from "./Checkbox.vue";
import Header from "./Header.vue";
import Menu from "./Menu.vue";

const twoUpImageCredits = [
  // Order is synced with the public/assets/images/two-up folder filenames,
  // please do not change or images will show the wrong credits
  {
    title: "Photo by Fritzflohrreynolds",
    href: "https://commons.wikimedia.org/wiki/File:Asclepias_syriaca_-_Common_Milkweed.jpg",
  },
  {
    title: "Photo by Derek Ramsey",
    href: "https://commons.wikimedia.org/wiki/File:Butterfly_Weed_Asclepias_tuberosa_Umbel.jpg",
  },
  {
    title: "Photo by Gerri Wilson",
    href: "https://commons.wikimedia.org/wiki/File:The_Winner_-_Joe-pye_Weed_(8577260771).jpg",
  },
  {
    title: "Photo by Agnieszka Kwiecień, Nova",
    href: "https://commons.wikimedia.org/wiki/File:Opuntia_humifusa_Opuncja_2018-06-10_02.jpg",
  },
  {
    title: "Photo by Steven Katovich",
    href: "https://commons.wikimedia.org/wiki/File:Corylus_americana_5497076.jpg",
  },
  {
    title: "Photo by Juhanson",
    href: "https://commons.wikimedia.org/wiki/File:Raspberries_(Rubus_Idaeus).jpg",
  },
  {
    title: "Photo by Jasper Shide",
    href: "https://commons.wikimedia.org/wiki/File:Kalmia_latifolia_-_Mountain_Laurel_02.jpg",
  },
];

export default {
  name: "Explorer",
  components: {
    Range,
    Checkbox,
    Header,
    Menu,
  },
  props: {
    favorites: {
      type: Boolean,
      default: false,
    },
    questions: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    const filters = [
      {
        name: "States",
        label: "States",
        choices: [],
        value: [],
        array: true,
        counts: {},
        initiallyOpen: false,
        alwaysOpen: false,
        showIcon: false,
      },
      {
        name: "Superplant",
        label: "Super Plant",
        choices: ["Super Plant"],
        value: [],
        array: true,
        counts: {},
        initiallyOpen: true,
        alwaysOpen: true,
      },
      {
        name: "Sun Exposure Flags",
        label: "Sun Exposure",
        value: [],
        array: true,
        counts: {},
      },
      {
        name: "Soil Moisture Flags",
        label: "Soil Moisture",
        value: [],
        array: true,
        counts: {},
      },
      {
        name: "Plant Type Flags",
        label: "Plant Type",
        value: [],
        array: true,
        counts: {},
      },
      {
        name: "Life Cycle Flags",
        label: "Life Cycle",
        value: [],
        array: true,
        counts: {},
      },
      {
        name: "Pollinator Flags",
        label: "Pollinators",
        value: [],
        array: true,
        counts: {},
      },
      {
        name: "Flower Color Flags",
        label: "Flower Color",
        value: [],
        array: true,
        counts: {},
        color: true,
      },
      {
        name: "Availability Flags",
        label: "Availability",
        value: [],
        array: true,
        counts: {},
      },
      {
        name: "Flowering Months",
        range: true,
        double: true,
        choices: [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec",
        ],
        min: 0,
        max: 11,
        exponent: 1.0,
        value: {
          min: 0,
          max: 11,
        },
      },
      {
        name: "Height (feet)",
        range: true,
        double: false,
        choices: [],
        min: 0,
        max: 0,
        exponent: 3.0,
        value: {
          min: 0,
          max: 0,
        },
      },
      {
        name: "Showy",
        label: "Showy",
        choices: ["Showy"],
        value: [],
        array: true,
        counts: {},
      },
    ];
    const sorts = Object.entries({
      "Sort by Recommendation Score": "Recommendation Score",
      "Sort by Common Name (A-Z)": "Common Name (A-Z)",
      "Sort by Common Name (Z-A)": "Common Name (Z-A)",
      "Sort by Scientific Name (A-Z)": "Scientific Name (A-Z)",
      "Sort by Scientific Name (Z-A)": "Scientific Name (Z-A)",
    }).map(([value, label]) => ({ value, label }));

    this.defaultFilterValues = getDefaultFilterValues(filters);

    const questionDetails = [
      {
        name: "flowers",
        type: "boolean",
        def: "1",
        filter(value) {
          // QUIZ_FLOWER: Field "Plant Type" contains "Graminoid" or "Herb" or "Shrub" or "Vine" and Field "Showy" = "Yes"
          return value
            ? {
                "Plant Type Flags": ["Graminoid", "Herb", "Shrub", "Vine"],
                Showy: ["Showy"],
              }
            : {};
        },
        title: "Do you want flowers?",
      },
      {
        name: "perennial",
        type: "boolean",
        def: "1",
        filter() {
          return {
            "Life Cycle Flags": ["Perennial"],
          };
        },
        title:
          "Do you want the plant to show up in your garden every year, without having to buy it again?",
      },
      {
        name: "sunny",
        type: "boolean",
        def: "1",
        filter() {
          return {};
        },
        title: "Is your garden sunny?",
      },
      {
        name: "shady",
        type: "boolean",
        def: "1",
        filter(value, others) {
          const exposure = [];
          if (value) {
            exposure.push("Shade");
          }
          if (others.sunny) {
            exposure.push("Sun");
          }
          if (value && others.sunny) {
            exposure.push("Part Shade");
          }
          if (exposure.length) {
            return {
              "Sun Exposure": exposure,
            };
          } else {
            return {};
          }
        },
        title: "Is your garden shady?",
      },
      {
        name: "puddle",
        type: "boolean",
        def: "1",
        filter() {
          return {};
        },
        title: "Does your garden puddle when it rains?",
      },
      {
        name: "dry",
        type: "boolean",
        def: "1",
        filter() {
          return {};
        },
        title: "Does your garden ever looked cracked or dry?",
      },
      {
        name: "moist",
        type: "boolean",
        def: "1",
        filter(value, others) {
          if (others.puddle) {
            return {
              "Soil Moisture": "Wet",
            };
          } else if (others.dry) {
            return {
              "Soil Moisture": "Dry",
            };
          } else if (value) {
            return {
              "Soil Moisture": "Moist",
            };
          }
        },
        title:
          "Is your garden a little damp when you stick your finger in the ground?",
      },
      {
        name: "bees",
        type: "boolean",
        def: "1",
        filter() {
          return {};
        },
        title: "Do you want to attract bees?",
      },
      {
        name: "butterflies",
        type: "boolean",
        def: "1",
        filter() {
          return {};
        },
        title: "Do you want to attract butterflies?",
      },
      {
        name: "hummingbirds",
        type: "boolean",
        def: "1",
        filter(value, others) {
          const flags = [];
          if (others.bees) {
            flags.push("Native Bees");
            flags.push("Bombus");
            flags.push("Honey Bees");
            flags.push("Nesting and Structure (Bees)");
          }
          if (others.butterflies) {
            flags.push("Butterflies");
            flags.push("Larval Host (Butterfly)");
          }
          if (value) {
            flags.push("Hummingbirds");
          }
          if (flags.length) {
            return {
              "Pollinator Flags": flags,
            };
          } else {
            return {};
          }
        },
        title: "Do you want to attract hummingbirds?",
      },
      {
        name: "online",
        type: "boolean",
        def: "1",
        filter() {
          return {};
        },
        title: "Do you want to buy your plants online?",
      },
      {
        name: "local",
        type: "boolean",
        def: "1",
        filter(value, others) {
          const availabilityFlags = [];
          if (others.online) {
            availabilityFlags.push("Online");
          }
          if (value) {
            availabilityFlags.push("Local");
          }
          return {
            AvailabilityFlags: availabilityFlags,
          };
        },
        title: "Do you want to buy your plants at a local store?",
      },
    ];

    this.initQuestionValues(questionDetails);

    const twoUpIndex = Math.floor(Math.random() * twoUpImageCredits.length);
    return {
      results: [],
      total: 0,
      q: "",
      activeSearch: "",
      sort: "Sort by Recommendation Score",
      filters,
      filterValues: { ...this.defaultFilterValues },
      filterIsOpen: Object.fromEntries(
        filters.map((filter) => [filter.name, filter.initiallyOpen || false])
      ),
      filterCounts: Object.fromEntries(
        filters.map((filter) => [filter.name, {}])
      ),
      filtersOpen: false,
      zipCode: "",
      displayLocation: "",
      updatingCounts: false,
      selected: null,
      localStoreLinks: [],
      sorts,
      sortIsOpen: false,
      monthIsOpen: false,
      question: 0,
      questionDetails,
      twoUpIndex,
    };
  },
  computed: {
    questionsHeroIndex() {
      return (this.twoUpIndex + this.question + 1) % twoUpImageCredits.length;
    },
    questionsClasses() {
      return {
        questions: 1,
        first: !this.question,
      };
    },
    selectedName() {
      return this.$route.params.name;
    },
    extras() {
      if (typeof window === "undefined") {
        return [];
      }
      const min = Math.floor((window.innerWidth - 300) / 200);
      let extras = [];
      for (let i = 0; i <= min; i++) {
        extras.push({ _id: i });
      }
      return extras;
    },
    chips() {
      return this.getChips(true);
    },
    flags() {
      return this.getChips(false);
    },
    activeFilters() {
      const result = this.filters.filter((filter) => {
        const value = this.filterValues[filter.name];
        if (filter.range) {
          if (value.min !== filter.min || value.max !== filter.max) {
            return true;
          }
        } else if (filter.array) {
          return value.length > 0;
        } else {
          return value !== filter.default;
        }
      });
      return result;
    },
    sortButtonClasses() {
      return {
        "list-button": true,
      };
      // Creates unresolved design issues
      // ...(this.favorites && {
      //   primary: true,
      //   'primary-bar': true
      // })
    },
    onlineStoreLinks() {
      return this.selected["Online Stores"];
    },
    favoritesAvailable() {
      return !![...this.$store.state.favorites].length;
    },
    currentMonthLabel() {
      const questionDetail = this.questionDetails.find(
        (questionDetail) => questionDetail.name === "month"
      );
      const choice = questionDetail.choices.find(
        (choice) => choice.value === questionDetail.value
      );
      return choice.label;
    },
    mainClasses() {
      return {
        "filters-open": this.filtersOpen,
      };
    },
  },
  watch: {
    selectedName() {
      this.fetchSelectedIfNeeded();
    },
    favorites() {
      this.determineFilterCountsAndSubmit();
    },
    questions() {
      if (this.questions) {
        this.filterValues = { ...this.defaultFilterValues };
        this.determineFilterCountsAndSubmit();
        this.question = 0;
        this.initQuestionValues(this.questionDetails);
      }
    },
    sortIsOpen() {
      this.$store.commit("setSortIsOpen", this.sortIsOpen);
    },
    monthIsOpen() {
      this.$store.commit("setMonthIsOpen", this.monthIsOpen);
    },
    sort() {
      this.submit();
    },
    filterValues: {
      handler() {
        if (this.isDesktop()) {
          this.submit();
        } else {
          this.updateCounts();
        }
      },
      deep: true,
    },
  },
  // Server only
  async serverPrefetch() {
    await this.determineFilterCountsAndSubmit();
    await this.fetchPage();
  },
  async postData(url = "", data = {}) {
    // Default options are marked with *
    const response = await fetch(url, {
      method: "POST", // *GET, POST, PUT, DELETE, etc.
      headers: {
        "Content-Type": "application/json",
        // 'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: JSON.stringify(data), // body data type must match "Content-Type" header
    });
    return response.json(); // parses JSON response into native JavaScript objects
  },
  // Browser only
  async mounted() {
    this.displayLocation = localStorage.getItem("displayLocation")
    this.zipCode= localStorage.getItem("zipCode")
    this.filterValues["States"] = [localStorage.getItem("state")]
    if ("geolocation" in navigator || this.zipCode == '') {
      navigator.geolocation.getCurrentPosition(async (position) => {
        let data = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        //get zipcode by lng/lat
        //get state by lng / lat
        const response = await fetch("/get-zip", {
          method: "POST", // *GET, POST, PUT, DELETE, etc.
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data), // body data type must match "Content-Type" header
        });
        let json = await response.json();
        this.zipCode = json.code;
        this.filterValues["States"] = [json.state];
        this.taisplayLocation = `${json.city}, ${json.state}`;
      });
    } else {
      console.log("Location not supported");
    }

    await this.determineFilterCountsAndSubmit();
    await this.fetchSelectedIfNeeded();
  },
  destroy() {
    document.body.removeEventListener("click", this.bodyClick);
  },
  methods: {
    async setLocation() {
      this.zipCode = prompt("Please enter your zipcode");
      if (!this.zipCode) return;
      if (/^\\d{5}$/.test(this.zipCode)) {
        alert("Zipcode must be 5 digits");
        return;
      }
      const response = await fetch("/get-city", {
        method: "POST", // *GET, POST, PUT, DELETE, etc.
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ zipCode: this.zipCode }), // body data type must match "Content-Type" header
      });
      let json = await response.json();
      this.filterValues["States"] = [json.state];
      this.displayLocation = `${json.city}, ${json.state}`;
      localStorage.setItem("displayLocation", this.displayLocation)
      localStorage.setItem("zipCode", this.zipCode)
      localStorage.setItem("state", json.state)
    },
    async getVendors() {
      if (!this.selected) return [];
      const data = {
        plantName: this.selected._id,
        zipCode: this.zipCode,
        radius: 1000,
        limit: 5,
      };
      const response = await fetch("/get-vendors", {
        method: "POST", // *GET, POST, PUT, DELETE, etc.
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data), // body data type must match "Content-Type" header
      });
      let vendors = await response.json();
      this.localStoreLinks = vendors.map((v) => {
        return {
          label: v.storeName,
          url: v.storeUrl,
          distance: v.distance.toFixed(1),
        };
      });
    },
    getChips(active) {
      const chips = [];
      if (active && this.activeSearch.length) {
        chips.push({
          name: "Search",
          label: this.activeSearch,
          key: "Search",
          svg: "Search",
        });
      }
      for (const filter of active ? this.activeFilters : this.filters) {
        let value = active
          ? this.filterValues[filter.name]
          : this.selected[filter.name];
        if (filter.array) {
          value = value || [];
          if (value === true) {
            value = [filter.label];
          }
          if (filter.name === "Flower Color Flags") {
            value.forEach((item) => {
              chips.push({
                name: filter.name,
                label: item,
                color: item,
                key: filter.name + ":" + item,
              });
            });
          } else {
            value.forEach((item) => {
              chips.push({
                name: filter.name,
                label: item,
                svg: item,
                key: filter.name + ":" + item,
              });
            });
          }
        } else if (filter.range) {
          if (active) {
            chips.push({
              name: filter.name,
              svg: filter.name,
              label: filter.label || filter.name,
              key: filter.name,
            });
          }
        } else {
          chips.push({
            name: filter.name,
            label: value,
            svg: filter.name,
            key: filter.name,
          });
        }
      }
      return chips;
    },
    selectedImageStyle(selected) {
      return `background-image: url("${this.imageUrl(selected, false)}")`;
    },
    imageStyle(image) {
      return `background: linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.4) 60.94%, rgba(0, 0, 0, 0.4) 100%), url("${this.imageUrl(
        image,
        true
      )}"); background-size: cover`;
    },
    async fetchSelectedIfNeeded() {
      if (!this.selectedName) {
        this.selected = null;
        this.$store.commit("setSelectedIsOpen", false);
      } else {
        // Could be optimized away in some cases, but not all
        // (direct links from Google for example), so let's stick to
        // what definitely works for now
        const response = await fetch(`/api/v1/plants/${this.selectedName}`);
        this.selected = await response.json();
        this.getVendors();
        this.$store.commit("setSelectedIsOpen", true);
      }
    },
    async determineFilterCountsAndSubmit() {
      await this.determineFilterCounts();
      this.submit();
    },
    async determineFilterCounts() {
      this.initializing = true;
      if (!this.determinedFilterCounts) {
        const response = await fetch("/api/v1/plants?results=0&total=0");
        const data = await response.json();
        this.filterCounts = data.counts;
        for (const filter of this.filters) {
          filter.choices = data.choices[filter.name];
        }
        const height = this.filters.find(
          (filter) => filter.name === "Height (feet)"
        );
        height.min = 0;
        const heights = data.choices["Height (feet)"];
        height.max = heights[heights.length - 1];
        this.filterValues["Height (feet)"].max = height.max;
        this.determinedFilterCounts = true;
      }
      this.initializing = false;
      this.submit();
    },
    imageUrl(result, preview) {
      if (result.hasImage) {
        if (preview) {
          return `/images/${result._id}.preview.jpg`;
        } else {
          return `/images/${result._id}.jpg`;
        }
      } else {
        return "/assets/images/missing-image.png";
      }
    },
    openFilters() {
      this.filtersOpen = true;
    },
    submit() {
      if (this.loading) {
        // Prevent race condition
        setTimeout(this.submit, 500);
        return;
      }
      if (this.submitTimeout) {
        clearTimeout(this.submitTimeout);
        this.submitTimeout = null;
      }
      this.submitTimeout = setTimeout(submit.bind(this), 250);
      function submit() {
        this.page = 0;
        this.loadedAll = false;
        this.results = [];
        this.total = 0;
        this.restartLoadMoreIfNeeded();
        this.filtersOpen = false;
        this.submitTimeout = null;
      }
    },
    async updateCounts() {
      // Debounce so we don't refresh like mad when dragging a range end
      if (this.updatingCounts) {
        if (this.updatingCountsTimeout) {
          clearTimeout(this.updatingCountsTimeout);
        }
        this.updatingCountsTimeout = setTimeout(() => this.updateCounts(), 250);
        return;
      }
      this.updatingCounts = true;
      try {
        const params = {
          ...this.filterValues,
          q: this.q,
          sort: this.sort,
        };
        if (this.initializing) {
          return;
        }
        const response = await fetch("/api/v1/plants?" + qs.stringify(params));
        const data = await response.json();
        this.filterCounts = data.counts;
        this.activeSearch = this.q;
      } finally {
        this.updatingCounts = false;
      }
    },
    async fetchPage() {
      this.loading = true;
      if (this.favorites && ![...this.$store.state.favorites].length) {
        // Avoid a query that would result in seeing all of the plants
        // in the database as "favorites"
        this.results = [];
        this.loadedAll = true;
        this.total = 0;
        this.loading = false;
        return;
      }
      const params = this.favorites
        ? {
            favorites: [...this.$store.state.favorites],
            sort: this.sort,
          }
        : {
            ...this.filterValues,
            q: this.q,
            sort: this.sort,
            page: this.page,
          };
      this.activeSearch = this.q;
      if (this.initializing) {
        // Don't send a bogus query for min 0 max 0
        delete params["Height (feet)"];
      }
      const response = await fetch("/api/v1/plants?" + qs.stringify(params));
      const data = await response.json();
      if (!this.favorites) {
        this.filterCounts = data.counts;
        for (const filter of this.filters) {
          filter.choices = data.choices[filter.name];
        }
      }
      if (!data.results.length || this.favorites || this.questions) {
        this.loadedAll = true;
      }
      data.results.forEach((datum) => this.results.push(datum));
      this.total = data.total;
      this.loading = false;
    },
    async restartLoadMoreIfNeeded() {
      if (this.loadTimeout) {
        clearTimeout(this.loadTimeout);
      }
      this.loadTimeout = setTimeout(loadMoreIfNeeded.bind(this), 500);
      async function loadMoreIfNeeded() {
        if (typeof window === "undefined") {
          // server side, not appropriate
          return;
        }
        if (!this.$el.closest("body")) {
          // Component unmounted, don't waste energy
          return;
        }
        // Stay a full screen ahead
        if (
          !this.loadedAll &&
          !this.loading &&
          window.scrollY + window.innerHeight * 3 > document.body.clientHeight
        ) {
          // this.$refs.afterTable.getBoundingClientRect().top)) {
          this.page++;
          await this.fetchPage();
        }
        this.loadTimeout = setTimeout(loadMoreIfNeeded.bind(this), 500);
      }
    },
    removeChip(chip) {
      if (chip.name === "Search") {
        this.q = "";
      } else {
        const filter = this.filters.find((filter) => filter.name === chip.name);
        if (filter.array) {
          this.filterValues[chip.name] = this.filterValues[chip.name].filter(
            (value) => value !== chip.label
          );
        } else {
          this.filterValues[chip.name] = filter.default;
        }
      }
      this.submit();
    },
    clearAll() {
      for (const filter of this.filters) {
        this.filterValues[filter.name] = filter.default;
      }
      this.q = "";
      this.submit();
    },
    toggleSort() {
      this.sortIsOpen = !this.sortIsOpen;
    },
    toggleMonth() {
      this.monthIsOpen = !this.monthIsOpen;
    },
    sortLabel(sort) {
      return this.sorts.find((_sort) => _sort.value === sort).label;
    },
    filterClass(filter) {
      if (this.filterIsOpen[filter.name]) {
        return "active";
      } else {
        return null;
      }
    },
    toggleFilter(filter) {
      if (filter.alwaysOpen === true) {
        return;
      }
      this.filterIsOpen[filter.name] = !this.filterIsOpen[filter.name];
    },
    flowerColorStyle(choice) {
      const customColors = {
        Cream: "#FFFDD0",
        Lilac: "#C8A2C8",
        Rose: "#FF0080",
      };
      return {
        "background-color": customColors[choice] || choice,
      };
    },
    chipColor(chip) {
      if (chip.color) {
        return this.flowerColorStyle(chip.color);
      } else {
        return "";
      }
    },
    isDesktop() {
      // Must match CSS media query below
      return window.innerWidth >= 1280;
    },
    toggleFavorite(_id) {
      this.$store.commit("toggleFavorite", _id);
      if (this.favorites) {
        this.results = this.results.filter((result) => result._id !== _id);
      }
    },
    renderFavorite(_id) {
      return this.$store.state.favorites.has(_id)
        ? "favorite"
        : "favorite_outline";
    },
    questionClasses(index) {
      if (this.question === index) {
        return "question active-question";
      } else {
        return "question inactive-question";
      }
    },
    nextQuestion() {
      this.question = this.question + 1;
    },
    endQuestions() {
      for (const questionDetail of this.questionDetails) {
        const filters = questionDetail.filter(
          questionDetail.value,
          Object.fromEntries(
            this.questionDetails.map((questionDetail) => [
              questionDetail.name,
              questionDetail.value,
            ])
          )
        );
        for (const [name, value] of Object.entries(filters)) {
          this.filterIsOpen[name] = true;
          this.filterValues[name] = value;
        }
      }
      this.$router.push("/");
    },
    quitQuestions() {
      this.$router.push("/");
    },
    initQuestionValues(questionDetails) {
      for (const questionDetail of questionDetails) {
        questionDetail.value = questionDetail.def;
      }
    },
    twoUpImage(index) {
      return `background-image: url(/assets/images/two-up/${index}.jpg`;
    },
    twoUpImageCredit(index) {
      return twoUpImageCredits[index];
    },
    credit(plant) {
      const extmetadata = plant?.metadata?.extmetadata || {};
      return {
        artist: extmetadata?.Artist?.value || "",
        license: extmetadata?.LicenseShortName?.value || "",
        licenseUrl: extmetadata?.LicenseUrl?.value || "",
      };
    },
    flagGroups(flags) {
      const groups = [];
      for (const flag of flags) {
        const matches = flag.label.match(/^(.*)?\s*\((.*)?\)$/);
        let groupTitle = matches ? matches[1] : "";
        let flagName = matches ? matches[2] : flag.label;
        let group = groups.find((group) => group.title === groupTitle);
        if (!group) {
          group = {
            title: groupTitle,
            flags: [],
          };
          groups.push(group);
        }
        group.flags.push({
          ...flag,
          label: flagName,
        });
      }
      return groups;
    },
    plantLink(plant) {
      return `/plants/${plant["Scientific Name"]}`;
    },
  },
};

function getDefaultFilterValues(filters) {
  return Object.fromEntries(
    filters.map((filter) => {
      const value = [filter.name, filter.value];
      filter.default = filter.value;
      delete filter.value;
      return value;
    })
  );
}
</script>

<style scoped>
#app {
  font-family: Roboto;
  margin: auto;
  background-color: #fcf9f4;
  padding: 32px;
}

main {
  padding: 0 32px;
}

.inner-controls {
  position: sticky;
  z-index: 100;
  /* Sticky offset */
  top: 0;
  background-color: #fcf9f4;
}

.inner-controls .go {
  display: flex;
  gap: 16px;
}

.inner-controls button.clear {
  color: #b74d15;
  background-color: inherit;
}

button {
  background-color: #fcf9f4;
  color: #b74d15;
  border: 1px solid #b74d15;
  border-radius: 8px;
  padding: 12px;
  font-size: 17px;
  font-family: Roboto;
}

button.primary {
  background-color: #b74d15;
  color: #fcf9f4;
}

button.text {
  background-color: inherit;
  color: inherit;
  font-family: inherit;
  font-size: inherit;
  border: none;
  padding: 5px;
  border-radius: 0;
}
.enter-location {
  font-style: italic;
  text-align: center;
  padding: 5px;
}
.chips button.clear {
  text-decoration: underline;
  font-size: 16px;
  transform: translate(0, 0);
}

.primary-bar {
  display: block;
  width: 100%;
  max-width: 350px;
  margin: auto;
  margin-bottom: 11px;
}

.sort-and-favorites {
  max-width: 350px;
  margin: auto;
  display: flex;
  justify-content: space-between;
  margin-bottom: 16px;
}

button.favorites {
  width: 100%;
  display: block;
  margin-bottom: 24px;
  flex-basis: 0;
  flex-grow: 0;
  margin-right: 24px;
}

button.favorites[disabled] {
  opacity: 0.5;
}

button.favorites .favorites-label {
  display: none;
}

.list-button {
  position: relative;
  display: flex;
  flex-direction: row;
  width: 100%;
}

.list-button > *:last-child {
  margin-left: auto;
}

.list-button .label {
  position: absolute;
  font-size: 80%;
  top: calc(-8px + -0.25em);
  padding: 4px;
  background-color: #fcf9f4;
}

.primary.list-button .label {
  background-color: #b74d15;
  color: #fcf9f4;
}

.sort {
  position: relative;
  flex-grow: 1;
}

.sort .value {
  color: #1d2e26;
  font-family: Roboto;
}

.chips {
  margin-bottom: 32px;
  text-align: left;
  line-height: 1.5;
  white-space: nowrap;
  overflow: scroll;
  /* https://stackoverflow.com/quick-search/36230944/prevent-flex-items-from-overflowing-a-container */
  min-width: 0;
}

.chip {
  display: inline-block;
  border-radius: 30px;
  margin: 0px 8px 16px 0;
  letter-spacing: 0.1em;
}

.chip img {
  /* Tinted to match our text color: https://codepen.io/sosuke/pen/Pjoqqp */
  filter: invert(41%) sepia(98%) saturate(5459%) hue-rotate(19deg)
    brightness(89%) contrast(84%);
  width: 24px;
  height: 24px;
  padding: 4px;
  margin-right: 8px;
  border-radius: 50%;
  border: 1px solid #b74d15;
  vertical-align: middle;
}

.chip-color {
  display: inline-block;
  width: 24px;
  height: 24px;
  margin-right: 8px;
  border-radius: 50%;
  border: 1px solid #b74d15;
  vertical-align: middle;
}

.chip-label,
.chip .material-icons {
  display: inline-block;
  transform: translate(0, 2px);
}

.chip .material-icons {
  margin-left: 8px;
}

h1 {
  font-family: Arvo;
  font-weight: 400;
  font-size: 32px;
  text-align: center;
  margin-bottom: 2em;
}

.color-example {
  display: inline-block;
  width: 24px;
  height: 24px;
  border: 1px solid black;
  border-radius: 12px;
}

.choice-icon {
  display: inline-block;
  width: 24px;
  height: 24px;
}

label {
  display: inline-block;
  font-size: 16px;
  margin: 0 0 16px 0;
}

label .text {
  transform: translate(0, 3px);
}

label:last-child {
  margin: 0;
}

input {
  display: inline-block;
}
img {
  max-width: 500px;
  display: block;
}
table {
  margin-top: 2em;
}
td,
th {
  padding: 1em;
  border: 1px solid #def;
}

.range span.min,
.range span.max {
  display: inline-block;
  border-radius: 1em;
  width: 1em;
  height: 1em;
  color: blue;
  cursor: pointer;
}
.range span.between {
  display: inline-block;
  width: 1em;
  height: 1em;
  color: gray;
}
.chips-and-plants {
  flex-grow: 1;
  min-width: 0;
}
.plants {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(248px, 1fr));
  gap: 8px;
  align-content: start;
}
.plant-preview-wrapper {
  position: relative;
  aspect-ratio: 1/1;
}
.plant-preview {
  position: relative;
  border-radius: 8px;
}
.photo {
  width: 100%;
  aspect-ratio: 1/1;
  border-radius: 8px 8px 0 0;
}
.names {
  position: absolute;
  top: calc(50% - 16px);
  left: 16px;
  margin: 0;
  padding: 0;
  font-size: 14px;
  font-family: Lato;
  color: white;
}
.common-name {
  font-size: 14px;
  margin: 0;
  padding: 0;
  font-weight: normal;
}
.scientific-name {
  font-size: 12px;
  font-style: italic;
  margin: 0;
  padding: 0;
  font-weight: normal;
}
.plant-controls-wrapper {
  position: absolute;
  width: 100%;
  bottom: 0px;
  background-color: white;
}
.plant-controls {
  width: 100%;
  font-family: Lato;
  font-size: 14px;
  border: 1px solid #b74d15;
  border-top: none;
  border-radius: 0 0 8px 8px;
  color: #b74d15;
  padding: 8px 8px 2px;
  height: 32px;
  display: flex;
  justify-content: space-between;
}
.plant-controls .text {
  margin: 0;
  letter-spacing: 0.1em;
}
.plant-controls a.text {
  color: inherit;
  text-decoration: none;
}
.favorite-large {
  display: none;
}
.filters {
  flex-direction: column;
  max-width: 350px;
  margin: 32px 0;
}
.filters fieldset {
  background-color: white;
  display: flex;
  flex-direction: column;
  color: #1d2e26;
  border: 1px solid #1d2e26;
  border-radius: 8px;

  margin-bottom: 24px;
  padding: 16px 10px;
}
.filters fieldset label {
  display: flex;
  justify-content: space-between;
  font-family: Roboto;
}
.filters fieldset:last-child {
  margin-bottom: 0;
}
.filters fieldset {
  background-color: #fbecd0;
}

.filters fieldset.active {
  background-color: white;
}

.filters fieldset .fieldset-toggle {
  font-size: 18px;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  font-family: Lato;
  margin: 0;
  letter-spacing: 0.1em;
  font-weight: normal;
  background-color: inherit;
  color: inherit;
  border: none;
  border-radius: 0;
  padding: 0;
}
.filters fieldset.active .fieldset-toggle {
  color: #1d2e26;
  font-weight: bold;
  margin-bottom: 24px;
}
.filters fieldset input {
  border: 0;
  padding: 0;
  font-size: inherit;
}
.search-mobile-box {
  display: flex;
  height: 32px;
  margin-bottom: 8px;
  width: 100%;
  border-bottom: 1px solid rgb(192, 192, 192);
}
.search-mobile-box .material-icons {
  transform: translate(0, 6px);
}
.search-mobile {
  font-size: 16px;
  padding: 0 0 0 8px;
  background: inherit;
  flex-grow: 1;
  border: none;
}
.search-desktop-parent {
  display: none;
}
.text {
  padding-left: 8px;
  user-select: none;
}
.filters {
  display: none;
}
.filters-open .filter-toggle-and-sort {
  display: none;
}
.filters-open .filters {
  display: flex;
}
@media all and (max-width: 480px) {
  #app {
    padding: 0;
  }
  .plant-controls {
    font-size: 12px;
  }
  .plants {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 8px;
    flex-direction: column;
  }
}
.filter-contents {
  user-select: none;
  display: flex;
}
.two-up.large-help {
  display: none;
}
.not-large-help {
  max-width: 320px;
  text-align: center;
  width: 50%;
  margin: auto;
  font-size: 12px;
  line-height: 16px;
  font-family: Roboto;
  margin-bottom: 18px;
}
.not-large-help a {
  color: inherit;
}
.not-large-help button {
  width:100%;
}

.total-matches {
  text-align: center;
}

.questions-page main {
  padding: 0;
}

.questions {
  display: flex;
  flex-direction: column;
  margin: auto;
  padding-top: 48px;
  background-color: #b74d15;
  text-align: center;
  font-family: Roboto;
}

.questions.first {
  padding-top: 0;
}

.questions-prologue {
  background-image: url("/assets/images/questions-prologue-background.png");
  background-repeat: no-repeat;
  background-size: cover;
  padding: 72px 32px;
}

.questions-prologue p {
  color: white;
  font-size: 20px;
  font-family: Arvo;
  font-weight: 700;
}

.question {
  flex-grow: 1;
  border-radius: 16px 16px 0 0;
  background-color: #fcf9f4;
  padding: 0 32px;
}

.question .radio-inputs {
  display: flex;
  flex-direction: column;
  font-size: 18px;
}

.question .radio-inputs label {
  display: flex;
  justify-content: center;
  margin-bottom: 32px;
}

.question .radio-inputs .label {
  width: 3em;
}

.question .month {
  margin-bottom: 48px;
}

/* https://moderncss.dev/pure-css-custom-styled-radio-buttons/ */

.question input[type="radio"] {
  -webkit-appearance: none;
  appearance: none;
  background-color: #fcf9f4;
  margin: 0;
  font: inherit;
  color: #b74d15;
  width: 1.15em;
  height: 1.15em;
  border: 0.15em solid #b74d15;
  border-radius: 50%;
  display: grid;
  place-content: center;
}

.question input[type="radio"]::before {
  content: "";
  width: 0.65em;
  height: 0.65em;
  border-radius: 50%;
  transform: scale(0);
  transition: 120ms transform ease-in-out;
  box-shadow: inset 1em 1em #b74d15;
}

.question input[type="radio"]:checked::before {
  transform: scale(1);
}

.question h4 {
  font-weight: normal;
  font-size: 24px;
}

.question .month {
  position: relative;
}

.inactive-question {
  display: none;
}

.question-buttons,
.next-back,
.show-back {
  display: flex;
  flex-direction: column;
}

.question-buttons button {
  margin-bottom: 48px;
}

.modal-bar {
  padding: 12px;
  height: 56px;
  text-align: center;
  border-bottom: 1px solid black;
  position: relative;
}
.modal-bar .title {
  display: block;
  transform: translate(0, 4px);
  font-family: Arvo;
  font-size: 20px;
  font-weight: normal;
}
.modal-bar .close-nav {
  position: absolute;
  font-size: 24px;
  top: 16px;
  right: 16px;
  text-decoration: none;
  color: black;
}

.selected {
  position: fixed;
  top: 0px;
  left: 0px;
  width: 100%;
  height: 100vh;
  background-color: #fcf9f4;
  z-index: 1100;
  overflow: scroll;
}

.favorite-selected > * {
  color: #b74d15;
  font-weight: normal;
}

.selected .two-up h1 {
  font-family: Arvo;
  font-size: 24px;
  margin: 16px 0 4px 0;
  text-align: left;
}

.favorite-selected.text {
  display: block;
  position: absolute;
  top: 40px;
  right: 8px;
  font-size: 16px;
}

.selected .two-up h2 {
  font-size: 20px;
  font-family: Roboto;
  line-height: 1;
  margin: 0 0 24px;
}

.selected .two-up h3 {
  font-size: 20px;
  font-family: Roboto;
  line-height: 1;
  font-weight: 500;
  margin: 0 0 8px 0;
}

.selected .two-up h4 {
  font-size: 20px;
  font-family: Roboto;
  line-height: 1;
  font-weight: normal;
  margin: 0 0 8px 0;
}

.selected .two-up p {
  font-size: 16px;
  font-family: Lato;
  line-height: 20px;
  margin: 0 0 16px 0;
}

.two-up {
  display: flex;
}

.two-up-image,
.questions-decoration {
  position: relative;
}

.two-up-credit {
  display: none;
}

.selected .two-up .two-up-image {
  /* flex-basis doesn't do the job at least on iPhone */
  min-height: 40vh;
}

.two-up-text {
  box-sizing: border-box;
  padding: 24px;
  position: relative;
}

.two-up h2 {
  font-family: Arvo;
  font-weight: normal;
  font-size: 36px;
  max-width: 460px;
  line-height: 48px;
  margin: 0;
  padding: 0;
}

.two-up p {
  max-width: 560px;
  color: #1d2e26;
  font-size: 16px;
  font-family: Roboto;
  font-weight: normal;
  line-height: 24px;
}

.two-up p ::v-deep a {
  color: #b74d15;
}

.two-up > * {
  color: #b74d15;
  flex-grow: 1;
  flex-basis: 0;
  height: 380px;
  background-color: white;
  background-size: cover;
  background-position: center;
}

.selected .two-up {
  height: calc(100vh - 96px);
}

.selected .two-up {
  flex-direction: column;
}

.selected .two-up > * {
  background-color: #fcf9f4;
  color: black;
  height: auto;
}

.two-up .chips {
  display: grid;
  overflow: visible;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  white-space: normal;
  font-family: Roboto;
}

.chips .clear {
  font-family: Roboto;
}

.two-up .chips .chip {
  white-space: normal;
  letter-spacing: 0;
  color: #b74d15;
  font-size: 16px;
}

.two-up a.store-link {
  display: block;
  color: #b74d15;
  text-decoration: underline;
  margin-right: 24px;
  padding: 20px 0;
}

.favorite-regular {
  transform: translate(0, -4px);
}

.large {
  display: none;
}
.hide-desk {
  display:none;
}
@media all and (max-width: 1280px) {
  .hide-desk {
    display:block !important;
  }
}
@media all and (min-width: 1280px) {
  .hide-desk {
    display:none !important;
  }
}

@media all and (min-width: 1280px) {
  .sort-and-favorites {
    margin-bottom: 0;
    display: block;
  }
  button.favorites .favorites-label {
    display: inline;
  }
  .two-up.large-help {
    display: flex;
  }
  .not-large-help {
    display: none;
    margin: auto;
    text-align: center;
  }
  .large-help a {
    color: inherit;
  }
  h1 {
    font-size: 60px;
  }
  main {
    display: flex;
    justify-content: space-between;
    gap: 32px;
  }
  .apply {
    display: none;
  }
  main .controls {
    width: 320px;
    letter-spacing: 0.1em;
  }
  main .controls button {
    letter-spacing: 0.1em;
  }
  .inner-controls {
    position: static;
    z-index: auto;
    top: auto;
  }
  .inner-controls .clear {
    /* Chips have one and it is always visible at this size */
    display: none;
  }
  .filters {
    margin-bottom: 100%;
  }
  .filters fieldset {
    padding: 16px;
  }
  main .plants {
    flex-grow: 1;
    gap: 32px;
  }
  .filter {
    display: none;
  }
  .filter-toggle-and-sort {
    padding: 0 0 24px;
  }
  .filters-open .filter-toggle-and-sort {
    display: block;
  }
  .filters {
    display: flex;
  }
  .filters.inactive-question {
    display: none;
  }
  .search-mobile-box {
    display: none;
  }
  .search-desktop-parent {
    display: flex;
    justify-content: right;
    padding: 24px 32px;
  }
  .search-desktop {
    display: flex;
    min-width: 400px;
    padding: 16px;
    border-radius: 8px;
    border: 1px solid #1d2e26;
  }
  .search-desktop button {
    padding: 0;
  }
  .search-desktop button:disabled {
    opacity: 0.5;
  }
  .search-desktop .material-icons {
    padding: 0 8px;
  }
  .search-desktop input {
    font-size: 16px;
    height: auto;
    background-color: inherit;
    padding: 0;
    border: 0;
    width: 100%;
  }
  .search-desktop input:focus {
    outline: none;
  }
  .search-desktop::placeholder {
    font-style: italic;
  }
  .plant-controls-wrapper {
    background-color: #b74d15;
  }
  .plant-controls {
    color: white;
    padding: 16px 8px 0 4px;
    height: 48px;
  }
  .plant-controls a.text {
    color: white;
  }
  .favorite-regular {
    display: none;
  }
  .favorite-large.text {
    display: block;
    position: absolute;
    bottom: 64px;
    right: 16px;
    margin: 0;
    padding: 0;
    font-size: 24px;
    font-weight: normal;
    color: white;
  }
  .two-up-text {
    padding: 40px;
  }

  .selected {
    overflow: hidden;
  }

  .selected .two-up-text {
    overflow: scroll;
  }

  .selected .two-up h1,
  .selected .two-up h2,
  .selected .two-up h3,
  .selected .two-up h4 {
    font-family: Roboto;
    text-align: left;
  }

  .selected .two-up h1 {
    font-family: Roboto;
    font-size: 40px;
    margin: 0 0 12px 0;
  }

  .selected .two-up h2 {
    font-size: 24px;
    margin: 0 0 32px 0;
  }

  .selected .two-up h3 {
    font-size: 24px;
    font-weight: 500;
    margin: 24px 0 8px 0;
  }

  .selected .two-up p {
    font-size: 20px;
    line-height: 24px;
    margin: 0 0 16px 0;
  }

  .favorite-selected.text {
    top: 40px;
    right: 32px;
    font-size: 40px;
    height: 48px;
    color: #b74d15;
  }
  button.text {
    letter-spacing: 0.1em;
  }
  .common-name {
    font-size: 16px;
  }
  .scientific-name {
    font-size: 16px;
  }
  .modal-bar {
    padding: 12px;
    height: 48px;
    text-align: center;
    border-bottom: 1px solid black;
    position: relative;
  }
  .modal-bar .title {
    font-family: Arvo;
    font-size: 20px;
    line-height: 24px;
    font-weight: normal;
    vertical-align: middle;
    transform: translate(0, 0);
  }
  .modal-bar .close-nav {
    position: absolute;
    font-size: 40px;
    right: 8px;
    text-decoration: none;
    color: black;
    transform: translate(0, -12px);
  }
  .selected {
    flex-direction: row;
    width: calc(100vw - 64px);
    height: calc(100vh - 32px);
    margin: 16px 32px;
  }
  .selected .two-up {
    height: auto;
  }
  .selected .info {
    order: 1;
    flex-basis: 0;
    flex-grow: 1;
  }
  .selected .photo {
    order: 2;
    flex-basis: 0;
    flex-grow: 1;
  }
  .selected .two-up {
    flex-direction: row;
    height: 100%;
  }
  .selected .two-up-image {
    order: 2;
  }
  .selected .two-up-text {
    order: 1;
  }
  .chips {
    /* Per Cristina desktop chips wrap, they do not scroll */
    white-space: normal;
    overflow: visible;
    height: auto;
  }
  .questions-box {
    display: flex;
    flex-direction: row;
    width: 100%;
    height: calc(100vh - 140px);
  }
  .questions-box > * {
    flex-basis: 0;
    flex-grow: 1;
  }
  .questions-decoration {
    background-size: cover;
  }
  .questions {
    background-color: #fcf9f4;
    color: #1d2e26;
  }
  .questions-prologue {
    background: none;
    background-color: #fcf9f4;
    padding: 40px 32px 0;
  }
  .questions-prologue h1 {
    font-family: Arvo;
    font-size: 60px;
    margin: 16px 0;
  }
  .questions-prologue p {
    font-family: Roboto;
    font-weight: 400;
    font-size: 20px;
    color: #1d2e26;
  }
  .questions form {
    width: 70%;
    margin: auto;
  }
  .next-back {
    flex-direction: row;
    gap: 32px;
  }
  .next-back > button {
    flex-grow: 1;
    flex-basis: 0;
  }
  .next-back .back {
    order: 1;
  }
  .next-back .next {
    order: 2;
  }
  .small {
    display: none;
  }
  .large {
    display: block;
  }
  h1.large.favorites {
    margin-bottom: 1em;
  }

  .two-up-credit {
    display: block;
    position: absolute;
    right: 1em;
    bottom: 1em;
    font-family: Lato;
    font-size: 12px;
  }

  .two-up-credit a,
  .large-help .two-up-credit a {
    text-decoration: none;
    color: white;
    background: none;
    text-shadow: 0px 0px 2px black;
  }
}
</style>
