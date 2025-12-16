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
      <div class="search-with-autocomplete">
        <form class="search-desktop" @submit.prevent="handleSearchSubmit">
          <span class="material-icons">search</span>
          <input 
            v-model="q" 
            id="q" 
            placeholder="Search plants or your garden needs"
            maxlength="200"
            @keydown.enter.prevent="handleSearchSubmit"
            @input="handleSearchInput"
            @focus="showAutocomplete = true"
            @blur="handleSearchBlur"
          />
          <button type="button" class="text" :disabled="q.length == 0" @click.prevent="handleSearchSubmit">
            <span class="material-icons">chevron_right</span>
          </button>
        </form>
        
        <!-- Autocomplete Dropdown for Desktop -->
        <div 
          v-if="showAutocomplete && autocompleteResults.sections.length > 0 && isDesktop()" 
          class="autocomplete-dropdown"
          ref="autocompleteDropdown"
        >
          <div 
            v-for="section in autocompleteResults.sections" 
            :key="section.filterName || section.type"
            class="autocomplete-section"
          >
            <div class="autocomplete-section-header">
              <img 
                v-if="section.type === 'filter' && section.items.length > 0"
                :src="`/assets/images/${section.items[0].svg}.svg`"
                class="section-icon"
                :alt="section.label"
              />
              <span class="section-label">{{ section.label }}</span>
            </div>
            <div 
              v-for="item in section.items" 
              :key="item.value || item.plantId"
              class="autocomplete-item"
              @mousedown.prevent="handleAutocompleteSelect(item)"
            >
              <!-- For filter items -->
              <template v-if="item.action === 'applyFilter'">
                <img 
                  v-if="item.svg"
                  :src="`/assets/images/${item.svg}.svg`"
                  class="autocomplete-item-icon"
                  :alt="item.value"
                />
                <span class="autocomplete-item-text">{{ item.displayText }}</span>
              </template>
              
              <!-- For plant items -->
              <template v-else-if="item.action === 'navigateToPlant'">
                <span class="autocomplete-item-text">
                  <template v-if="item.commonName && item.scientificName">
                    <template v-if="highlightMatch(item.commonName, q).match">
                      <span>{{ highlightMatch(item.commonName, q).before }}</span><strong>{{ highlightMatch(item.commonName, q).match }}</strong><span>{{ highlightMatch(item.commonName, q).after }}</span>
                    </template>
                    <span v-else>{{ item.commonName }}</span>
                    <span class="autocomplete-item-subtitle">(
                      <template v-if="highlightMatch(item.scientificName, q).match">
                        <span>{{ highlightMatch(item.scientificName, q).before }}</span><strong>{{ highlightMatch(item.scientificName, q).match }}</strong><span>{{ highlightMatch(item.scientificName, q).after }}</span>
                      </template>
                      <span v-else>{{ item.scientificName }}</span>
                    )</span>
                  </template>
                  <template v-else>
                    <strong>{{ item.displayText }}</strong>
                    <span v-if="item.subtitle" class="autocomplete-item-subtitle">({{ item.subtitle }})</span>
                  </template>
                </span>
              </template>
            </div>
          </div>
        </div>
      </div>
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
    <main :class="mainClasses" ref="mainContent">
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
        <div v-if="favorites" class="copy-clipboard" aria-live="polite">
          <button 
            class="primary primary-bar copy-button" 
            :class="{ 'copied': isCopied }" 
            @click="copyFavorites"
            :disabled="isCopied"
          >
            <span v-if="isCopied">✓ Copied!</span>
            <span v-else>Copy to Clipboard</span>
          </button>
          <button
            class="primary primary-bar planner-button"
            :disabled="!favoritesAvailable"
            @click="favoritesAvailable && $router.push('/planner')"
          >
            Garden Planner
          </button>
        </div>
        <form
          v-if="!favorites"
          class="filters"
          id="form"
          @submit.prevent="handleSearchSubmit"
          >
            <div class="inner-controls">
              <div class="search-mobile-wrapper">
                <div class="search-mobile-box">
                  <span class="material-icons">search</span>
                  <input
                    v-model="q"
                    id="q-mobile"
                    type="text"
                    class="search-mobile"
                    placeholder="Search plants or your garden needs"
                    maxlength="200"
                    @keydown.enter.prevent="handleSearchSubmit"
                    @input="handleSearchInput"
                    @focus="showAutocomplete = true"
                    @blur="handleSearchBlur"
                  />
                </div>
                
                <!-- Autocomplete Dropdown for Mobile -->
                <div 
                  v-if="showAutocomplete && autocompleteResults.sections.length > 0 && !isDesktop()" 
                  class="autocomplete-dropdown autocomplete-dropdown-mobile"
                  ref="autocompleteDropdownMobile"
                >
                  <div 
                    v-for="section in autocompleteResults.sections" 
                    :key="section.filterName || section.type"
                    class="autocomplete-section"
                  >
                    <div class="autocomplete-section-header">
                      <img 
                        v-if="section.type === 'filter' && section.items.length > 0"
                        :src="`/assets/images/${section.items[0].svg}.svg`"
                        class="section-icon"
                        :alt="section.label"
                      />
                      <span class="section-label">{{ section.label }}</span>
                    </div>
                    <div 
                      v-for="item in section.items" 
                      :key="item.value || item.plantId"
                      class="autocomplete-item"
                      @mousedown.prevent="handleAutocompleteSelect(item)"
                    >
                      <!-- For filter items -->
                      <template v-if="item.action === 'applyFilter'">
                        <img 
                          v-if="item.svg"
                          :src="`/assets/images/${item.svg}.svg`"
                          class="autocomplete-item-icon"
                          :alt="item.value"
                        />
                        <span class="autocomplete-item-text">{{ item.displayText }}</span>
                      </template>
                      
                      <!-- For plant items -->
                      <template v-else-if="item.action === 'navigateToPlant'">
                        <span class="autocomplete-item-text">
                          <template v-if="item.commonName && item.scientificName">
                            <template v-if="highlightMatch(item.commonName, q).match">
                              <span>{{ highlightMatch(item.commonName, q).before }}</span><strong>{{ highlightMatch(item.commonName, q).match }}</strong><span>{{ highlightMatch(item.commonName, q).after }}</span>
                            </template>
                            <span v-else>{{ item.commonName }}</span>
                            <span class="autocomplete-item-subtitle">(
                              <template v-if="highlightMatch(item.scientificName, q).match">
                                <span>{{ highlightMatch(item.scientificName, q).before }}</span><strong>{{ highlightMatch(item.scientificName, q).match }}</strong><span>{{ highlightMatch(item.scientificName, q).after }}</span>
                              </template>
                              <span v-else>{{ item.scientificName }}</span>
                            )</span>
                          </template>
                          <template v-else>
                            <strong>{{ item.displayText }}</strong>
                            <span v-if="item.subtitle" class="autocomplete-item-subtitle">({{ item.subtitle }})</span>
                          </template>
                        </span>
                      </template>
                    </div>
                  </div>
                </div>
              </div>
              <div class="go">
                <button class="primary primary-bar clear" @click="clearAll">
                  Clear
                </button>
                <button class="primary primary-bar apply" type="button" @click="handleSearchSubmit">
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
              :class="['chip', { 'chip-preview': chip.preview }]"
              v-for="chip in chips"
              v-bind:key="chip.key"
              @click="chip.preview ? activatePreviewChip(chip) : removeChip(chip)"
            >
              <img
                v-if="!chip.color && chip.svg"
                :src="`/assets/images/${chip.svg}.svg`"
                class="choice-icon"
              />
              <span v-if="chip.color" class="chip-color" :style="chipColor(chip)"></span>
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
    // Base sorts - will be extended in computed property when search is active
    const baseSorts = Object.entries({
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

    const twoUpIndex = 0;
    return {
      results: [],
      total: 0,
      q: "",
      activeSearch: "",
      sort: "Sort by Recommendation Score",
      previousSort: "Sort by Recommendation Score", // Store previous sort before Search Relevance
      filters,
      componentKey: 0, // Add a key for forcing re-renders
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
      manualZip: false,
      updatingCounts: false,
      selected: null,
      localStoreLinks: [],
      baseSorts,
      sortIsOpen: false,
      monthIsOpen: false,
      question: 0,
      questionDetails,
      twoUpIndex,
      isCopied: false,
      showAutocomplete: false,
      autocompleteResults: { query: "", sections: [] },
      autocompleteTimeout: null,
      hasExtractedFilters: false,
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
    sorts() {
      // Include "Sort by Search Relevance" only when there's an active search and not in favorites mode
      if (this.activeSearch && this.activeSearch.trim() && !this.favorites) {
        return [
          ...this.baseSorts,
          { value: "Sort by Search Relevance", label: "Search Relevance" }
        ];
      }
      return this.baseSorts;
    },
    hasSearchChip() {
      // Check if there's a search chip (activeSearch exists, has content, and no filters were extracted)
      // Match the same logic as getChips which checks activeSearch.length
      // Explicitly check for empty string or falsy values
      if (!this.activeSearch) {
        return false;
      }
      if (typeof this.activeSearch !== 'string') {
        return false;
      }
      const trimmed = this.activeSearch.trim();
      if (trimmed.length === 0) {
        return false;
      }
      // Only return true if we have a non-empty search AND no filters were extracted
      return !this.hasExtractedFilters;
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
    previewFiltersFromQuery() {
      if (!this.q || (this.activeSearch && this.q.trim() === this.activeSearch.trim())) {
        // Don't show preview if query matches the active search (already submitted)
        return {};
      }
      return this.parseNaturalLanguageFromQuery(this.q);
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
      // Don't clear activeSearch when changing sort
      // The search chip will disappear automatically (handled by getChips())
      // Filter chips remain intact regardless of sort change
      this.submit();
    },
    activeSearch(newVal) {
      // If search is cleared and we're sorting by Search Relevance, restore previous sort
      if (!newVal || !newVal.trim()) {
        // Close sort dropdown if it's open
        if (this.sortIsOpen) {
          this.sortIsOpen = false;
        }
        if (this.sort === "Sort by Search Relevance") {
          this.sort = this.previousSort;
        }
      } else {
        // When a search is activated, check if there's remaining query text for semantic search
        // Only switch to Search Relevance if there's remaining text (not just extracted filters) and not in favorites mode
        const remainingQuery = this.getRemainingQueryText(newVal);
        if (remainingQuery && remainingQuery.trim() && this.sort !== "Sort by Search Relevance" && !this.favorites) {
          // Save current sort as previous before switching
          this.previousSort = this.sort;
          this.sort = "Sort by Search Relevance";
        }
      }
    },
    hasExtractedFilters(newVal, oldVal) {
      // If filters are extracted, only restore previous sort if there's no semantic search content
      // (i.e., if activeSearch is empty or doesn't have remaining query text after filter extraction)
      if (newVal && !oldVal && this.sort === "Sort by Search Relevance") {
        // Check if activeSearch has semantic content (remaining query after removing trigger words)
        const hasSemanticContent = this.activeSearch && 
                                   this.activeSearch.trim() && 
                                   this.getRemainingQueryText(this.activeSearch).trim();
        // Only change sort back if there's no semantic content to preserve
        if (!hasSemanticContent) {
          this.sort = this.previousSort;
        }
      }
      // If extracted filters are cleared (search chip appears), switch to Search Relevance (but not in favorites mode)
      if (!newVal && oldVal && this.activeSearch && this.activeSearch.trim() && !this.favorites) {
        // Save current sort as previous before switching
        if (this.sort !== "Sort by Search Relevance") {
          this.previousSort = this.sort;
        }
        this.sort = "Sort by Search Relevance";
      }
    },
    filterValues: {
      async handler() {
        if (this.isDesktop()) {
          this.submit();
        } else {
          // First update the counts
          await this.updateCounts();
          // Submit without clearing current results to avoid flicker on mobile
          this.submit();
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
    // Pick a random hero image after hydration to avoid SSR hydration mismatch
    this.twoUpIndex = Math.floor(Math.random() * twoUpImageCredits.length);

    // Ensure activeSearch is cleared on mount (should already be empty, but be explicit)
    if (!this.activeSearch || this.activeSearch.trim().length === 0) {
      this.activeSearch = "";
    }

    this.displayLocation = localStorage.getItem("displayLocation") || "";
    this.zipCode = localStorage.getItem("zipCode") || "";
    this.manualZip = localStorage.getItem("manualZip") === "true";
    this.filterValues["States"] = [localStorage.getItem("state")];

    // Pre-set the default zip code to ensure immediate response
    if (!this.zipCode) {
      this.zipCode = "19355";
    }
    
    if (!this.manualZip && "geolocation" in navigator) {
      // Set loading state
      this.isLoadingLocation = true;
      
      // Use a timeout to limit how long we wait for geolocation
      const geolocationTimeout = setTimeout(() => {
        if (this.isLoadingLocation) {
          // If still loading after timeout, use default
          this.isLoadingLocation = false;
          this.setDefaultZipCode();
        }
      }, 2000); // 2 second timeout
      
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          clearTimeout(geolocationTimeout);
          
          const data = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };

          try {
            const response = await fetch("/get-zip", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(data),
            });
            
            if (!response.ok) {
              throw new Error('Network response was not ok');
            }
            
            let json = await response.json();
            this.zipCode = json.code;
            this.filterValues["States"] = [json.state];
            this.displayLocation = `${json.city}, ${json.state}`;

            localStorage.setItem("zipCode", this.zipCode);
            localStorage.setItem("state", json.state);
            localStorage.setItem("displayLocation", this.displayLocation);
            localStorage.removeItem("manualZip");
            
            // Retry getting vendors if a plant is already selected
            if (this.selected) {
              this.getVendors();
            }
          } catch (error) {
            console.error("Error fetching zip code:", error);
            this.setDefaultZipCode();
          } finally {
            this.isLoadingLocation = false;
          }
        },
        (error) => {
          clearTimeout(geolocationTimeout);
          console.error("Geolocation error:", error);
          this.isLoadingLocation = false;
          
          // Use default zip code if geolocation fails
          this.setDefaultZipCode();
        },
        { timeout: 3000, maximumAge: 60000 } // 3s timeout, cache for 1 minute
      );
    } else if (!this.displayLocation) {
      // Geolocation not available or user chose manual zip
      this.setDefaultZipCode();
    }

    await this.determineFilterCountsAndSubmit();
    await this.fetchSelectedIfNeeded();
  },
  destroy() {
    document.body.removeEventListener("click", this.bodyClick);
  },
  methods: {
    setDefaultZipCode() {
      // Set default zip code to 19355 (Malvern, PA)
      this.zipCode = "19355";
      
      // Get city and state info for this zip code
      fetch("/get-city", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ zipCode: this.zipCode }),
      })
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json();
        })
        .then(json => {
          this.filterValues["States"] = [json.state];
          this.displayLocation = `${json.city}, ${json.state}`;
          
          // Save to localStorage
          localStorage.setItem("zipCode", this.zipCode);
          localStorage.setItem("state", json.state);
          localStorage.setItem("displayLocation", this.displayLocation);
          
          // Retry getting vendors if a plant is already selected
          if (this.selected) {
            this.getVendors();
          }
        })
        .catch(error => {
          console.error("Error fetching city data:", error);
        });
    },
    
    forceUpdate() {
      // Force Vue to re-render by directly calling submit and manipulating the DOM
      this.submit();
      
      // Use Vue's built-in forceUpdate if available (Vue 2)
      if (typeof this.$forceUpdate === 'function') {
        this.$forceUpdate();
      }
      
      // Also force a browser reflow/repaint for good measure
      if (this.$refs.mainContent) {
        const el = this.$refs.mainContent;
        const display = el.style.display;
        el.style.display = 'none';
        // Force a reflow
        void el.offsetHeight;
        el.style.display = display;
      }
    },
    async setLocation() {
      this.zipCode = prompt("Please enter your zipcode");
      if (!this.zipCode) return;
      if (!/^\d{5}$/.test(this.zipCode)) {
        alert("Zipcode must be 5 digits");
        return;
      }
      try {
        const response = await fetch("/get-city", {
          method: "POST", // *GET, POST, PUT, DELETE, etc.
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ zipCode: this.zipCode }), // body data type must match "Content-Type" header
        });
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        let json = await response.json();
        this.filterValues["States"] = [json.state];
        this.displayLocation = `${json.city}, ${json.state}`;
        localStorage.setItem("displayLocation", this.displayLocation)
        localStorage.setItem("zipCode", this.zipCode)
        localStorage.setItem("state", json.state)
        this.manualZip = true;
        localStorage.setItem("manualZip", "true")
        
        // Retry getting vendors if a plant is already selected
        if (this.selected) {
          this.getVendors();
        }
      } catch (error) {
        console.error("Error setting location:", error);
        alert("Error setting location. Please try again.");
      }
    },
    async getVendors() {
      if (!this.selected) return [];
      if (!this.zipCode) {
        // Don't fetch vendors if zipCode isn't set yet (common on mobile during geolocation)
        console.log("Skipping getVendors - zipCode not set yet");
        return;
      }
      const data = {
        plantName: this.selected._id,
        zipCode: this.zipCode,
        radius: 1000,
        limit: 5,
      };
      try {
        const response = await fetch("/get-vendors", {
          method: "POST", // *GET, POST, PUT, DELETE, etc.
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data), // body data type must match "Content-Type" header
        });
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        let vendors = await response.json();
        this.localStoreLinks = vendors.map((v) => {
          return {
            label: v.storeName,
            url: v.storeUrl,
            distance: v.distance.toFixed(1),
          };
        });
      } catch (error) {
        console.error("Error fetching vendors:", error);
        this.localStoreLinks = [];
      }
    },
    parseNaturalLanguageFromQuery(query) {
      if (!query || typeof query !== 'string') {
        return {};
      }
      
      const queryLower = query.toLowerCase().trim();
      const extractedFilters = {};
      
      // Sun Exposure
      if (/\b(shade|shady|full shade|deep shade|shade tolerant)\b/i.test(queryLower)) {
        extractedFilters['Sun Exposure Flags'] = ['Shade'];
      } else if (/\b(sun|sunny|full sun|all day sun)\b/i.test(queryLower)) {
        extractedFilters['Sun Exposure Flags'] = ['Sun'];
      } else if (/\b(part shade|partial shade|partial sun|part sun|filtered light)\b/i.test(queryLower)) {
        extractedFilters['Sun Exposure Flags'] = ['Part Shade'];
      }
      
      // Soil Moisture
      if (/\b(wet|wet soil|wet feet|puddles|rain garden)\b/i.test(queryLower)) {
        extractedFilters['Soil Moisture Flags'] = ['Wet'];
      } else if (/\b(dry|dry soil|cracks|drought|drought tolerant)\b/i.test(queryLower)) {
        extractedFilters['Soil Moisture Flags'] = ['Dry'];
      } else if (/\b(moist|moist soil|slightly moist|damp)\b/i.test(queryLower)) {
        extractedFilters['Soil Moisture Flags'] = ['Moist'];
      }
      
      // Life Cycle
      if (/\b(perennial|perennials)\b/i.test(queryLower)) {
        extractedFilters['Life Cycle Flags'] = ['Perennial'];
      } else if (/\b(annual|annuals)\b/i.test(queryLower)) {
        extractedFilters['Life Cycle Flags'] = ['Annual'];
      } else if (/\b(biennial|biennials)\b/i.test(queryLower)) {
        extractedFilters['Life Cycle Flags'] = ['Biennial'];
      }
      
      // Pollinators
      if (/\b(butterfly|butterflies)\b/i.test(queryLower)) {
        if (!extractedFilters['Pollinator Flags']) {
          extractedFilters['Pollinator Flags'] = [];
        }
        extractedFilters['Pollinator Flags'].push('Butterflies');
      }
      if (/\b(hummingbird|hummingbirds)\b/i.test(queryLower)) {
        if (!extractedFilters['Pollinator Flags']) {
          extractedFilters['Pollinator Flags'] = [];
        }
        extractedFilters['Pollinator Flags'].push('Hummingbirds');
      }
      if (/\b(bees|bee|honey bees|native bees)\b/i.test(queryLower)) {
        if (!extractedFilters['Pollinator Flags']) {
          extractedFilters['Pollinator Flags'] = [];
        }
        extractedFilters['Pollinator Flags'].push('Native Bees');
        extractedFilters['Pollinator Flags'].push('Honey Bees');
      }
      if (/\b(beetle|beetles)\b/i.test(queryLower)) {
        if (!extractedFilters['Pollinator Flags']) {
          extractedFilters['Pollinator Flags'] = [];
        }
        extractedFilters['Pollinator Flags'].push('Beetles');
      }
      if (/\b(bombus|bumblebee|bumblebees|bumble bee|bumble bees)\b/i.test(queryLower)) {
        if (!extractedFilters['Pollinator Flags']) {
          extractedFilters['Pollinator Flags'] = [];
        }
        extractedFilters['Pollinator Flags'].push('Bombus');
      }
      if (/\b(fly|flies)\b/i.test(queryLower)) {
        if (!extractedFilters['Pollinator Flags']) {
          extractedFilters['Pollinator Flags'] = [];
        }
        extractedFilters['Pollinator Flags'].push('Flies');
      }
      if (/\b(monarch butterfly|monarch butterflies)\b/i.test(queryLower)) {
        if (!extractedFilters['Pollinator Flags']) {
          extractedFilters['Pollinator Flags'] = [];
        }
        extractedFilters['Pollinator Flags'].push('Monarchs');
      }
      if (/\b(monarch|monarchs)\b/i.test(queryLower)) {
        if (!extractedFilters['Pollinator Flags']) {
          extractedFilters['Pollinator Flags'] = [];
        }
        extractedFilters['Pollinator Flags'].push('Monarchs');
      }
      if (/\b(moth|moths)\b/i.test(queryLower)) {
        if (!extractedFilters['Pollinator Flags']) {
          extractedFilters['Pollinator Flags'] = [];
        }
        extractedFilters['Pollinator Flags'].push('Moths');
      }
      if (/\b(wasp|wasps)\b/i.test(queryLower)) {
        if (!extractedFilters['Pollinator Flags']) {
          extractedFilters['Pollinator Flags'] = [];
        }
        extractedFilters['Pollinator Flags'].push('Wasps');
      }
      if (/\b(larval host butterfly|larval host butterflies|butterfly host|butterfly hosts)\b/i.test(queryLower)) {
        if (!extractedFilters['Pollinator Flags']) {
          extractedFilters['Pollinator Flags'] = [];
        }
        extractedFilters['Pollinator Flags'].push('Larval Host (Butterfly)');
      }
      if (/\b(larval host monarch|larval host monarchs|monarch host|monarch hosts|monarch waystation)\b/i.test(queryLower)) {
        if (!extractedFilters['Pollinator Flags']) {
          extractedFilters['Pollinator Flags'] = [];
        }
        extractedFilters['Pollinator Flags'].push('Larval Host (Monarch)');
      }
      if (/\b(larval host moth|larval host moths|moth host|moth hosts)\b/i.test(queryLower)) {
        if (!extractedFilters['Pollinator Flags']) {
          extractedFilters['Pollinator Flags'] = [];
        }
        extractedFilters['Pollinator Flags'].push('Larval Host (Moth)');
      }
      if (/\b(nesting bees|nesting structure bees|bee nesting|bee nesting structure|nesting and structure bees)\b/i.test(queryLower)) {
        if (!extractedFilters['Pollinator Flags']) {
          extractedFilters['Pollinator Flags'] = [];
        }
        extractedFilters['Pollinator Flags'].push('Nesting And Structure (Bees)');
      }
      
      // Plant Type
      if (/\b(tree|trees)\b/i.test(queryLower)) {
        extractedFilters['Plant Type Flags'] = ['Tree'];
      }
      if (/\b(shrub|shrubs|bush|bushes)\b/i.test(queryLower)) {
        if (!extractedFilters['Plant Type Flags']) {
          extractedFilters['Plant Type Flags'] = [];
        }
        extractedFilters['Plant Type Flags'].push('Shrub');
      }
      if (/\b(vine|vines|climbing|trellis)\b/i.test(queryLower)) {
        if (!extractedFilters['Plant Type Flags']) {
          extractedFilters['Plant Type Flags'] = [];
        }
        extractedFilters['Plant Type Flags'].push('Vine');
      }
      if (/\b(grass|grasses|graminoid)\b/i.test(queryLower)) {
        if (!extractedFilters['Plant Type Flags']) {
          extractedFilters['Plant Type Flags'] = [];
        }
        extractedFilters['Plant Type Flags'].push('Graminoid');
      }
      if (/\b(herb|herbs)\b/i.test(queryLower)) {
        if (!extractedFilters['Plant Type Flags']) {
          extractedFilters['Plant Type Flags'] = [];
        }
        extractedFilters['Plant Type Flags'].push('Herb');
      }
      
      // Flower Color
      if (/\b(yellow|yellow flowers)\b/i.test(queryLower)) {
        extractedFilters['Flower Color Flags'] = ['Yellow'];
      }
      if (/\b(red|red flowers)\b/i.test(queryLower)) {
        if (!extractedFilters['Flower Color Flags']) {
          extractedFilters['Flower Color Flags'] = [];
        }
        extractedFilters['Flower Color Flags'].push('Red');
      }
      if (/\b(purple|purple flowers|violet)\b/i.test(queryLower)) {
        if (!extractedFilters['Flower Color Flags']) {
          extractedFilters['Flower Color Flags'] = [];
        }
        extractedFilters['Flower Color Flags'].push('Purple');
      }
      if (/\b(orange|orange flowers)\b/i.test(queryLower)) {
        if (!extractedFilters['Flower Color Flags']) {
          extractedFilters['Flower Color Flags'] = [];
        }
        extractedFilters['Flower Color Flags'].push('Orange');
      }
      if (/\b(pink|pink flowers)\b/i.test(queryLower)) {
        if (!extractedFilters['Flower Color Flags']) {
          extractedFilters['Flower Color Flags'] = [];
        }
        extractedFilters['Flower Color Flags'].push('Pink');
      }
      if (/\b(white|white flowers)\b/i.test(queryLower)) {
        if (!extractedFilters['Flower Color Flags']) {
          extractedFilters['Flower Color Flags'] = [];
        }
        extractedFilters['Flower Color Flags'].push('White');
      }
      if (/\b(blue|blue flowers)\b/i.test(queryLower)) {
        if (!extractedFilters['Flower Color Flags']) {
          extractedFilters['Flower Color Flags'] = [];
        }
        extractedFilters['Flower Color Flags'].push('Blue');
      }
      
      // Other filters
      if (/\b(showy|showy flowers)\b/i.test(queryLower)) {
        extractedFilters['Showy'] = ['Showy'];
      }
      if (/\b(super plant|superplant)\b/i.test(queryLower)) {
        extractedFilters['Superplant'] = ['Super Plant'];
      }
      
      // States
      if (/\b(alabama|al|al native|alabama native)\b/i.test(queryLower)) {
        if (!extractedFilters['States']) {
          extractedFilters['States'] = [];
        }
        extractedFilters['States'].push('AL');
      }
      if (/\b(alaska|ak|ak native|alaska native)\b/i.test(queryLower)) {
        if (!extractedFilters['States']) {
          extractedFilters['States'] = [];
        }
        extractedFilters['States'].push('AK');
      }
      if (/\b(arizona|az|az native|arizona native)\b/i.test(queryLower)) {
        if (!extractedFilters['States']) {
          extractedFilters['States'] = [];
        }
        extractedFilters['States'].push('AZ');
      }
      if (/\b(arkansas|ar|ar native|arkansas native)\b/i.test(queryLower)) {
        if (!extractedFilters['States']) {
          extractedFilters['States'] = [];
        }
        extractedFilters['States'].push('AR');
      }
      if (/\b(california|ca|ca native|california native)\b/i.test(queryLower)) {
        if (!extractedFilters['States']) {
          extractedFilters['States'] = [];
        }
        extractedFilters['States'].push('CA');
      }
      if (/\b(colorado|co|co native|colorado native)\b/i.test(queryLower)) {
        if (!extractedFilters['States']) {
          extractedFilters['States'] = [];
        }
        extractedFilters['States'].push('CO');
      }
      if (/\b(connecticut|ct|ct native|connecticut native)\b/i.test(queryLower)) {
        if (!extractedFilters['States']) {
          extractedFilters['States'] = [];
        }
        extractedFilters['States'].push('CT');
      }
      if (/\b(delaware|de|de native|delaware native)\b/i.test(queryLower)) {
        if (!extractedFilters['States']) {
          extractedFilters['States'] = [];
        }
        extractedFilters['States'].push('DE');
      }
      if (/\b(district of columbia|dc|dc native|district of columbia native|washington dc|washington d\.c\.)\b/i.test(queryLower)) {
        if (!extractedFilters['States']) {
          extractedFilters['States'] = [];
        }
        extractedFilters['States'].push('DC');
      }
      if (/\b(florida|fl|fl native|florida native)\b/i.test(queryLower)) {
        if (!extractedFilters['States']) {
          extractedFilters['States'] = [];
        }
        extractedFilters['States'].push('FL');
      }
      if (/\b(georgia|ga|ga native|georgia native)\b/i.test(queryLower)) {
        if (!extractedFilters['States']) {
          extractedFilters['States'] = [];
        }
        extractedFilters['States'].push('GA');
      }
      if (/\b(hawaii|hi|hi native|hawaii native)\b/i.test(queryLower)) {
        if (!extractedFilters['States']) {
          extractedFilters['States'] = [];
        }
        extractedFilters['States'].push('HI');
      }
      if (/\b(idaho|id|id native|idaho native)\b/i.test(queryLower)) {
        if (!extractedFilters['States']) {
          extractedFilters['States'] = [];
        }
        extractedFilters['States'].push('ID');
      }
      if (/\b(illinois|il|il native|illinois native)\b/i.test(queryLower)) {
        if (!extractedFilters['States']) {
          extractedFilters['States'] = [];
        }
        extractedFilters['States'].push('IL');
      }
      if (/\b(indiana|in|in native|indiana native)\b/i.test(queryLower)) {
        if (!extractedFilters['States']) {
          extractedFilters['States'] = [];
        }
        extractedFilters['States'].push('IN');
      }
      if (/\b(iowa|ia|ia native|iowa native)\b/i.test(queryLower)) {
        if (!extractedFilters['States']) {
          extractedFilters['States'] = [];
        }
        extractedFilters['States'].push('IA');
      }
      if (/\b(kansas|ks|ks native|kansas native)\b/i.test(queryLower)) {
        if (!extractedFilters['States']) {
          extractedFilters['States'] = [];
        }
        extractedFilters['States'].push('KS');
      }
      if (/\b(kentucky|ky|ky native|kentucky native)\b/i.test(queryLower)) {
        if (!extractedFilters['States']) {
          extractedFilters['States'] = [];
        }
        extractedFilters['States'].push('KY');
      }
      if (/\b(louisiana|la|la native|louisiana native)\b/i.test(queryLower)) {
        if (!extractedFilters['States']) {
          extractedFilters['States'] = [];
        }
        extractedFilters['States'].push('LA');
      }
      if (/\b(maine|me|me native|maine native)\b/i.test(queryLower)) {
        if (!extractedFilters['States']) {
          extractedFilters['States'] = [];
        }
        extractedFilters['States'].push('ME');
      }
      if (/\b(maryland|md|md native|maryland native)\b/i.test(queryLower)) {
        if (!extractedFilters['States']) {
          extractedFilters['States'] = [];
        }
        extractedFilters['States'].push('MD');
      }
      if (/\b(massachusetts|ma|ma native|massachusetts native)\b/i.test(queryLower)) {
        if (!extractedFilters['States']) {
          extractedFilters['States'] = [];
        }
        extractedFilters['States'].push('MA');
      }
      if (/\b(michigan|mi|mi native|michigan native)\b/i.test(queryLower)) {
        if (!extractedFilters['States']) {
          extractedFilters['States'] = [];
        }
        extractedFilters['States'].push('MI');
      }
      if (/\b(minnesota|mn|mn native|minnesota native)\b/i.test(queryLower)) {
        if (!extractedFilters['States']) {
          extractedFilters['States'] = [];
        }
        extractedFilters['States'].push('MN');
      }
      if (/\b(mississippi|ms|ms native|mississippi native)\b/i.test(queryLower)) {
        if (!extractedFilters['States']) {
          extractedFilters['States'] = [];
        }
        extractedFilters['States'].push('MS');
      }
      if (/\b(missouri|mo|mo native|missouri native)\b/i.test(queryLower)) {
        if (!extractedFilters['States']) {
          extractedFilters['States'] = [];
        }
        extractedFilters['States'].push('MO');
      }
      if (/\b(montana|mt|mt native|montana native)\b/i.test(queryLower)) {
        if (!extractedFilters['States']) {
          extractedFilters['States'] = [];
        }
        extractedFilters['States'].push('MT');
      }
      if (/\b(nebraska|ne|ne native|nebraska native)\b/i.test(queryLower)) {
        if (!extractedFilters['States']) {
          extractedFilters['States'] = [];
        }
        extractedFilters['States'].push('NE');
      }
      if (/\b(nevada|nv|nv native|nevada native)\b/i.test(queryLower)) {
        if (!extractedFilters['States']) {
          extractedFilters['States'] = [];
        }
        extractedFilters['States'].push('NV');
      }
      if (/\b(new hampshire|nh|nh native|new hampshire native)\b/i.test(queryLower)) {
        if (!extractedFilters['States']) {
          extractedFilters['States'] = [];
        }
        extractedFilters['States'].push('NH');
      }
      if (/\b(new jersey|nj|nj native|new jersey native)\b/i.test(queryLower)) {
        if (!extractedFilters['States']) {
          extractedFilters['States'] = [];
        }
        extractedFilters['States'].push('NJ');
      }
      if (/\b(new mexico|nm|nm native|new mexico native)\b/i.test(queryLower)) {
        if (!extractedFilters['States']) {
          extractedFilters['States'] = [];
        }
        extractedFilters['States'].push('NM');
      }
      if (/\b(new york|ny|ny native|new york native)\b/i.test(queryLower)) {
        if (!extractedFilters['States']) {
          extractedFilters['States'] = [];
        }
        extractedFilters['States'].push('NY');
      }
      if (/\b(north carolina|nc|nc native|north carolina native)\b/i.test(queryLower)) {
        if (!extractedFilters['States']) {
          extractedFilters['States'] = [];
        }
        extractedFilters['States'].push('NC');
      }
      if (/\b(north dakota|nd|nd native|north dakota native)\b/i.test(queryLower)) {
        if (!extractedFilters['States']) {
          extractedFilters['States'] = [];
        }
        extractedFilters['States'].push('ND');
      }
      if (/\b(ohio|oh|oh native|ohio native)\b/i.test(queryLower)) {
        if (!extractedFilters['States']) {
          extractedFilters['States'] = [];
        }
        extractedFilters['States'].push('OH');
      }
      if (/\b(oklahoma|ok|ok native|oklahoma native)\b/i.test(queryLower)) {
        if (!extractedFilters['States']) {
          extractedFilters['States'] = [];
        }
        extractedFilters['States'].push('OK');
      }
      if (/\b(oregon|or|or native|oregon native)\b/i.test(queryLower)) {
        if (!extractedFilters['States']) {
          extractedFilters['States'] = [];
        }
        extractedFilters['States'].push('OR');
      }
      if (/\b(pennsylvania|pa|pa native|pennsylvania native)\b/i.test(queryLower)) {
        if (!extractedFilters['States']) {
          extractedFilters['States'] = [];
        }
        extractedFilters['States'].push('PA');
      }
      if (/\b(rhode island|ri|ri native|rhode island native)\b/i.test(queryLower)) {
        if (!extractedFilters['States']) {
          extractedFilters['States'] = [];
        }
        extractedFilters['States'].push('RI');
      }
      if (/\b(south carolina|sc|sc native|south carolina native)\b/i.test(queryLower)) {
        if (!extractedFilters['States']) {
          extractedFilters['States'] = [];
        }
        extractedFilters['States'].push('SC');
      }
      if (/\b(south dakota|sd|sd native|south dakota native)\b/i.test(queryLower)) {
        if (!extractedFilters['States']) {
          extractedFilters['States'] = [];
        }
        extractedFilters['States'].push('SD');
      }
      if (/\b(tennessee|tn|tn native|tennessee native)\b/i.test(queryLower)) {
        if (!extractedFilters['States']) {
          extractedFilters['States'] = [];
        }
        extractedFilters['States'].push('TN');
      }
      if (/\b(texas|tx|tx native|texas native)\b/i.test(queryLower)) {
        if (!extractedFilters['States']) {
          extractedFilters['States'] = [];
        }
        extractedFilters['States'].push('TX');
      }
      if (/\b(utah|ut|ut native|utah native)\b/i.test(queryLower)) {
        if (!extractedFilters['States']) {
          extractedFilters['States'] = [];
        }
        extractedFilters['States'].push('UT');
      }
      if (/\b(vermont|vt|vt native|vermont native)\b/i.test(queryLower)) {
        if (!extractedFilters['States']) {
          extractedFilters['States'] = [];
        }
        extractedFilters['States'].push('VT');
      }
      if (/\b(virginia|va|va native|virginia native)\b/i.test(queryLower)) {
        if (!extractedFilters['States']) {
          extractedFilters['States'] = [];
        }
        extractedFilters['States'].push('VA');
      }
      if (/\b(washington|wa|wa native|washington native)\b/i.test(queryLower)) {
        if (!extractedFilters['States']) {
          extractedFilters['States'] = [];
        }
        extractedFilters['States'].push('WA');
      }
      if (/\b(west virginia|wv|wv native|west virginia native)\b/i.test(queryLower)) {
        if (!extractedFilters['States']) {
          extractedFilters['States'] = [];
        }
        extractedFilters['States'].push('WV');
      }
      if (/\b(wisconsin|wi|wi native|wisconsin native)\b/i.test(queryLower)) {
        if (!extractedFilters['States']) {
          extractedFilters['States'] = [];
        }
        extractedFilters['States'].push('WI');
      }
      if (/\b(wyoming|wy|wy native|wyoming native)\b/i.test(queryLower)) {
        if (!extractedFilters['States']) {
          extractedFilters['States'] = [];
        }
        extractedFilters['States'].push('WY');
      }
      
      // Availability
      if (/\b(local|local store|local nursery|nearby|near me|in store|brick and mortar)\b/i.test(queryLower)) {
        if (!extractedFilters['Availability Flags']) {
          extractedFilters['Availability Flags'] = [];
        }
        extractedFilters['Availability Flags'].push('Local');
      }
      if (/\b(online|online store|buy online|order online|shipping|delivery|ecommerce)\b/i.test(queryLower)) {
        if (!extractedFilters['Availability Flags']) {
          extractedFilters['Availability Flags'] = [];
        }
        extractedFilters['Availability Flags'].push('Online');
      }
      
      return extractedFilters;
    },
    getRemainingQueryText(query) {
      // Calculate remaining query text after removing matched filter keywords
      if (!query || typeof query !== 'string') {
        return '';
      }
      
      const queryLower = query.toLowerCase().trim();
      let remainingQuery = query;
      
      // Map of regex patterns to their matched keywords (in order of specificity)
      // Longer/more specific patterns should be checked first
      const keywordPatterns = [
        // Sun Exposure - most specific first
        { pattern: /\b(part shade|partial shade|partial sun|part sun|filtered light)\b/gi, keyword: 'part shade' },
        { pattern: /\b(full shade|deep shade|shade tolerant)\b/gi, keyword: 'full shade' },
        { pattern: /\b(full sun|all day sun)\b/gi, keyword: 'full sun' },
        { pattern: /\b(shade|shady)\b/gi, keyword: 'shade' },
        { pattern: /\b(sun|sunny)\b/gi, keyword: 'sun' },
        
        // Soil Moisture
        { pattern: /\b(wet soil|wet feet|puddles|rain garden)\b/gi, keyword: 'wet soil' },
        { pattern: /\b(dry soil|cracks|drought|drought tolerant)\b/gi, keyword: 'dry soil' },
        { pattern: /\b(moist soil|slightly moist|damp)\b/gi, keyword: 'moist soil' },
        { pattern: /\b(wet)\b/gi, keyword: 'wet' },
        { pattern: /\b(dry)\b/gi, keyword: 'dry' },
        { pattern: /\b(moist)\b/gi, keyword: 'moist' },
        
        // Life Cycle
        { pattern: /\b(perennial|perennials)\b/gi, keyword: 'perennial' },
        { pattern: /\b(annual|annuals)\b/gi, keyword: 'annual' },
        { pattern: /\b(biennial|biennials)\b/gi, keyword: 'biennial' },
        
        // Pollinators - order from most specific to least specific
        { pattern: /\b(monarch butterfly|monarch butterflies)\b/gi, keyword: 'monarch butterfly' },
        { pattern: /\b(larval host butterfly|larval host butterflies|butterfly host|butterfly hosts)\b/gi, keyword: 'larval host butterfly' },
        { pattern: /\b(larval host monarch|larval host monarchs|monarch host|monarch hosts|monarch waystation)\b/gi, keyword: 'larval host monarch' },
        { pattern: /\b(larval host moth|larval host moths|moth host|moth hosts)\b/gi, keyword: 'larval host moth' },
        { pattern: /\b(nesting bees|nesting structure bees|bee nesting|bee nesting structure|nesting and structure bees)\b/gi, keyword: 'nesting bees' },
        { pattern: /\b(honey bees|native bees)\b/gi, keyword: 'honey bees' },
        { pattern: /\b(bumblebee|bumblebees|bumble bee|bumble bees)\b/gi, keyword: 'bumblebee' },
        { pattern: /\b(butterfly|butterflies)\b/gi, keyword: 'butterfly' },
        { pattern: /\b(hummingbird|hummingbirds)\b/gi, keyword: 'hummingbird' },
        { pattern: /\b(beetle|beetles)\b/gi, keyword: 'beetle' },
        { pattern: /\b(bombus)\b/gi, keyword: 'bombus' },
        { pattern: /\b(fly|flies)\b/gi, keyword: 'fly' },
        { pattern: /\b(monarch|monarchs)\b/gi, keyword: 'monarch' },
        { pattern: /\b(moth|moths)\b/gi, keyword: 'moth' },
        { pattern: /\b(wasp|wasps)\b/gi, keyword: 'wasp' },
        { pattern: /\b(bees|bee)\b/gi, keyword: 'bees' },
        
        // Plant Type
        { pattern: /\b(tree|trees)\b/gi, keyword: 'tree' },
        { pattern: /\b(shrub|shrubs|bush|bushes)\b/gi, keyword: 'shrub' },
        { pattern: /\b(vine|vines|climbing|trellis)\b/gi, keyword: 'vine' },
        { pattern: /\b(grass|grasses|graminoid)\b/gi, keyword: 'grass' },
        { pattern: /\b(herb|herbs)\b/gi, keyword: 'herb' },
        
        // Flower Color
        { pattern: /\b(yellow flowers)\b/gi, keyword: 'yellow flowers' },
        { pattern: /\b(red flowers)\b/gi, keyword: 'red flowers' },
        { pattern: /\b(purple flowers|violet)\b/gi, keyword: 'purple flowers' },
        { pattern: /\b(orange flowers)\b/gi, keyword: 'orange flowers' },
        { pattern: /\b(pink flowers)\b/gi, keyword: 'pink flowers' },
        { pattern: /\b(white flowers)\b/gi, keyword: 'white flowers' },
        { pattern: /\b(blue flowers)\b/gi, keyword: 'blue flowers' },
        { pattern: /\b(yellow)\b/gi, keyword: 'yellow' },
        { pattern: /\b(red)\b/gi, keyword: 'red' },
        { pattern: /\b(purple)\b/gi, keyword: 'purple' },
        { pattern: /\b(orange)\b/gi, keyword: 'orange' },
        { pattern: /\b(pink)\b/gi, keyword: 'pink' },
        { pattern: /\b(white)\b/gi, keyword: 'white' },
        { pattern: /\b(blue)\b/gi, keyword: 'blue' },
        
        // States - most specific first (full state name + native variations, then abbreviations)
        { pattern: /\b(pennsylvania native|pa native)\b/gi, keyword: 'pennsylvania native' },
        { pattern: /\b(new york native|ny native)\b/gi, keyword: 'new york native' },
        { pattern: /\b(new jersey native|nj native)\b/gi, keyword: 'new jersey native' },
        { pattern: /\b(north carolina native|nc native)\b/gi, keyword: 'north carolina native' },
        { pattern: /\b(south carolina native|sc native)\b/gi, keyword: 'south carolina native' },
        { pattern: /\b(north dakota native|nd native)\b/gi, keyword: 'north dakota native' },
        { pattern: /\b(south dakota native|sd native)\b/gi, keyword: 'south dakota native' },
        { pattern: /\b(new hampshire native|nh native)\b/gi, keyword: 'new hampshire native' },
        { pattern: /\b(new mexico native|nm native)\b/gi, keyword: 'new mexico native' },
        { pattern: /\b(west virginia native|wv native)\b/gi, keyword: 'west virginia native' },
        { pattern: /\b(rhode island native|ri native)\b/gi, keyword: 'rhode island native' },
        { pattern: /\b(district of columbia native|washington dc native|washington d\.c\. native)\b/gi, keyword: 'district of columbia native' },
        { pattern: /\b(pennsylvania)\b/gi, keyword: 'pennsylvania' },
        { pattern: /\b(new york)\b/gi, keyword: 'new york' },
        { pattern: /\b(new jersey)\b/gi, keyword: 'new jersey' },
        { pattern: /\b(north carolina)\b/gi, keyword: 'north carolina' },
        { pattern: /\b(south carolina)\b/gi, keyword: 'south carolina' },
        { pattern: /\b(north dakota)\b/gi, keyword: 'north dakota' },
        { pattern: /\b(south dakota)\b/gi, keyword: 'south dakota' },
        { pattern: /\b(new hampshire)\b/gi, keyword: 'new hampshire' },
        { pattern: /\b(new mexico)\b/gi, keyword: 'new mexico' },
        { pattern: /\b(west virginia)\b/gi, keyword: 'west virginia' },
        { pattern: /\b(rhode island)\b/gi, keyword: 'rhode island' },
        { pattern: /\b(district of columbia|washington dc|washington d\.c\.)\b/gi, keyword: 'district of columbia' },
        { pattern: /\b(alabama native|al native)\b/gi, keyword: 'alabama native' },
        { pattern: /\b(alaska native|ak native)\b/gi, keyword: 'alaska native' },
        { pattern: /\b(arizona native|az native)\b/gi, keyword: 'arizona native' },
        { pattern: /\b(arkansas native|ar native)\b/gi, keyword: 'arkansas native' },
        { pattern: /\b(california native|ca native)\b/gi, keyword: 'california native' },
        { pattern: /\b(colorado native|co native)\b/gi, keyword: 'colorado native' },
        { pattern: /\b(connecticut native|ct native)\b/gi, keyword: 'connecticut native' },
        { pattern: /\b(delaware native|de native)\b/gi, keyword: 'delaware native' },
        { pattern: /\b(florida native|fl native)\b/gi, keyword: 'florida native' },
        { pattern: /\b(georgia native|ga native)\b/gi, keyword: 'georgia native' },
        { pattern: /\b(hawaii native|hi native)\b/gi, keyword: 'hawaii native' },
        { pattern: /\b(idaho native|id native)\b/gi, keyword: 'idaho native' },
        { pattern: /\b(illinois native|il native)\b/gi, keyword: 'illinois native' },
        { pattern: /\b(indiana native|in native)\b/gi, keyword: 'indiana native' },
        { pattern: /\b(iowa native|ia native)\b/gi, keyword: 'iowa native' },
        { pattern: /\b(kansas native|ks native)\b/gi, keyword: 'kansas native' },
        { pattern: /\b(kentucky native|ky native)\b/gi, keyword: 'kentucky native' },
        { pattern: /\b(louisiana native|la native)\b/gi, keyword: 'louisiana native' },
        { pattern: /\b(maine native|me native)\b/gi, keyword: 'maine native' },
        { pattern: /\b(maryland native|md native)\b/gi, keyword: 'maryland native' },
        { pattern: /\b(massachusetts native|ma native)\b/gi, keyword: 'massachusetts native' },
        { pattern: /\b(michigan native|mi native)\b/gi, keyword: 'michigan native' },
        { pattern: /\b(minnesota native|mn native)\b/gi, keyword: 'minnesota native' },
        { pattern: /\b(mississippi native|ms native)\b/gi, keyword: 'mississippi native' },
        { pattern: /\b(missouri native|mo native)\b/gi, keyword: 'missouri native' },
        { pattern: /\b(montana native|mt native)\b/gi, keyword: 'montana native' },
        { pattern: /\b(nebraska native|ne native)\b/gi, keyword: 'nebraska native' },
        { pattern: /\b(nevada native|nv native)\b/gi, keyword: 'nevada native' },
        { pattern: /\b(ohio native|oh native)\b/gi, keyword: 'ohio native' },
        { pattern: /\b(oklahoma native|ok native)\b/gi, keyword: 'oklahoma native' },
        { pattern: /\b(oregon native|or native)\b/gi, keyword: 'oregon native' },
        { pattern: /\b(tennessee native|tn native)\b/gi, keyword: 'tennessee native' },
        { pattern: /\b(texas native|tx native)\b/gi, keyword: 'texas native' },
        { pattern: /\b(utah native|ut native)\b/gi, keyword: 'utah native' },
        { pattern: /\b(vermont native|vt native)\b/gi, keyword: 'vermont native' },
        { pattern: /\b(virginia native|va native)\b/gi, keyword: 'virginia native' },
        { pattern: /\b(washington native|wa native)\b/gi, keyword: 'washington native' },
        { pattern: /\b(wisconsin native|wi native)\b/gi, keyword: 'wisconsin native' },
        { pattern: /\b(wyoming native|wy native)\b/gi, keyword: 'wyoming native' },
        { pattern: /\b(alabama)\b/gi, keyword: 'alabama' },
        { pattern: /\b(alaska)\b/gi, keyword: 'alaska' },
        { pattern: /\b(arizona)\b/gi, keyword: 'arizona' },
        { pattern: /\b(arkansas)\b/gi, keyword: 'arkansas' },
        { pattern: /\b(california)\b/gi, keyword: 'california' },
        { pattern: /\b(colorado)\b/gi, keyword: 'colorado' },
        { pattern: /\b(connecticut)\b/gi, keyword: 'connecticut' },
        { pattern: /\b(delaware)\b/gi, keyword: 'delaware' },
        { pattern: /\b(florida)\b/gi, keyword: 'florida' },
        { pattern: /\b(georgia)\b/gi, keyword: 'georgia' },
        { pattern: /\b(hawaii)\b/gi, keyword: 'hawaii' },
        { pattern: /\b(idaho)\b/gi, keyword: 'idaho' },
        { pattern: /\b(illinois)\b/gi, keyword: 'illinois' },
        { pattern: /\b(indiana)\b/gi, keyword: 'indiana' },
        { pattern: /\b(iowa)\b/gi, keyword: 'iowa' },
        { pattern: /\b(kansas)\b/gi, keyword: 'kansas' },
        { pattern: /\b(kentucky)\b/gi, keyword: 'kentucky' },
        { pattern: /\b(louisiana)\b/gi, keyword: 'louisiana' },
        { pattern: /\b(maine)\b/gi, keyword: 'maine' },
        { pattern: /\b(maryland)\b/gi, keyword: 'maryland' },
        { pattern: /\b(massachusetts)\b/gi, keyword: 'massachusetts' },
        { pattern: /\b(michigan)\b/gi, keyword: 'michigan' },
        { pattern: /\b(minnesota)\b/gi, keyword: 'minnesota' },
        { pattern: /\b(mississippi)\b/gi, keyword: 'mississippi' },
        { pattern: /\b(missouri)\b/gi, keyword: 'missouri' },
        { pattern: /\b(montana)\b/gi, keyword: 'montana' },
        { pattern: /\b(nebraska)\b/gi, keyword: 'nebraska' },
        { pattern: /\b(nevada)\b/gi, keyword: 'nevada' },
        { pattern: /\b(ohio)\b/gi, keyword: 'ohio' },
        { pattern: /\b(oklahoma)\b/gi, keyword: 'oklahoma' },
        { pattern: /\b(oregon)\b/gi, keyword: 'oregon' },
        { pattern: /\b(tennessee)\b/gi, keyword: 'tennessee' },
        { pattern: /\b(texas)\b/gi, keyword: 'texas' },
        { pattern: /\b(utah)\b/gi, keyword: 'utah' },
        { pattern: /\b(vermont)\b/gi, keyword: 'vermont' },
        { pattern: /\b(virginia)\b/gi, keyword: 'virginia' },
        { pattern: /\b(washington)\b/gi, keyword: 'washington' },
        { pattern: /\b(wisconsin)\b/gi, keyword: 'wisconsin' },
        { pattern: /\b(wyoming)\b/gi, keyword: 'wyoming' },
        { pattern: /\b(pa native)\b/gi, keyword: 'pa native' },
        { pattern: /\b(ny native)\b/gi, keyword: 'ny native' },
        { pattern: /\b(nj native)\b/gi, keyword: 'nj native' },
        { pattern: /\b(nc native)\b/gi, keyword: 'nc native' },
        { pattern: /\b(sc native)\b/gi, keyword: 'sc native' },
        { pattern: /\b(nd native)\b/gi, keyword: 'nd native' },
        { pattern: /\b(sd native)\b/gi, keyword: 'sd native' },
        { pattern: /\b(nh native)\b/gi, keyword: 'nh native' },
        { pattern: /\b(nm native)\b/gi, keyword: 'nm native' },
        { pattern: /\b(wv native)\b/gi, keyword: 'wv native' },
        { pattern: /\b(ri native)\b/gi, keyword: 'ri native' },
        { pattern: /\b(dc native)\b/gi, keyword: 'dc native' },
        { pattern: /\b(al native)\b/gi, keyword: 'al native' },
        { pattern: /\b(ak native)\b/gi, keyword: 'ak native' },
        { pattern: /\b(az native)\b/gi, keyword: 'az native' },
        { pattern: /\b(ar native)\b/gi, keyword: 'ar native' },
        { pattern: /\b(ca native)\b/gi, keyword: 'ca native' },
        { pattern: /\b(co native)\b/gi, keyword: 'co native' },
        { pattern: /\b(ct native)\b/gi, keyword: 'ct native' },
        { pattern: /\b(de native)\b/gi, keyword: 'de native' },
        { pattern: /\b(fl native)\b/gi, keyword: 'fl native' },
        { pattern: /\b(ga native)\b/gi, keyword: 'ga native' },
        { pattern: /\b(hi native)\b/gi, keyword: 'hi native' },
        { pattern: /\b(id native)\b/gi, keyword: 'id native' },
        { pattern: /\b(il native)\b/gi, keyword: 'il native' },
        { pattern: /\b(in native)\b/gi, keyword: 'in native' },
        { pattern: /\b(ia native)\b/gi, keyword: 'ia native' },
        { pattern: /\b(ks native)\b/gi, keyword: 'ks native' },
        { pattern: /\b(ky native)\b/gi, keyword: 'ky native' },
        { pattern: /\b(la native)\b/gi, keyword: 'la native' },
        { pattern: /\b(me native)\b/gi, keyword: 'me native' },
        { pattern: /\b(md native)\b/gi, keyword: 'md native' },
        { pattern: /\b(ma native)\b/gi, keyword: 'ma native' },
        { pattern: /\b(mi native)\b/gi, keyword: 'mi native' },
        { pattern: /\b(mn native)\b/gi, keyword: 'mn native' },
        { pattern: /\b(ms native)\b/gi, keyword: 'ms native' },
        { pattern: /\b(mo native)\b/gi, keyword: 'mo native' },
        { pattern: /\b(mt native)\b/gi, keyword: 'mt native' },
        { pattern: /\b(ne native)\b/gi, keyword: 'ne native' },
        { pattern: /\b(nv native)\b/gi, keyword: 'nv native' },
        { pattern: /\b(oh native)\b/gi, keyword: 'oh native' },
        { pattern: /\b(ok native)\b/gi, keyword: 'ok native' },
        { pattern: /\b(or native)\b/gi, keyword: 'or native' },
        { pattern: /\b(tn native)\b/gi, keyword: 'tn native' },
        { pattern: /\b(tx native)\b/gi, keyword: 'tx native' },
        { pattern: /\b(ut native)\b/gi, keyword: 'ut native' },
        { pattern: /\b(vt native)\b/gi, keyword: 'vt native' },
        { pattern: /\b(va native)\b/gi, keyword: 'va native' },
        { pattern: /\b(wa native)\b/gi, keyword: 'wa native' },
        { pattern: /\b(wi native)\b/gi, keyword: 'wi native' },
        { pattern: /\b(wy native)\b/gi, keyword: 'wy native' },
        { pattern: /\b(pa)\b/gi, keyword: 'pa' },
        { pattern: /\b(ny)\b/gi, keyword: 'ny' },
        { pattern: /\b(nj)\b/gi, keyword: 'nj' },
        { pattern: /\b(nc)\b/gi, keyword: 'nc' },
        { pattern: /\b(sc)\b/gi, keyword: 'sc' },
        { pattern: /\b(nd)\b/gi, keyword: 'nd' },
        { pattern: /\b(sd)\b/gi, keyword: 'sd' },
        { pattern: /\b(nh)\b/gi, keyword: 'nh' },
        { pattern: /\b(nm)\b/gi, keyword: 'nm' },
        { pattern: /\b(wv)\b/gi, keyword: 'wv' },
        { pattern: /\b(ri)\b/gi, keyword: 'ri' },
        { pattern: /\b(dc)\b/gi, keyword: 'dc' },
        { pattern: /\b(al)\b/gi, keyword: 'al' },
        { pattern: /\b(ak)\b/gi, keyword: 'ak' },
        { pattern: /\b(az)\b/gi, keyword: 'az' },
        { pattern: /\b(ar)\b/gi, keyword: 'ar' },
        { pattern: /\b(ca)\b/gi, keyword: 'ca' },
        { pattern: /\b(co)\b/gi, keyword: 'co' },
        { pattern: /\b(ct)\b/gi, keyword: 'ct' },
        { pattern: /\b(de)\b/gi, keyword: 'de' },
        { pattern: /\b(fl)\b/gi, keyword: 'fl' },
        { pattern: /\b(ga)\b/gi, keyword: 'ga' },
        { pattern: /\b(hi)\b/gi, keyword: 'hi' },
        { pattern: /\b(id)\b/gi, keyword: 'id' },
        { pattern: /\b(il)\b/gi, keyword: 'il' },
        { pattern: /\b(in)\b/gi, keyword: 'in' },
        { pattern: /\b(ia)\b/gi, keyword: 'ia' },
        { pattern: /\b(ks)\b/gi, keyword: 'ks' },
        { pattern: /\b(ky)\b/gi, keyword: 'ky' },
        { pattern: /\b(la)\b/gi, keyword: 'la' },
        { pattern: /\b(me)\b/gi, keyword: 'me' },
        { pattern: /\b(md)\b/gi, keyword: 'md' },
        { pattern: /\b(ma)\b/gi, keyword: 'ma' },
        { pattern: /\b(mi)\b/gi, keyword: 'mi' },
        { pattern: /\b(mn)\b/gi, keyword: 'mn' },
        { pattern: /\b(ms)\b/gi, keyword: 'ms' },
        { pattern: /\b(mo)\b/gi, keyword: 'mo' },
        { pattern: /\b(mt)\b/gi, keyword: 'mt' },
        { pattern: /\b(ne)\b/gi, keyword: 'ne' },
        { pattern: /\b(nv)\b/gi, keyword: 'nv' },
        { pattern: /\b(oh)\b/gi, keyword: 'oh' },
        { pattern: /\b(ok)\b/gi, keyword: 'ok' },
        { pattern: /\b(or)\b/gi, keyword: 'or' },
        { pattern: /\b(tn)\b/gi, keyword: 'tn' },
        { pattern: /\b(tx)\b/gi, keyword: 'tx' },
        { pattern: /\b(ut)\b/gi, keyword: 'ut' },
        { pattern: /\b(vt)\b/gi, keyword: 'vt' },
        { pattern: /\b(va)\b/gi, keyword: 'va' },
        { pattern: /\b(wa)\b/gi, keyword: 'wa' },
        { pattern: /\b(wi)\b/gi, keyword: 'wi' },
        { pattern: /\b(wy)\b/gi, keyword: 'wy' },
        
        // Availability
        { pattern: /\b(local store|local nursery|brick and mortar)\b/gi, keyword: 'local store' },
        { pattern: /\b(online store|buy online|order online|ecommerce)\b/gi, keyword: 'online store' },
        { pattern: /\b(nearby|near me|in store)\b/gi, keyword: 'nearby' },
        { pattern: /\b(shipping|delivery)\b/gi, keyword: 'shipping' },
        { pattern: /\b(local)\b/gi, keyword: 'local' },
        { pattern: /\b(online)\b/gi, keyword: 'online' },
        
        // Other filters
        { pattern: /\b(showy flowers)\b/gi, keyword: 'showy flowers' },
        { pattern: /\b(super plant|superplant)\b/gi, keyword: 'super plant' },
        { pattern: /\b(showy)\b/gi, keyword: 'showy' },
      ];
      
      // Remove matched keywords from the query
      for (const { pattern, keyword } of keywordPatterns) {
        if (pattern.test(queryLower)) {
          // Remove the keyword (case-insensitive) from remaining query
          const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const keywordRegex = new RegExp(`\\b${escapeRegex(keyword)}\\b`, 'gi');
          remainingQuery = remainingQuery.replace(keywordRegex, '').trim();
        }
      }
      
      // Clean up extra spaces
      remainingQuery = remainingQuery.replace(/\s+/g, ' ').trim();
      
      return remainingQuery;
    },
    getChips(active) {
      const chips = [];
      const previewChips = [];
      
      // Show search chip only when:
      // 1. There's an active search
      // 2. Sort is "Sort by Search Relevance" (semantic search is active)
      // 3. There's remaining query text after filter extraction (for semantic search)
      if (active && this.activeSearch && this.activeSearch.trim()) {
        const remainingQuery = this.getRemainingQueryText(this.activeSearch);
        if (remainingQuery && remainingQuery.trim() && this.sort === "Sort by Search Relevance") {
          chips.push({
            name: "Search",
            label: remainingQuery.trim(),
            key: "Search",
            svg: "Search",
          });
        }
      }
      
      // First, add all regular filter chips
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
              // Skip if this is already shown as a preview chip
              if (!active || !this.q || this.activeSearch || !this.previewFiltersFromQuery[filter.name] || !this.previewFiltersFromQuery[filter.name].includes(item)) {
                chips.push({
                  name: filter.name,
                  label: item,
                  color: item,
                  key: filter.name + ":" + item,
                });
              }
            });
          } else {
            value.forEach((item) => {
              // Skip if this is already shown as a preview chip
              if (!active || !this.q || this.activeSearch || !this.previewFiltersFromQuery[filter.name] || !this.previewFiltersFromQuery[filter.name].includes(item)) {
                chips.push({
                  name: filter.name,
                  label: item,
                  svg: item,
                  key: filter.name + ":" + item,
                });
              }
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
      
      // Then, add preview chips from query if user is typing (not yet submitted)
      // These appear after existing filter chips to prevent "hopping" when activated
      // Show preview if query exists and is different from active search
      if (active && this.q && (this.q.trim() !== (this.activeSearch || '').trim()) && Object.keys(this.previewFiltersFromQuery).length > 0) {
        for (const [filterName, values] of Object.entries(this.previewFiltersFromQuery)) {
          const filter = this.filters.find(f => f.name === filterName);
          if (filter && filter.array && values) {
            values.forEach((item) => {
              previewChips.push({
                name: filter.name,
                label: item,
                svg: filter.name === "Flower Color Flags" ? null : item,
                color: filter.name === "Flower Color Flags" ? item : null,
                key: `preview:${filter.name}:${item}`,
                preview: true, // Mark as preview chip
              });
            });
          }
        }
      }
      
      // Append preview chips after regular chips
      return [...chips, ...previewChips];
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
    handleSearchSubmit() {
      // Only submit search when explicitly triggered (Enter or button click)
      const queryText = this.q.trim();
      
      // Store previous activeSearch before processing to preserve semantic filters
      const previousActiveSearch = this.activeSearch;
      
      // Extract filters from the query and apply them to filterValues
      const extractedFilters = this.parseNaturalLanguageFromQuery(queryText);
      let hasExtractedFilters = false;
      for (const [filterName, values] of Object.entries(extractedFilters)) {
        if (values && values.length > 0) {
          hasExtractedFilters = true;
          const filter = this.filters.find(f => f.name === filterName);
          if (filter && filter.array) {
            // Merge with existing values, avoiding duplicates
            const existing = this.filterValues[filterName] || [];
            this.filterValues[filterName] = [...new Set([...existing, ...values])];
            // Open the filter section so user can see the checked boxes
            this.filterIsOpen[filterName] = true;
          }
        }
      }
      
      // Store whether filters were extracted to control chip display
      // We'll store the original query but mark if filters were extracted
      this.hasExtractedFilters = hasExtractedFilters;
      
      // Calculate remaining query text after filter extraction
      const remainingQuery = this.getRemainingQueryText(queryText);
      
      // Handle activeSearch: preserve previous semantic search when new query only extracts to filters
      if (remainingQuery && remainingQuery.trim()) {
        // There's semantic search content in the new query, so update activeSearch
        this.activeSearch = queryText || "";
        
        // Only switch to "Sort by Search Relevance" if there's remaining text for semantic search
        // (not just extracted filters)
        if (this.sort !== "Sort by Search Relevance") {
          // Save current sort as previous before switching
          this.previousSort = this.sort;
          this.sort = "Sort by Search Relevance";
        }
      } else if (queryText === "") {
        // If query is empty, clear activeSearch
        this.activeSearch = "";
      } else {
        // New query only extracted to filters (no remaining query for semantic search)
        // This means trigger words were matched - preserve previous activeSearch if it exists
        // and has semantic content (not just trigger words)
        if (previousActiveSearch && previousActiveSearch.trim()) {
          const previousRemainingQuery = this.getRemainingQueryText(previousActiveSearch);
          // If previous activeSearch has semantic content (remaining query after removing trigger words),
          // preserve it. Otherwise, if previous activeSearch was also just trigger words, clear it.
          if (previousRemainingQuery && previousRemainingQuery.trim()) {
            // Previous activeSearch has semantic content, so preserve it
            this.activeSearch = previousActiveSearch;
            // Ensure sort is set to "Sort by Search Relevance" so the search chip will be visible
            // This must stay as "Sort by Search Relevance" when semantic search is preserved
            if (!this.favorites) {
              if (this.sort !== "Sort by Search Relevance") {
                this.previousSort = this.sort;
                this.sort = "Sort by Search Relevance";
              }
              // If already on "Sort by Search Relevance", ensure previousSort is set correctly
              // so it doesn't get cleared by other watchers
              if (this.sort === "Sort by Search Relevance" && !this.previousSort) {
                this.previousSort = "Sort by Recommendation Score";
              }
            }
          } else {
            // Previous activeSearch was also just trigger words, so clear it
            this.activeSearch = "";
          }
        } else {
          // No previous activeSearch, so clear it
          this.activeSearch = "";
        }
      }
      
      // Always clear the search input after submit
      this.q = "";
      this.showAutocomplete = false;
      
      this.submit();
    },
    async handleSearchInput() {
      // Debounce autocomplete requests
      if (this.autocompleteTimeout) {
        clearTimeout(this.autocompleteTimeout);
      }
      
      if (this.q.length < 2) {
        this.autocompleteResults = { query: "", sections: [] };
        this.showAutocomplete = false;
        return;
      }
      
      // Keep autocomplete visible while typing
      this.showAutocomplete = true;
      
      this.autocompleteTimeout = setTimeout(async () => {
        try {
          const response = await fetch(`/api/v1/autocomplete?q=${encodeURIComponent(this.q)}`);
          const data = await response.json();
          this.autocompleteResults = data;
          // Only show if we have results
          if (data.sections && data.sections.length > 0) {
            this.showAutocomplete = true;
          } else {
            this.showAutocomplete = false;
          }
        } catch (error) {
          console.error("Autocomplete error:", error);
          this.showAutocomplete = false;
        }
      }, 300); // 300ms debounce
    },
    handleAutocompleteSelect(item) {
      if (item.action === "applyFilter") {
        // Apply filter
        const filter = this.filters.find(f => f.name === item.filterName);
        if (filter && filter.array) {
          const existing = this.filterValues[item.filterName] || [];
          if (!existing.includes(item.filterValue)) {
            this.filterValues[item.filterName] = [...existing, item.filterValue];
            this.filterIsOpen[item.filterName] = true;
          }
        }
        this.q = ""; // Clear search
        this.showAutocomplete = false;
        this.submit();
      } else if (item.action === "navigateToPlant") {
        // Navigate to plant detail page
        this.$router.push(`/plants/${item.plantId}`);
        this.showAutocomplete = false;
      }
    },
    handleSearchBlur() {
      // Delay hiding to allow click events to fire
      setTimeout(() => {
        this.showAutocomplete = false;
      }, 200);
    },
    highlightMatch(text, query) {
      if (!text || !query) return { before: text, match: '', after: '' };
      const queryLower = query.toLowerCase();
      const textLower = text.toLowerCase();
      const index = textLower.indexOf(queryLower);
      
      if (index === -1) return { before: text, match: '', after: '' };
      
      const before = text.substring(0, index);
      const match = text.substring(index, index + query.length);
      const after = text.substring(index + query.length);
      
      return { before, match, after };
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
      this.submitTimeout = setTimeout(submit.bind(this), 50); // Reduced timeout for faster response

      function submit() {
        // Reset pagination values
        this.page = 0;
        this.loadedAll = false;
        this.total = 0; // Reset total as well

        // Fetch new data and replace results when it arrives
        this.fetchPage(true);
        
        // Restart infinite scroll monitoring
        this.restartLoadMoreIfNeeded();
        
        // Close filters drawer
        this.filtersOpen = false;
        this.submitTimeout = null;
        
        // Allow any queued DOM updates to complete
        this.$nextTick(() => {});
      }
    },
    async updateCounts() {
      // Return a promise that resolves when counts are updated
      return new Promise((resolve) => {
        // Debounce so we don't refresh like mad when dragging a range end
        if (this.updatingCounts) {
          if (this.updatingCountsTimeout) {
            clearTimeout(this.updatingCountsTimeout);
          }
          this.updatingCountsTimeout = setTimeout(async () => {
            await this.updateCounts();
            resolve();
          }, 250);
          return;
        }
        
        this.updatingCounts = true;
        const doUpdate = async () => {
          try {
            // Only include search query if there's an active search
            // This prevents search from triggering when just updating filter counts
            const params = {
              ...this.filterValues,
              sort: this.sort,
            };
            // Only include search params if there's an active search (not while typing)
            if (this.activeSearch) {
              params.q = this.activeSearch;
              params.semantic = 'true';
            }
            if (this.initializing) {
              resolve();
              return;
            }
            const response = await fetch("/api/v1/plants?" + qs.stringify(params));
            const data = await response.json();
            this.filterCounts = data.counts;
          } finally {
            this.updatingCounts = false;
            resolve();
          }
        };
        
        doUpdate();
      });
    },
    async fetchPage(replace = false) {
      this.loading = true;
      if (this.favorites && ![...this.$store.state.favorites].length) {
        // Avoid a query that would result in seeing all of the plants
        // in the database as "favorites"
        if (replace) {
          this.results = [];
        }
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
            sort: this.sort,
            page: this.page,
          };
      // Only include search query if there's an active search (explicitly submitted)
      // Don't use this.q directly as it changes while typing
      if (this.activeSearch && this.activeSearch.trim()) {
        params.q = this.activeSearch;
        params.semantic = 'true';
      }
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
      if (replace) {
        this.results = data.results;
      } else {
        // Prevent duplicate plants by checking if they already exist in the results array
        data.results.forEach((datum) => {
          if (!this.results.some((existing) => existing._id === datum._id)) {
            this.results.push(datum);
          }
        });
      }
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
    findKeywordForFilterValue(filterName, filterValue) {
      // Reverse lookup: find which keyword(s) match a filter value
      const queryLower = this.q.toLowerCase();
      
      // Mapping of filter values to their matching keywords
      const valueToKeywords = {
        'Sun Exposure Flags': {
          'Shade': ['shade', 'shady', 'full shade', 'deep shade', 'shade tolerant'],
          'Sun': ['sun', 'sunny', 'full sun', 'all day sun'],
          'Part Shade': ['part shade', 'partial shade', 'partial sun', 'part sun', 'filtered light'],
        },
        'Soil Moisture Flags': {
          'Wet': ['wet', 'wet soil', 'wet feet', 'puddles', 'rain garden'],
          'Dry': ['dry', 'dry soil', 'cracks', 'drought', 'drought tolerant'],
          'Moist': ['moist', 'moist soil', 'slightly moist', 'damp'],
        },
        'Life Cycle Flags': {
          'Perennial': ['perennial', 'perennials'],
          'Annual': ['annual', 'annuals'],
          'Biennial': ['biennial', 'biennials'],
        },
        'Pollinator Flags': {
          'Butterflies': ['butterfly', 'butterflies'],
          'Hummingbirds': ['hummingbird', 'hummingbirds'],
          'Native Bees': ['bees', 'bee', 'honey bees', 'native bees'],
          'Honey Bees': ['bees', 'bee', 'honey bees', 'native bees'],
          'Beetles': ['beetle', 'beetles'],
          'Bombus': ['bombus', 'bumblebee', 'bumblebees', 'bumble bee', 'bumble bees'],
          'Flies': ['fly', 'flies'],
          'Monarchs': ['monarch', 'monarchs', 'monarch butterfly', 'monarch butterflies'],
          'Moths': ['moth', 'moths'],
          'Wasps': ['wasp', 'wasps'],
          'Larval Host (Butterfly)': ['larval host butterfly', 'larval host butterflies', 'butterfly host', 'butterfly hosts'],
          'Larval Host (Monarch)': ['larval host monarch', 'larval host monarchs', 'monarch host', 'monarch hosts', 'monarch waystation'],
          'Larval Host (Moth)': ['larval host moth', 'larval host moths', 'moth host', 'moth hosts'],
          'Nesting And Structure (Bees)': ['nesting bees', 'nesting structure bees', 'bee nesting', 'bee nesting structure', 'nesting and structure bees'],
        },
        'Plant Type Flags': {
          'Tree': ['tree', 'trees'],
          'Shrub': ['shrub', 'shrubs', 'bush', 'bushes'],
          'Vine': ['vine', 'vines', 'climbing', 'trellis'],
          'Graminoid': ['grass', 'grasses', 'graminoid'],
          'Herb': ['herb', 'herbs'],
        },
        'Flower Color Flags': {
          'Yellow': ['yellow', 'yellow flowers'],
          'Red': ['red', 'red flowers'],
          'Purple': ['purple', 'purple flowers', 'violet'],
          'Orange': ['orange', 'orange flowers'],
          'Pink': ['pink', 'pink flowers'],
          'White': ['white', 'white flowers'],
          'Blue': ['blue', 'blue flowers'],
        },
        'Showy': {
          'Showy': ['showy', 'showy flowers'],
        },
        'Superplant': {
          'Super Plant': ['super plant', 'superplant'],
        },
        'States': {
          'AL': ['alabama', 'al', 'al native', 'alabama native'],
          'AK': ['alaska', 'ak', 'ak native', 'alaska native'],
          'AZ': ['arizona', 'az', 'az native', 'arizona native'],
          'AR': ['arkansas', 'ar', 'ar native', 'arkansas native'],
          'CA': ['california', 'ca', 'ca native', 'california native'],
          'CO': ['colorado', 'co', 'co native', 'colorado native'],
          'CT': ['connecticut', 'ct', 'ct native', 'connecticut native'],
          'DE': ['delaware', 'de', 'de native', 'delaware native'],
          'DC': ['district of columbia', 'dc', 'dc native', 'district of columbia native', 'washington dc', 'washington d.c.'],
          'FL': ['florida', 'fl', 'fl native', 'florida native'],
          'GA': ['georgia', 'ga', 'ga native', 'georgia native'],
          'HI': ['hawaii', 'hi', 'hi native', 'hawaii native'],
          'ID': ['idaho', 'id', 'id native', 'idaho native'],
          'IL': ['illinois', 'il', 'il native', 'illinois native'],
          'IN': ['indiana', 'in', 'in native', 'indiana native'],
          'IA': ['iowa', 'ia', 'ia native', 'iowa native'],
          'KS': ['kansas', 'ks', 'ks native', 'kansas native'],
          'KY': ['kentucky', 'ky', 'ky native', 'kentucky native'],
          'LA': ['louisiana', 'la', 'la native', 'louisiana native'],
          'ME': ['maine', 'me', 'me native', 'maine native'],
          'MD': ['maryland', 'md', 'md native', 'maryland native'],
          'MA': ['massachusetts', 'ma', 'ma native', 'massachusetts native'],
          'MI': ['michigan', 'mi', 'mi native', 'michigan native'],
          'MN': ['minnesota', 'mn', 'mn native', 'minnesota native'],
          'MS': ['mississippi', 'ms', 'ms native', 'mississippi native'],
          'MO': ['missouri', 'mo', 'mo native', 'missouri native'],
          'MT': ['montana', 'mt', 'mt native', 'montana native'],
          'NE': ['nebraska', 'ne', 'ne native', 'nebraska native'],
          'NV': ['nevada', 'nv', 'nv native', 'nevada native'],
          'NH': ['new hampshire', 'nh', 'nh native', 'new hampshire native'],
          'NJ': ['new jersey', 'nj', 'nj native', 'new jersey native'],
          'NM': ['new mexico', 'nm', 'nm native', 'new mexico native'],
          'NY': ['new york', 'ny', 'ny native', 'new york native'],
          'NC': ['north carolina', 'nc', 'nc native', 'north carolina native'],
          'ND': ['north dakota', 'nd', 'nd native', 'north dakota native'],
          'OH': ['ohio', 'oh', 'oh native', 'ohio native'],
          'OK': ['oklahoma', 'ok', 'ok native', 'oklahoma native'],
          'OR': ['oregon', 'or', 'or native', 'oregon native'],
          'PA': ['pennsylvania', 'pa', 'pa native', 'pennsylvania native'],
          'RI': ['rhode island', 'ri', 'ri native', 'rhode island native'],
          'SC': ['south carolina', 'sc', 'sc native', 'south carolina native'],
          'SD': ['south dakota', 'sd', 'sd native', 'south dakota native'],
          'TN': ['tennessee', 'tn', 'tn native', 'tennessee native'],
          'TX': ['texas', 'tx', 'tx native', 'texas native'],
          'UT': ['utah', 'ut', 'ut native', 'utah native'],
          'VT': ['vermont', 'vt', 'vt native', 'vermont native'],
          'VA': ['virginia', 'va', 'va native', 'virginia native'],
          'WA': ['washington', 'wa', 'wa native', 'washington native'],
          'WV': ['west virginia', 'wv', 'wv native', 'west virginia native'],
          'WI': ['wisconsin', 'wi', 'wi native', 'wisconsin native'],
          'WY': ['wyoming', 'wy', 'wy native', 'wyoming native'],
        },
        'Availability Flags': {
          'Local': ['local', 'local store', 'local nursery', 'nearby', 'near me', 'in store', 'brick and mortar'],
          'Online': ['online', 'online store', 'buy online', 'order online', 'shipping', 'delivery', 'ecommerce'],
        },
      };
      
      const keywords = valueToKeywords[filterName]?.[filterValue];
      if (!keywords) return null;
      
      // Find the first matching keyword in the query (prioritize longer matches)
      const sortedKeywords = keywords.sort((a, b) => b.length - a.length);
      for (const keyword of sortedKeywords) {
        const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (regex.test(queryLower)) {
          return keyword;
        }
      }
      return null;
    },
    activatePreviewChip(chip) {
      // Add the filter value to filterValues
      const filter = this.filters.find((filter) => filter.name === chip.name);
      if (filter && filter.array) {
        const existing = this.filterValues[chip.name] || [];
        if (!existing.includes(chip.label)) {
          this.filterValues[chip.name] = [...existing, chip.label];
          this.filterIsOpen[chip.name] = true;
        }
      }
      
      // Find and remove the matching keyword from the query
      const matchedKeyword = this.findKeywordForFilterValue(chip.name, chip.label);
      if (matchedKeyword && this.q) {
        // Remove the keyword (case-insensitive) from the query
        const regex = new RegExp(`\\b${matchedKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
        this.q = this.q.replace(regex, '').trim();
        // Clean up extra spaces
        this.q = this.q.replace(/\s+/g, ' ').trim();
      }
      
      // Submit to update results
      this.$nextTick(() => {
        this.submit();
      });
    },
    removeChip(chip) {
      if (chip.name === "Search") {
        // When removing search chip: clear activeSearch but keep all filter chips
        this.q = "";
        this.activeSearch = "";
        this.hasExtractedFilters = false;
        // Close sort dropdown if it's open
        if (this.sortIsOpen) {
          this.sortIsOpen = false;
        }
        // Filter chips remain intact in filterValues
        this.submit();
      } else {
        // When removing filter chip: only update filterValues, preserve activeSearch
        const filter = this.filters.find((filter) => filter.name === chip.name);
        if (filter && filter.array) {
          // Create a new array to ensure Vue reactivity detects the change
          const currentValues = this.filterValues[chip.name] || [];
          this.filterValues[chip.name] = currentValues.filter(
            (value) => value !== chip.label
          );
        } else if (filter) {
          this.filterValues[chip.name] = filter.default;
        }
        
        // Don't clear activeSearch when removing filter chips
        // This allows semantic search to continue working with remaining filters
        
        // The filterValues watcher will trigger, but ensure submit happens
        // Use $nextTick to ensure the watcher has processed the change
        this.$nextTick(() => {
          // Force submit to ensure counts and results update
          this.submit();
        });
      }
    },
    clearAll() {
      for (const filter of this.filters) {
        this.filterValues[filter.name] = filter.default;
      }
      this.q = "";
      this.activeSearch = "";
      this.hasExtractedFilters = false;
      // Close sort dropdown if it's open
      if (this.sortIsOpen) {
        this.sortIsOpen = false;
      }
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
    copyFavorites() {
      // Create HTML version with italicized scientific names
      const htmlLines = this.results.map(
        (p) => `<li>${p["Common Name"]} (<i>${p["Scientific Name"]}</i>)</li>` 
      );
      const htmlContent = `<ul>
${htmlLines.join("\n")}
</ul>`;
      
      // Plain text version as fallback (without HTML formatting)
      const plainTextLines = this.results.map(
        (p) => `• ${p["Common Name"]} (${p["Scientific Name"]})` 
      );
      const plainText = plainTextLines.join("\n");
      
      // Set copied state for button feedback
      this.isCopied = true;
      
      // First try to copy with HTML formatting using document.execCommand
      let copySuccessful = false;
      
      // Only try HTML approach if execCommand is available
      if (document.execCommand) {
        try {
          // Create a temporary div to hold our HTML content
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = htmlContent;
          tempDiv.style.position = 'absolute';
          tempDiv.style.left = '-9999px';
          document.body.appendChild(tempDiv);
          
          // Select the content
          const range = document.createRange();
          range.selectNode(tempDiv);
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
          
          // Execute copy command
          copySuccessful = document.execCommand('copy');
          
          // Clean up
          selection.removeAllRanges();
          document.body.removeChild(tempDiv);
        } catch (err) {
          console.error("Failed to copy with HTML formatting", err);
          copySuccessful = false;
        }
      }
      
      // If HTML copy failed, try clipboard API with plain text
      if (!copySuccessful && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(plainText).catch((err) => {
          console.error("Failed to copy with clipboard API", err);
          this.isCopied = false;
        });
      } 
      // Last resort: try plain text with execCommand if everything else failed
      else if (!copySuccessful) {
        try {
          const textarea = document.createElement("textarea");
          textarea.value = plainText;
          textarea.style.position = 'absolute';
          textarea.style.left = '-9999px';
          document.body.appendChild(textarea);
          textarea.select();
          
          copySuccessful = document.execCommand("copy");
          if (!copySuccessful) {
            console.error("Failed to copy with execCommand");
            this.isCopied = false;
          }
        } catch (err) {
          console.error("Failed to copy favorites", err);
          this.isCopied = false;
        } finally {
          const textareaElement = document.querySelector('textarea[style*="position: absolute"]');
          if (textareaElement && document.body.contains(textareaElement)) {
            document.body.removeChild(textareaElement);
          }
        }
      }
      
      // Reset button after 2 seconds
      setTimeout(() => {
        this.isCopied = false;
      }, 2000);
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

.copy-clipboard {
  max-width: 350px;
  margin: auto;
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

button.favorites[disabled], button.copy-button[disabled] {
  opacity: 0.5;
  cursor: not-allowed;
}

.copy-button {
  transition: all 0.3s ease;
  position: relative;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.copy-button:active {
  transform: translateY(2px);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

.copy-button.copied {
  background-color: #38a169 !important;
  transition: all 0.3s ease;
  animation: pulse 0.5s ease-in-out;
}

@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
}

.copy-button span {
  transition: opacity 0.2s ease;
}

@media (hover: hover) {
  .copy-button:hover:not([disabled]) {
    background-color: #c85d25;
    transform: translateY(1px);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
  }
}

.copy-clipboard {
  position: relative;
  margin-top: 10px;
  display: flex;
  justify-content: center;
  gap: 10px;
}

.planner-button {
  white-space: nowrap;
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

.chip-preview {
  opacity: 0.7;
  border-style: dashed;
  cursor: pointer;
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
.search-mobile-wrapper {
  position: relative;
  width: 100%;
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
.autocomplete-dropdown-mobile {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #1d2e26;
  border-radius: 8px;
  margin-top: 4px;
  max-height: 300px;
  overflow-y: auto;
  z-index: 1000;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
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

.two-up p :deep(a) {
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
  .search-with-autocomplete {
    position: relative;
  }
  .autocomplete-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: white;
    border: 1px solid #1d2e26;
    border-radius: 8px;
    margin-top: 4px;
    max-height: 400px;
    overflow-y: auto;
    z-index: 1000;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }
  .autocomplete-section {
    border-bottom: 1px solid #e0e0e0;
  }
  .autocomplete-section:last-child {
    border-bottom: none;
  }
  .autocomplete-section-header {
    display: flex;
    align-items: center;
    padding: 8px 16px;
    background-color: #f5f5f5;
    font-weight: bold;
    font-size: 14px;
    color: #1d2e26;
    font-family: Lato;
  }
  .section-icon {
    width: 20px;
    height: 20px;
    margin-right: 8px;
  }
  .section-label {
    flex: 1;
  }
  .autocomplete-item {
    display: flex;
    align-items: center;
    padding: 12px 16px;
    cursor: pointer;
    transition: background-color 0.2s;
  }
  .autocomplete-item:hover {
    background-color: #fbecd0;
  }
  .autocomplete-item-icon {
    width: 24px;
    height: 24px;
    margin-right: 12px;
  }
  .autocomplete-item-text {
    flex: 1;
    font-size: 16px;
    color: #1d2e26;
    font-family: Roboto;
  }
  .autocomplete-item-subtitle {
    display: block;
    font-size: 12px;
    color: #666;
    font-style: italic;
    margin-top: 2px;
    font-family: Roboto;
  }
  .semantic-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 8px;
    font-size: 12px;
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
  }
  .semantic-toggle input[type="checkbox"] {
    cursor: pointer;
  }
  .semantic-toggle-mobile {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 0 8px;
    font-size: 11px;
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
    border-left: 1px solid rgba(29, 46, 38, 0.2);
  }
  .semantic-toggle-mobile input[type="checkbox"] {
    cursor: pointer;
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
