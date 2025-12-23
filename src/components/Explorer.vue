<template>
  <div>
    <Header
      :h1="
        favorites
          ? 'Favorites'
          : 'Choose Native Plants'
      "
      :large-h1="false"
    >
      <template v-if="!favorites" v-slot:after-bar>
        <div class="compact-utility-header">
          <div class="utility-content">
            <div class="location-section">
              <button class="location-btn" @click="setLocation()">
                <span class="material-icons">place</span>
                <span v-if="zipCode">Change Location [{{ zipCode }}]</span>
                <span v-else>Set Location</span>
              </button>
            </div>
          </div>
        </div>
      </template>
    </Header>
    <div class="search-desktop-parent" v-if="!favorites">
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
                v-if="autocompleteSectionHeaderSvg(section)"
                :src="`/assets/images/${autocompleteSectionHeaderSvg(section)}.svg`"
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
    <h1 class="large favorites" v-if="favorites">
      Favorites <span class="favorites-title-count" v-if="favoritesCount">({{ favoritesCount }})</span>
    </h1>
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
          <div class="scientific-name-line" v-if="plantGenus || plantSpecies">
            <span class="scientific-name-text">
              <button
                v-if="plantGenus"
                type="button"
                class="taxon-link taxon-link--scientific"
                @click="applyGenusFilter(plantGenus)"
              >
                {{ plantGenus }}
              </button>
              <span v-if="plantSpecies" class="species-text">{{ plantSpecies }}</span>
            </span>
          </div>
          <div class="taxon-meta" v-if="plantFamily">
            <span class="taxon-label">Family:</span>
            <button
              type="button"
              class="taxon-link taxon-link--meta"
              @click="applyFamilyFilter(plantFamily)"
            >
              {{ plantFamily }}
            </button>
          </div>
          <p v-if="selected['Blurb']">{{ selected["Blurb"] }}</p>
          <p v-if="selected['Flowering Months']">
            Flowering Months:
            {{ selected["Flowering Months"] }}
          </p>
          <p v-if="selected['Height (feet)']">
            Height: {{ selected["Height (feet)"] }} feet
          </p>
          <p v-if="selected['Spread (feet)']">
            Spread: {{ selected["Spread (feet)"] }} feet
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
        <div class="controls">
          <!-- Favorites toolbar: preferences + actions -->
          <div v-if="favorites" class="favorites-toolbar">
            <div class="favorites-toolbar-row">
              <div class="favorites-prefs">
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

                <div class="favorites-prefs-stack">
                  <div class="photo-mode-toggle" role="group" aria-label="Photos">
                    <button
                      type="button"
                      class="photo-mode-button"
                      :class="{ active: photoMode === 'habitat' }"
                      @click="setPhotoMode('habitat')"
                      :aria-pressed="photoMode === 'habitat'"
                    >
                      Habitat
                    </button>
                    <button
                      type="button"
                      class="photo-mode-button"
                      :class="{ active: photoMode === 'studio' }"
                      @click="setPhotoMode('studio')"
                      :aria-pressed="photoMode === 'studio'"
                    >
                      Studio
                    </button>
                  </div>

                  <!-- Quick Add (Favorites only): plant autocomplete that adds favorites on select -->
                  <div class="favorites-quick-add">
                    <div class="favorites-quick-add-input">
                      <span class="material-icons">search</span>
                      <input
                        v-model="quickAddQ"
                        type="text"
                        class="favorites-quick-add-text"
                        placeholder="Quick add a plant (e.g., Bloodroot)"
                        maxlength="200"
                        @input="handleQuickAddInput"
                        @focus="quickAddOpen = true"
                        @blur="handleQuickAddBlur"
                        @keydown.enter.prevent="handleQuickAddEnter"
                      />
                    </div>
                    <div
                      v-if="quickAddOpen && quickAddPlants.length"
                      class="favorites-quick-add-dropdown"
                      ref="quickAddDropdown"
                    >
                      <button
                        v-for="p in quickAddPlants"
                        :key="p.plantId"
                        type="button"
                        class="favorites-quick-add-item"
                        @mousedown.prevent="selectQuickAddPlant(p)"
                      >
                        <div class="favorites-quick-add-item-title">{{ p.commonName || p.displayText }}</div>
                        <div v-if="p.scientificName || p.subtitle" class="favorites-quick-add-item-subtitle">
                          {{ p.scientificName || p.subtitle }}
                        </div>
                        <div class="favorites-quick-add-item-cta" aria-hidden="true">Add</div>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div class="favorites-actions" aria-label="Actions">
                <div class="favorites-actions-buttons" aria-live="polite">
                  <button
                    type="button"
                    class="secondary action-button copy-button"
                    :class="{ copied: isCopied }"
                    @click="copyFavorites"
                    :disabled="!favoritesAvailable || !results.length || isCopied"
                  >
                    <span v-if="isCopied">✓ Copied!</span>
                    <span v-else>Copy</span>
                  </button>
                  <button type="button" class="primary action-button bulk-add-button" @click="openBulkAdd">
                    Bulk Add
                  </button>
                  <button
                    type="button"
                    class="secondary action-button planner-button"
                    :disabled="!favoritesAvailable"
                    @click="favoritesAvailable && $router.push('/planner')"
                  >
                    Garden Planner
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Default (browse) toolbar -->
          <div v-else>
            <div class="filter-toggle-and-sort">
              <button
                class="primary primary-bar filter"
                @click="openFilters"
              >
                Filter
              </button>
              <div class="sort-and-favorites">
                <button
                  class="favorites"
                  :disabled="!favoritesAvailable"
                  @click="favoritesAvailable && $router.push('/favorites')"
                  :aria-label="
                    favoritesCount > 0
                      ? 'Favorites (' + displayFavoritesCount + ')'
                      : 'Favorites'
                  "
                >
                  <span class="material-icons material-align">favorite</span
                  ><span class="favorites-label">&nbsp;Favorites</span>
                  <span
                    v-if="favoritesCount > 0"
                    class="favorites-count-badge"
                    aria-hidden="true"
                  >
                    {{ displayFavoritesCount }}
                  </span>
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

            <div class="photo-mode-row">
              <div class="photo-mode-toggle" role="group" aria-label="Photos">
                <button
                  type="button"
                  class="photo-mode-button"
                  :class="{ active: photoMode === 'habitat' }"
                  @click="setPhotoMode('habitat')"
                  :aria-pressed="photoMode === 'habitat'"
                >
                  Habitat
                </button>
                <button
                  type="button"
                  class="photo-mode-button"
                  :class="{ active: photoMode === 'studio' }"
                  @click="setPhotoMode('studio')"
                  :aria-pressed="photoMode === 'studio'"
                >
                  Studio
                </button>
              </div>
            </div>
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
                        v-if="autocompleteSectionHeaderSvg(section)"
                        :src="`/assets/images/${autocompleteSectionHeaderSvg(section)}.svg`"
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
              v-for="filter in filtersForPane"
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
          <template v-if="favorites && !favoritesCount && !loading">
            <section class="favorites-empty" aria-live="polite">
              <h2>No favorites yet</h2>
              <p>Paste common or scientific names to add many at once.</p>
              <div class="favorites-empty-actions">
                <button type="button" class="primary" @click="$router.push('/')">Browse plants</button>
                <button type="button" class="secondary" @click="openBulkAdd">Bulk Add</button>
              </div>
            </section>
          </template>
          <article v-else class="plants">
            <article
              v-for="result in results"
              :key="result._id"
              class="plant-preview-wrapper"
              :class="{ 'plant-preview-wrapper--added': recentlyAddedIds.includes(result._id) }"
              role="link"
              tabindex="0"
              :aria-label="`View details for ${result['Common Name']}`"
              @click="onTileActivate(result, $event)"
              @keydown.enter.prevent="onTileKeyActivate(result, $event)"
              @keydown.space.prevent="onTileKeyActivate(result, $event)"
            >
              <div class="plant-preview">
                <div
                  class="photo"
                  :class="{
                    'photo--studio': photoMode === 'studio',
                    'photo--habitat': photoMode !== 'studio',
                  }"
                  :style="imageStyle(result, true)"
                >
                  <div class="view-details-hint" aria-hidden="true">
                    View details
                  </div>

                  <!-- Favorite button: always top-right so it never overlaps the plant name text -->
                  <button
                    @click.stop.prevent="toggleFavorite(result._id)"
                    class="tile-favorite text"
                    :aria-label="
                      $store.state.favorites.has(result._id)
                        ? `Remove ${result['Common Name']} from favorites`
                        : `Add ${result['Common Name']} to favorites`
                    "
                  >
                    <span class="material-icons material-align">{{
                      renderFavorite(result._id)
                    }}</span>
                  </button>

                  <div v-if="photoMode !== 'studio'" class="name-scrim">
                    <div class="name-text">
                      <h4 class="common-name">{{ result["Common Name"] }}</h4>
                      <h5 class="scientific-name">
                        {{ result["Scientific Name"] }}
                      </h5>
                    </div>
                  </div>
                </div>

                <div v-if="photoMode === 'studio'" class="caption">
                  <div class="caption-text">
                    <h4 class="common-name">{{ result["Common Name"] }}</h4>
                    <h5 class="scientific-name">
                      {{ result["Scientific Name"] }}
                    </h5>
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
            <!-- Infinite scroll sentinel: keep it anchored to the *results* column,
                 not after <main> (desktop filters column can add large bottom space). -->
            <div ref="next" class="infinite-scroll-sentinel" aria-hidden="true"></div>
          </article>
        </div>
    </main>
    <BulkAddFavoritesModal
      :open="bulkAddOpen"
      v-model="bulkAddText"
      :loading="bulkAddLoading"
      :result="bulkAddResult"
      @close="closeBulkAdd"
      @submit="submitBulkAdd"
    />
    <div v-if="toastMessage" class="toast" role="status" aria-live="polite">
      {{ toastMessage }}
    </div>
  </div>
</template>

<script>
import qs from "qs";
import Range from "./Range.vue";
import Checkbox from "./Checkbox.vue";
import Header from "./Header.vue";
import Menu from "./Menu.vue";
import BulkAddFavoritesModal from "./BulkAddFavoritesModal.vue";

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
    BulkAddFavoritesModal,
  },
  props: {
    favorites: {
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
        name: "Genus",
        label: "Genus",
        choices: [],
        value: [],
        array: true,
        counts: {},
        initiallyOpen: false,
        alwaysOpen: false,
        showIcon: false,
        hideInFilterPane: true,
      },
      {
        name: "Family",
        label: "Family",
        choices: [],
        value: [],
        array: true,
        counts: {},
        initiallyOpen: false,
        alwaysOpen: false,
        showIcon: false,
        hideInFilterPane: true,
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
        hideInFilterPane: true,
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
        double: true,
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
        name: "Spread (feet)",
        range: true,
        double: true,
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
      "Sort by Height (Tallest First)": "Height (Tallest First)",
      "Sort by Height (Shortest First)": "Height (Shortest First)",
      "Sort by Spread (Widest First)": "Spread (Widest First)",
      "Sort by Spread (Thinnest First)": "Spread (Thinnest First)",
    }).map(([value, label]) => ({ value, label }));

    this.defaultFilterValues = getDefaultFilterValues(filters);


    const twoUpIndex = 0;
    return {
      results: [],
      total: 0,
      page: 1,
      loading: false,
      loadedAll: false,
      checkingLoadMore: false, // Guard flag to prevent concurrent "load next page" calls
      fetchRequestId: 0,
      activeFetchRequestId: 0,
      infiniteObserver: null,
      scrollFallbackHandler: null,
      maybeLoadMoreRaf: null,
      submitTimeout: null,
      updatingCountsTimeout: null,
      initializing: false,
      determinedFilterCounts: false,
      isLoadingLocation: false,
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
      twoUpIndex,
      isCopied: false,
      bulkAddOpen: false,
      bulkAddText: "",
      bulkAddLoading: false,
      bulkAddResult: null,
      toastMessage: "",
      toastTimeout: null,
      recentlyAddedIds: [],
      quickAddQ: "",
      quickAddOpen: false,
      quickAddResults: [],
      quickAddTimeout: null,
      showAutocomplete: false,
      autocompleteResults: { query: "", sections: [] },
      autocompleteTimeout: null,
      hasExtractedFilters: false,
      suppressFilterWatcher: false, // Flag to prevent watcher from triggering submit during programmatic updates
    };
  },
  computed: {
    selectedName() {
      return this.$route.params.name;
    },
    filtersForPane() {
      return (this.filters || []).filter((f) => !f.hideInFilterPane);
    },
    plantGenus() {
      if (!this.selected) return null;
      // Prefer Genus field, fallback to parsing Scientific Name
      if (this.selected.Genus) {
        return this.selected.Genus;
      }
      if (this.selected["Scientific Name"]) {
        const parts = this.selected["Scientific Name"].trim().split(/\s+/);
        return parts[0] || null;
      }
      return null;
    },
    plantSpecies() {
      if (!this.selected) return null;
      // Prefer Species field, fallback to parsing Scientific Name
      if (this.selected.Species) {
        return this.selected.Species;
      }
      if (this.selected["Scientific Name"]) {
        const parts = this.selected["Scientific Name"].trim().split(/\s+/);
        return parts.length > 1 ? parts.slice(1).join(" ") : null;
      }
      return null;
    },
    plantFamily() {
      if (!this.selected) return null;
      return this.selected.Family || this.selected["Plant Family"] || null;
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
      return this.favoritesCount > 0;
    },
    favoritesCount() {
      // Favorites are stored as a Set in Vuex; convert to an array for stable, reactive length tracking.
      return [...this.$store.state.favorites].length;
    },
    photoMode() {
      return this.$store.state.photoMode || "habitat";
    },
    displayFavoritesCount() {
      return this.favoritesCount > 99 ? "99+" : String(this.favoritesCount);
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
    quickAddPlants() {
      return Array.isArray(this.quickAddResults) ? this.quickAddResults : [];
    },
  },
  watch: {
    selectedName() {
      this.fetchSelectedIfNeeded();
    },
    favorites() {
      this.determineFilterCountsAndSubmit();
      // Favorites view does not page; ensure infinite scroll is correctly enabled/disabled.
      this.$nextTick(() => {
        if (this.favorites) {
          this.teardownInfiniteScroll();
        } else {
          this.setupInfiniteScroll();
        }
      });
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
        // Don't trigger submit if we're programmatically updating filter values
        // (e.g., when adjusting height/spread ranges to match new bounds)
        if (this.suppressFilterWatcher) {
          return;
        }
        // Cancel any ongoing operations to ensure fresh submit with correct sort
        this.checkingLoadMore = false;
        // Wait for Vue to fully update the reactive state before submitting
        await this.$nextTick();
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
    await this.determineFilterCounts();
    this.page = 1;
    this.loadedAll = false;
    this.total = 0;
    await this.fetchPage(true);
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
    this.setupInfiniteScroll();
  },
  beforeUnmount() {
    this.teardownInfiniteScroll();
    if (this.submitTimeout) {
      clearTimeout(this.submitTimeout);
      this.submitTimeout = null;
    }
    if (this.updatingCountsTimeout) {
      clearTimeout(this.updatingCountsTimeout);
      this.updatingCountsTimeout = null;
    }
    if (this.autocompleteTimeout) {
      clearTimeout(this.autocompleteTimeout);
      this.autocompleteTimeout = null;
    }
    if (this.maybeLoadMoreRaf) {
      cancelAnimationFrame(this.maybeLoadMoreRaf);
      this.maybeLoadMoreRaf = null;
    }
  },
  methods: {
    autocompleteSectionHeaderSvg(section) {
      if (!section || section.type !== "filter") return null;
      const name = section.filterName || section.label;
      if (name === "Family") return "Family";
      if (name === "Genus") return "Genus";
      if (section.items && section.items.length > 0 && section.items[0] && section.items[0].svg) {
        return section.items[0].svg;
      }
      return null;
    },
    /**
     * Build query params for /api/v1/plants.
     *
     * Important: For range filters (Height/Spread/etc), the UI dynamically updates
     * filter bounds (filter.min/filter.max) based on the currently filtered set.
     * If the user is at the full current range, the filter should be considered
     * "inactive" and MUST NOT be sent to the server, otherwise the backend will
     * interpret it as an active constraint relative to the *global* range.
     */
    buildPlantsQueryParams(params) {
      const cleanedParams = {};
      for (const [key, value] of Object.entries(params || {})) {
        if (value === undefined || value === null) {
          continue;
        }
        // Filter out empty arrays to prevent serialization issues
        if (Array.isArray(value)) {
          if (value.length > 0) {
            cleanedParams[key] = value;
          }
          continue;
        }
        // Omit range filters when at the current bounds (i.e., not active)
        if (typeof value === "object" && "min" in value && "max" in value) {
          const filter = this.filters?.find((f) => f.name === key);
          if (
            filter &&
            filter.range &&
            typeof filter.min === "number" &&
            typeof filter.max === "number" &&
            value.min === filter.min &&
            value.max === filter.max
          ) {
            continue;
          }
          cleanedParams[key] = value;
          continue;
        }
        cleanedParams[key] = value;
      }
      return cleanedParams;
    },
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
      const svgForArrayItem = (filterName, item) => {
        if (filterName === "Family") return "Family";
        if (filterName === "Genus") return "Genus";
        return item;
      };
      
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
          // Some "array" filters can be scalar strings/booleans on the selected plant
          // (e.g. Genus/Family or boolean flags). Normalize to an array so downstream .forEach works.
          if (!Array.isArray(value)) {
            value = [value];
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
                  svg: svgForArrayItem(filter.name, item),
                  key: filter.name + ":" + item,
                });
              }
            });
          }
        } else if (filter.range) {
          if (active) {
            // Use "Height (feet)" icon for both Height and Spread filters
            const svgName = filter.name === "Spread (feet)" ? "Height (feet)" : filter.name;
            chips.push({
              name: filter.name,
              svg: svgName,
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
                svg: filter.name === "Flower Color Flags" ? null : svgForArrayItem(filter.name, item),
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
      return `background-image: url("${this.imageUrl(selected, false)}"); background-size: cover`;
    },
    onTileActivate(result, evt) {
      // Prevent accidental navigations when clicking nested controls or selecting text.
      if (evt && evt.defaultPrevented) return;
      if (typeof window !== "undefined" && window.getSelection) {
        const selection = window.getSelection();
        if (selection && String(selection).trim()) return;
      }
      this.$router.push(this.plantLink(result));
    },
    onTileKeyActivate(result, evt) {
      // Space should not scroll the page when a tile is focused.
      if (evt && typeof evt.preventDefault === "function") evt.preventDefault();
      this.$router.push(this.plantLink(result));
    },
    imageStyle(image, preview = true) {
      const url = this.imageUrl(image, preview);
      const isStudio = this.photoMode === "studio";
      // Studio tiles should be clean white with no muddy overlay. Habitat readability comes from CSS scrim.
      const backgroundSize = isStudio ? "contain" : "cover";
      const backgroundColor = isStudio ? "#ffffff" : "transparent";
      return `background-image: url("${url}"); background-size: ${backgroundSize}; background-position: center; background-repeat: no-repeat; background-color: ${backgroundColor};`;
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
        // Suppress filter watcher during initial filter setup
        this.suppressFilterWatcher = true;
        try {
          const height = this.filters.find(
            (filter) => filter.name === "Height (feet)"
          );
          if (height) {
            height.min = 0;
            const heights = data.choices["Height (feet)"];
            if (heights && heights.length > 0) {
              height.max = heights[heights.length - 1];
              // Ensure choices array matches the min/max range
              height.choices = [];
              for (let i = height.min; i <= height.max; i++) {
                height.choices.push(i);
              }
              // Set filter value to match the filter bounds (full range) so it doesn't appear active
              this.filterValues["Height (feet)"] = {
                min: height.min,
                max: height.max
              };
            }
          }
          const spread = this.filters.find(
            (filter) => filter.name === "Spread (feet)"
          );
          if (spread) {
            spread.min = 0;
            const spreads = data.choices["Spread (feet)"];
            if (spreads && spreads.length > 0) {
              spread.max = spreads[spreads.length - 1];
              // Ensure choices array matches the min/max range
              spread.choices = [];
              for (let i = spread.min; i <= spread.max; i++) {
                spread.choices.push(i);
              }
              // Set filter value to match the filter bounds (full range) so it doesn't appear active
              this.filterValues["Spread (feet)"] = {
                min: spread.min,
                max: spread.max
              };
            }
          }
        } finally {
          // Keep suppression through the next tick so the deep watcher doesn't
          // fire after we've already re-enabled it.
          await this.$nextTick();
          this.suppressFilterWatcher = false;
        }
        this.determinedFilterCounts = true;
      }
      this.initializing = false;
    },
    imageUrl(result, preview) {
      if (!result || !result._id) return "/assets/images/missing-image.png";
      const id = encodeURIComponent(String(result._id));
      const mode = encodeURIComponent(this.photoMode);
      const p = preview ? "1" : "0";
      return `/api/v1/plant-image/${id}?mode=${mode}&preview=${p}`;
    },
    setPhotoMode(mode) {
      this.$store.commit("setPhotoMode", mode);
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
        // If the user is explicitly choosing a Genus/Family from autocomplete,
        // treat it like a real field filter (NOT semantic search).
        if (item.filterName === "Genus" || item.filterName === "Family") {
          this.activeSearch = "";
          this.hasExtractedFilters = false;
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
    applyGenusFilter(genus) {
      if (!genus) return;
      // Ensure we do a real MongoDB field filter, not semantic search
      this.activeSearch = "";
      this.hasExtractedFilters = false;
      this.q = "";
      // Navigate to home if not already there
      if (this.$route.path !== '/') {
        this.$router.push('/').then(() => {
          this.$nextTick(() => {
            this.addFilterValue("Genus", genus);
          });
        });
      } else {
        this.addFilterValue("Genus", genus);
      }
    },
    applyFamilyFilter(family) {
      if (!family) return;
      // Ensure we do a real MongoDB field filter, not semantic search
      this.activeSearch = "";
      this.hasExtractedFilters = false;
      this.q = "";
      // Navigate to home if not already there
      if (this.$route.path !== '/') {
        this.$router.push('/').then(() => {
          this.$nextTick(() => {
            this.addFilterValue("Family", family);
          });
        });
      } else {
        this.addFilterValue("Family", family);
      }
    },
    addFilterValue(filterName, filterValue) {
      const filter = this.filters.find(f => f.name === filterName);
      if (filter && filter.array) {
        const existing = this.filterValues[filterName] || [];
        if (!existing.includes(filterValue)) {
          this.filterValues[filterName] = [...existing, filterValue];
          this.filterIsOpen[filterName] = true;
        }
      }
      // Submit will be triggered by the filterValues watcher
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
      // Cancel any ongoing "load more" to ensure a clean reset.
      this.checkingLoadMore = false;
      if (this.submitTimeout) {
        clearTimeout(this.submitTimeout);
        this.submitTimeout = null;
      }
      this.submitTimeout = setTimeout(submit.bind(this), 50); // Reduced timeout for faster response

      function submit() {
        // Reset pagination values
        this.page = 1; // Start at page 1 (server expects >= 1)
        this.loadedAll = false;
        this.total = 0; // Reset total as well
        this.checkingLoadMore = false;

        // Fetch new data and replace results when it arrives
        this.fetchPage(true);
        
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
            const cleanedParams = this.buildPlantsQueryParams(params);
            const response = await fetch(
              "/api/v1/plants?" + qs.stringify(cleanedParams, { arrayFormat: "repeat" })
            );
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
      const requestId = ++this.fetchRequestId;
      this.activeFetchRequestId = requestId;
      this.loading = true;
      if (this.favorites && ![...this.$store.state.favorites].length) {
        // Avoid a query that would result in seeing all of the plants
        // in the database as "favorites"
        if (replace) {
          this.results = [];
        }
        this.loadedAll = true;
        this.total = 0;
        if (this.activeFetchRequestId === requestId) {
          this.loading = false;
        }
        return;
      }
      try {
        // Create a fresh copy of filterValues to ensure we have the latest state
        const currentFilterValues = { ...this.filterValues };
        // Ensure sort is always defined - fallback to default if somehow undefined
        const currentSort = this.sort || "Sort by Recommendation Score";
        const params = this.favorites
          ? {
              favorites: [...this.$store.state.favorites],
              sort: currentSort,
            }
          : {
              ...currentFilterValues,
              sort: currentSort,
              page: this.page,
            };
        // Only include search query if there's an active search (explicitly submitted)
        // Don't use this.q directly as it changes while typing
        if (this.activeSearch && this.activeSearch.trim()) {
          params.q = this.activeSearch;
          params.semantic = "true";
        }
        if (this.initializing) {
          // Don't send a bogus query for min 0 max 0
          delete params["Height (feet)"];
          delete params["Spread (feet)"];
        }
        const cleanedParams = this.buildPlantsQueryParams(params);
        const response = await fetch(
          "/api/v1/plants?" + qs.stringify(cleanedParams, { arrayFormat: "repeat" })
        );
        const data = await response.json();

        // Ignore stale responses (e.g., filter/sort changed mid-flight).
        if (this.activeFetchRequestId !== requestId) {
          return;
        }

        if (!this.favorites) {
          this.filterCounts = data.counts;
          for (const filter of this.filters) {
            filter.choices = data.choices[filter.name];
          }
          // Suppress filter watcher to prevent triggering submit() when programmatically updating filter values
          this.suppressFilterWatcher = true;
          try {
          // Update height filter min/max based on filtered plants
          if (data.heightRange && data.heightRange.min !== undefined && data.heightRange.max !== undefined) {
            const heightFilter = this.filters.find(f => f.name === "Height (feet)");
            if (heightFilter) {
              const oldMin = heightFilter.min;
              const oldMax = heightFilter.max;
              // Only update if we have a valid range (max >= min) and it's not the default 0-0 (no plants)
              // Also update if we're initializing (oldMin === oldMax === 0)
              const isInitializing = oldMin === 0 && oldMax === 0;
              if (data.heightRange.max >= data.heightRange.min && (data.heightRange.max > 0 || isInitializing)) {
                heightFilter.min = data.heightRange.min;
                heightFilter.max = data.heightRange.max;
                // Regenerate choices array from min to max to ensure all values are present
                heightFilter.choices = [];
                for (let i = data.heightRange.min; i <= data.heightRange.max; i++) {
                  heightFilter.choices.push(i);
                }
                // Adjust filter value if it's outside the new range
                const currentValue = this.filterValues[heightFilter.name];
                if (currentValue) {
                  let needsUpdate = false;
                  const newValue = { ...currentValue };
                  // Only adjust if the current value is outside the new bounds
                  if (currentValue.min < data.heightRange.min) {
                    newValue.min = data.heightRange.min;
                    needsUpdate = true;
                  }
                  if (currentValue.max > data.heightRange.max) {
                    newValue.max = data.heightRange.max;
                    needsUpdate = true;
                  }
                  // If the current value matches the old bounds (full range), update it to match new bounds
                  // This ensures the filter stays at full range when bounds change due to other filters
                  const wasAtFullRange = currentValue.min === oldMin && currentValue.max === oldMax;
                  if (wasAtFullRange && !isInitializing) {
                    newValue.min = data.heightRange.min;
                    newValue.max = data.heightRange.max;
                    needsUpdate = true;
                  }
                  // Only set to full range on true first initialization (oldMin === oldMax === 0)
                  // AND the current value is at the default (0, 0) - meaning it was never set
                  if (isInitializing && data.heightRange.max >= data.heightRange.min) {
                    const isUninitialized = currentValue.min === 0 && currentValue.max === 0;
                    if (isUninitialized) {
                      newValue.min = data.heightRange.min;
                      newValue.max = data.heightRange.max;
                      needsUpdate = true;
                    }
                  }
                  if (needsUpdate) {
                    this.filterValues[heightFilter.name] = newValue;
                  }
                } else {
                  // Initialize to full range if no value set (only on true first initialization)
                  // But only if it's truly uninitialized - if it was set in determineFilterCounts, don't override
                  if (isInitializing) {
                    const existingValue = this.filterValues[heightFilter.name];
                    // Only set if it's still at the default (0, 0) or doesn't exist
                    if (!existingValue || (existingValue.min === 0 && existingValue.max === 0)) {
                      this.filterValues[heightFilter.name] = {
                        min: data.heightRange.min,
                        max: data.heightRange.max
                      };
                    }
                  }
                }
              }
            }
          }
          // Update spread filter min/max based on filtered plants
          if (data.spreadRange && data.spreadRange.min !== undefined && data.spreadRange.max !== undefined) {
            const spreadFilter = this.filters.find(f => f.name === "Spread (feet)");
            if (spreadFilter) {
              const oldMin = spreadFilter.min;
              const oldMax = spreadFilter.max;
              // Only update if we have a valid range (max >= min) and it's not the default 0-0 (no plants)
              // Also update if we're initializing (oldMin === oldMax === 0)
              const isInitializing = oldMin === 0 && oldMax === 0;
              if (data.spreadRange.max >= data.spreadRange.min && (data.spreadRange.max > 0 || isInitializing)) {
                spreadFilter.min = data.spreadRange.min;
                spreadFilter.max = data.spreadRange.max;
                // Regenerate choices array from 0 to max to ensure all values are present
                // The Range component's labelListStyle uses the value directly, so we need all values from 0 to max
                spreadFilter.choices = [];
                for (let i = 0; i <= data.spreadRange.max; i++) {
                  spreadFilter.choices.push(i);
                }
                // Ensure max matches the last choice in the array
                if (spreadFilter.choices.length > 0) {
                  spreadFilter.max = spreadFilter.choices[spreadFilter.choices.length - 1];
                }
                // Adjust filter value if it's outside the new range
                const currentValue = this.filterValues[spreadFilter.name];
                if (currentValue) {
                  let needsUpdate = false;
                  const newValue = { ...currentValue };
                  // Only adjust if the current value is outside the new bounds
                  if (currentValue.min < data.spreadRange.min) {
                    newValue.min = data.spreadRange.min;
                    needsUpdate = true;
                  }
                  if (currentValue.max > data.spreadRange.max) {
                    newValue.max = data.spreadRange.max;
                    needsUpdate = true;
                  }
                  // If the current value matches the old bounds (full range), update it to match new bounds
                  // This ensures the filter stays at full range when bounds change due to other filters
                  const wasAtFullRange = currentValue.min === oldMin && currentValue.max === oldMax;
                  if (wasAtFullRange && !isInitializing) {
                    newValue.min = data.spreadRange.min;
                    newValue.max = data.spreadRange.max;
                    needsUpdate = true;
                  }
                  // Only set to full range on true first initialization (oldMin === oldMax === 0)
                  // AND the current value is at the default (0, 0) - meaning it was never set
                  if (isInitializing && data.spreadRange.max >= data.spreadRange.min) {
                    const isUninitialized = currentValue.min === 0 && currentValue.max === 0;
                    if (isUninitialized) {
                      newValue.min = data.spreadRange.min;
                      newValue.max = data.spreadRange.max;
                      needsUpdate = true;
                    }
                  }
                  if (needsUpdate) {
                    this.filterValues[spreadFilter.name] = newValue;
                  }
                } else {
                  // Initialize to full range if no value set (only on true first initialization)
                  // But only if it's truly uninitialized - if it was set in determineFilterCounts, don't override
                  if (isInitializing) {
                    const existingValue = this.filterValues[spreadFilter.name];
                    // Only set if it's still at the default (0, 0) or doesn't exist
                    if (!existingValue || (existingValue.min === 0 && existingValue.max === 0)) {
                      this.filterValues[spreadFilter.name] = {
                        min: data.spreadRange.min,
                        max: data.spreadRange.max
                      };
                    }
                  }
                }
              }
            }
          }
        } finally {
          // Keep suppression through the next tick so the deep watcher doesn't
          // fire after we've already re-enabled it.
          await this.$nextTick();
          this.suppressFilterWatcher = false;
        }
      }
        if (!data.results.length || this.favorites) {
          this.loadedAll = true;
        }

        if (replace) {
          this.results = data.results;
        } else {
          // Prevent duplicate plants by checking if they already exist in the results array
          const existingIds = new Set(this.results.map((r) => r._id));
          for (const datum of data.results) {
            if (!existingIds.has(datum._id)) {
              this.results.push(datum);
              existingIds.add(datum._id);
            }
          }
        }

        this.total = data.total;

        // If the sentinel is already in/near view (short result sets, or user at bottom),
        // keep loading additional pages.
        this.scheduleMaybeLoadMore("post-fetch");
      } catch (error) {
        if (this.activeFetchRequestId === requestId) {
          console.error("Error fetching plants:", error);
        }
      } finally {
        if (this.activeFetchRequestId === requestId) {
          this.loading = false;
        }
      }
    },

    setupInfiniteScroll() {
      if (typeof window === "undefined") return;
      if (this.favorites) return;

      this.teardownInfiniteScroll();

      const sentinel = this.$refs.next;
      if (!sentinel) return;

      // Always attach a scroll/resize handler. In some layouts the observer can be
      // delayed; this also covers browsers where IO is flaky.
      this.scrollFallbackHandler = () => {
        this.scheduleMaybeLoadMore("scroll");
      };
      window.addEventListener("scroll", this.scrollFallbackHandler, { passive: true });
      window.addEventListener("resize", this.scrollFallbackHandler, { passive: true });

      if ("IntersectionObserver" in window) {
        this.infiniteObserver = new IntersectionObserver(
          (entries) => {
            if (entries.some((e) => e.isIntersecting)) {
              this.maybeLoadMore("observer");
            }
          },
          { root: null, rootMargin: "2000px 0px", threshold: 0 }
        );
        this.infiniteObserver.observe(sentinel);
      }

      // If we're already near the bottom (or results are short), kick off a load.
      this.scheduleMaybeLoadMore("setup");
    },

    teardownInfiniteScroll() {
      if (this.infiniteObserver) {
        this.infiniteObserver.disconnect();
        this.infiniteObserver = null;
      }
      if (this.scrollFallbackHandler && typeof window !== "undefined") {
        window.removeEventListener("scroll", this.scrollFallbackHandler);
        window.removeEventListener("resize", this.scrollFallbackHandler);
        this.scrollFallbackHandler = null;
      }
    },

    scheduleMaybeLoadMore() {
      if (typeof window === "undefined") return;
      if (this.favorites) return;
      if (this.maybeLoadMoreRaf) {
        cancelAnimationFrame(this.maybeLoadMoreRaf);
      }
      this.maybeLoadMoreRaf = requestAnimationFrame(() => {
        this.maybeLoadMoreRaf = null;
        if (this.isNextSentinelNearViewport()) {
          this.maybeLoadMore("sentinel-near");
        }
      });
    },

    isNextSentinelNearViewport(pixels = 2000) {
      if (typeof window === "undefined") return false;
      const sentinel = this.$refs.next;
      if (!sentinel || typeof sentinel.getBoundingClientRect !== "function") return false;
      const rect = sentinel.getBoundingClientRect();
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      return rect.top <= viewportHeight + pixels;
    },

    async maybeLoadMore() {
      if (typeof window === "undefined") return;
      if (this.favorites) return;
      if (this.loadedAll || this.loading) return;
      if (this.checkingLoadMore) return;

      this.checkingLoadMore = true;
      try {
        this.page += 1;
        await this.fetchPage(false);
      } finally {
        this.checkingLoadMore = false;
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
        } else if (filter && filter.range) {
          // For range filters, set to match the current filter bounds (full range)
          // This ensures the filter is not active after removing the chip
          this.filterValues[chip.name] = {
            min: filter.min,
            max: filter.max
          };
        } else if (filter) {
          this.filterValues[chip.name] = filter.default;
        }
        
        // Don't clear activeSearch when removing filter chips
        // This allows semantic search to continue working with remaining filters
        
        // If activeSearch is empty or doesn't have meaningful content, and we're sorting by Search Relevance,
        // switch back to the previous sort to ensure proper sorting when filters are removed
        if ((!this.activeSearch || !this.activeSearch.trim() || !this.getRemainingQueryText(this.activeSearch).trim()) && 
            this.sort === "Sort by Search Relevance") {
          if (this.previousSort) {
            this.sort = this.previousSort;
          } else {
            // Fallback to default sort if previousSort is not set
            this.sort = "Sort by Recommendation Score";
          }
        }
        
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
        if (filter.range) {
          // For range filters, set to match the current filter bounds (full range)
          // This ensures the filter is not active after clearAll
          this.filterValues[filter.name] = {
            min: filter.min,
            max: filter.max
          };
        } else {
          this.filterValues[filter.name] = filter.default;
        }
      }
      this.q = "";
      this.activeSearch = "";
      this.hasExtractedFilters = false;
      // If we're sorting by Search Relevance but there's no active search, switch back to previous sort
      if (this.sort === "Sort by Search Relevance") {
        if (this.previousSort) {
          this.sort = this.previousSort;
        } else {
          // Fallback to default sort if previousSort is not set
          this.sort = "Sort by Recommendation Score";
        }
      }
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
    openBulkAdd() {
      this.bulkAddOpen = true;
      this.bulkAddResult = null;
    },
    closeBulkAdd() {
      this.bulkAddOpen = false;
    },
    showToast(message) {
      this.toastMessage = message;
      if (this.toastTimeout) {
        clearTimeout(this.toastTimeout);
        this.toastTimeout = null;
      }
      this.toastTimeout = setTimeout(() => {
        this.toastMessage = "";
        this.toastTimeout = null;
      }, 2500);
    },
    handleQuickAddInput() {
      if (this.quickAddTimeout) {
        clearTimeout(this.quickAddTimeout);
        this.quickAddTimeout = null;
      }
      const q = String(this.quickAddQ || "").trim();
      if (q.length < 2) {
        this.quickAddResults = [];
        return;
      }
      this.quickAddTimeout = setTimeout(async () => {
        try {
          const response = await fetch(`/api/v1/autocomplete?q=${encodeURIComponent(q)}`);
          const data = await response.json();
          const sections = Array.isArray(data?.sections) ? data.sections : [];
          const plantSection = sections.find((s) => s && s.type === "plant");
          const items = Array.isArray(plantSection?.items) ? plantSection.items : [];
          // Plant-only results
          this.quickAddResults = items
            .filter((i) => i && (i.plantId || i._id))
            .map((i) => ({
              plantId: i.plantId || i._id,
              commonName: i.commonName || i["Common Name"] || i.displayText,
              scientificName: i.scientificName || i["Scientific Name"] || i.subtitle,
              displayText: i.displayText,
              subtitle: i.subtitle,
            }))
            .slice(0, 10);
        } catch (e) {
          console.error("Quick add autocomplete error:", e);
          this.quickAddResults = [];
        }
      }, 180);
    },
    handleQuickAddBlur() {
      // Allow click selection via @mousedown; delay close to avoid losing selection
      setTimeout(() => {
        this.quickAddOpen = false;
      }, 120);
    },
    async selectQuickAddPlant(p) {
      const id = p?.plantId;
      if (!id) return;
      if (!this.$store.state.favorites.has(id)) {
        this.$store.commit("addFavorites", [id]);
        this.recentlyAddedIds = [id];
        setTimeout(() => {
          this.recentlyAddedIds = [];
        }, 1800);
      }
      this.quickAddQ = "";
      this.quickAddResults = [];
      this.quickAddOpen = false;

      if (this.favorites) {
        await this.fetchPage(true);
      }
    },
    async handleQuickAddEnter() {
      // If there's a top suggestion, add it.
      if (this.quickAddPlants.length) {
        await this.selectQuickAddPlant(this.quickAddPlants[0]);
      }
    },
    async submitBulkAdd(text) {
      if (this.bulkAddLoading) return;
      const payload = typeof text === "string" ? text : "";
      if (!payload.trim()) return;

      this.bulkAddLoading = true;
      this.bulkAddResult = null;
      try {
        const response = await fetch("/api/v1/plants/resolve-names", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: payload }),
        });
        const contentType = (response.headers.get("content-type") || "").toLowerCase();
        const rawBody = await response.text();
        const data = contentType.includes("application/json") ? JSON.parse(rawBody || "{}") : null;
        if (!response.ok) {
          throw new Error((data && data.error) || rawBody || "Bulk add failed");
        }
        if (!data) {
          throw new Error("Bulk add failed: server returned a non-JSON response");
        }

        const matchedIds = Array.isArray(data?.matchedIds) ? data.matchedIds : [];
        const notFound = Array.isArray(data?.notFound) ? data.notFound : [];

        const already = [];
        const toAdd = [];
        for (const id of matchedIds) {
          if (this.$store.state.favorites.has(id)) {
            already.push(id);
          } else {
            toAdd.push(id);
          }
        }

        if (toAdd.length) {
          this.$store.commit("addFavorites", toAdd);
        }

        this.recentlyAddedIds = toAdd;
        if (this.recentlyAddedIds.length) {
          setTimeout(() => {
            this.recentlyAddedIds = [];
          }, 1800);
        }

        // Refresh results if we are on the favorites page.
        if (this.favorites) {
          await this.fetchPage(true);
        }

        // One concise toast so users feel the click "did something"
        let toast = "";
        if (toAdd.length) toast = `Added ${toAdd.length} favorite(s)`;
        else if (already.length) toast = "All matches were already in favorites";
        else toast = "No matches found";
        if (notFound.length) toast += ` • ${notFound.length} not found`;
        this.showToast(toast);

        this.bulkAddResult = {
          addedCount: toAdd.length,
          alreadyCount: already.length,
          notFound,
        };
      } catch (e) {
        console.error("Bulk add error:", e);
        this.showToast(e?.message || "Bulk add failed");
      } finally {
        this.bulkAddLoading = false;
      }
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
  margin-bottom: 10px;
}

.photo-mode-row {
  max-width: 350px;
  margin: auto;
  margin-bottom: 12px;
}

/* Mobile/tablet spacing: keep sort + photo toggle closer together */
@media all and (max-width: 1280px) {
  .sort-and-favorites {
    margin-bottom: 8px;
  }
  .photo-mode-row {
    margin-bottom: 10px;
  }
  .favorites-prefs-stack {
    gap: 6px;
  }
}

.photo-mode-toggle {
  display: flex;
  width: 100%;
  border: 1px solid #b74d15;
  border-radius: 999px;
  overflow: hidden;
  background: #fcf9f4;
}

.photo-mode-button {
  flex: 1 1 0;
  border: none;
  border-radius: 0;
  padding: 10px 12px;
  font-size: 16px;
  font-family: Roboto;
  background: transparent;
  color: #b74d15;
}

.photo-mode-button + .photo-mode-button {
  border-left: 1px solid #b74d15;
}

.photo-mode-button.active {
  background: #b74d15;
  color: #fcf9f4;
}

.photo-mode-button:focus-visible {
  outline: 3px solid rgba(183, 77, 21, 0.35);
  outline-offset: -3px;
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
  position: relative;
}

button.favorites .favorites-count-badge {
  position: absolute;
  right: 10px;
  top: 10px;
  transform: none;
  background: #B74D15;
  color: #fff;
  min-width: 18px;
  height: 18px;
  border-radius: 999px;
  font-family: Roboto, sans-serif;
  font-size: 10px;
  font-weight: 700;
  display: grid;
  place-items: center;
  padding: 0 6px;
  line-height: 1;
  text-align: center;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0;
  box-shadow:
    0 0 0 2px #fcf9f4,
    0 1px 2px rgba(0, 0, 0, 0.25);
  pointer-events: none;
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
.favorites-toolbar {
  max-width: 1000px;
  margin: 0 auto 16px;
}
.favorites-toolbar-row {
  display: flex;
  gap: 16px;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
}
.favorites-prefs {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
  min-width: 320px;
  flex: 1 1 420px;
}
.favorites-prefs-stack {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1 1 320px;
}
.favorites-prefs .sort {
  flex: 1 1 260px;
  min-width: 260px;
}
.favorites-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  flex: 0 1 520px;
}
.favorites-actions-buttons {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.favorites-quick-add {
  position: relative;
  width: min(420px, 100%);
}
.favorites-quick-add-input {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid rgba(0, 0, 0, 0.18);
  border-radius: 12px;
  padding: 10px 12px;
  background: #fff;
}
.favorites-quick-add-input .material-icons {
  color: #555;
  font-size: 18px;
}
.favorites-quick-add-text {
  border: none;
  outline: none;
  width: 100%;
  font-family: Roboto;
  font-size: 14px;
  background: transparent;
  color: #1d2e26;
}
.favorites-quick-add-text::placeholder {
  color: #777;
}
.favorites-quick-add-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  background: #fff;
  border: 1px solid rgba(0,0,0,0.18);
  border-radius: 12px;
  box-shadow: 0 10px 24px rgba(0,0,0,0.18);
  max-height: 280px;
  overflow: auto;
  z-index: 1000;
}
.favorites-quick-add-item {
  width: 100%;
  text-align: left;
  background: transparent;
  border: none;
  padding: 10px 12px;
  border-top: 1px solid rgba(0,0,0,0.06);
  cursor: pointer;
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-rows: auto auto;
  column-gap: 10px;
}
.favorites-quick-add-item:hover {
  background: rgba(183, 77, 21, 0.06);
}
.favorites-quick-add-item-title {
  font-family: Roboto;
  font-size: 14px;
  font-weight: 700;
  color: #1d2e26;
  grid-column: 1 / 2;
  grid-row: 1 / 2;
}
.favorites-quick-add-item-subtitle {
  font-family: Roboto;
  font-size: 12px;
  color: #555;
  margin-top: 2px;
  grid-column: 1 / 2;
  grid-row: 2 / 3;
}
.favorites-quick-add-item-cta {
  grid-column: 2 / 3;
  grid-row: 1 / 3;
  align-self: center;
  justify-self: end;
  font-family: Roboto;
  font-size: 12px;
  font-weight: 700;
  color: #b74d15;
  border: 1px solid rgba(183, 77, 21, 0.45);
  border-radius: 999px;
  padding: 6px 10px;
  background: rgba(183, 77, 21, 0.06);
}
.action-button {
  padding: 10px 12px;
  font-size: 14px;
  border-radius: 10px;
  width: auto;
}
.favorites-empty {
  background: #fff;
  border: 1px solid rgba(0,0,0,0.12);
  border-radius: 16px;
  padding: 20px;
  max-width: 740px;
}
.favorites-empty h2 {
  margin: 0 0 6px;
  font-family: Arvo;
  font-size: 20px;
  color: #1d2e26;
}
.favorites-title-count {
  font-family: Roboto;
  font-weight: 700;
  font-size: 16px;
  color: #555;
}
.favorites-empty p {
  margin: 0 0 14px;
  font-family: Roboto;
  color: #444;
}
.favorites-empty-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.toast {
  position: fixed;
  left: 50%;
  bottom: 16px;
  transform: translateX(-50%);
  background: rgba(29, 46, 38, 0.95);
  color: #fff;
  padding: 10px 14px;
  border-radius: 999px;
  font-family: Roboto;
  font-size: 13px;
  z-index: 10000;
  box-shadow: 0 8px 18px rgba(0,0,0,0.25);
  max-width: min(92vw, 720px);
  text-align: center;
}
.plants {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(248px, 1fr));
  gap: 8px;
  align-content: start;
}

.infinite-scroll-sentinel {
  /* Keep sentinel at the end of the results grid without affecting layout */
  grid-column: 1 / -1;
  height: 1px;
  width: 100%;
}
.plant-preview-wrapper {
  position: relative;
  cursor: pointer;
  user-select: none;
  outline: none;
}
.plant-preview-wrapper--added .plant-preview {
  box-shadow: 0 0 0 3px rgba(56, 161, 105, 0.28), 0 6px 18px rgba(0,0,0,0.12);
  transform: translateY(-1px);
}
.plant-preview {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  font-family: Roboto;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}
.photo {
  width: 100%;
  aspect-ratio: 1/1;
  position: relative;
  background: #fff;
}
.photo--studio {
  background: #ffffff;
}
.tile-favorite {
  width: 52px;
  height: 52px;
  padding: 0;
  border-radius: 999px;
  position: absolute;
  top: 10px;
  right: 10px;
  background: transparent;
  box-shadow: none;
  border: none;
  appearance: none;
  -webkit-appearance: none;
  -webkit-tap-highlight-color: transparent;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #1d2e26; /* readable over both studio + habitat */
  z-index: 2;
  flex: 0 0 auto;
}
.tile-favorite .material-icons {
  font-size: 28px;
  /* Make the icon readable on photos without adding a visible button background */
  text-shadow:
    0 2px 10px rgba(0, 0, 0, 0.35),
    0 0 2px rgba(255, 255, 255, 0.85);
}

/* Studio photos are already high-contrast on white; remove shadow for a cleaner look */
.photo--studio .tile-favorite .material-icons {
  text-shadow: none;
}

.tile-favorite:focus-visible {
  outline: 3px solid rgba(183, 77, 21, 0.35);
  outline-offset: 2px;
}
.photo--habitat .tile-favorite {
  color: #fff;
}
.photo--habitat .tile-favorite .material-icons {
  /* Help the white outline heart stay visible over bright habitat photos */
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.75));
}
.photo--studio .tile-favorite {
  color: #111;
  background: transparent;
  background-color: transparent;
}
.tile-favorite:focus-visible {
  outline: 3px solid rgba(183, 77, 21, 0.35);
  outline-offset: 2px;
}
.view-details-hint {
  position: absolute;
  top: 12px;
  left: 12px;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  font-family: inherit;
  font-size: 12px;
  letter-spacing: 0.02em;
  opacity: 0;
  transform: translateY(-4px);
  transition: opacity 0.12s ease, transform 0.12s ease;
  pointer-events: none;
}
.name-scrim {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 12px 12px 10px;
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(
    to top,
    rgba(0, 0, 0, 0.74) 0%,
    rgba(0, 0, 0, 0.34) 55%,
    rgba(0, 0, 0, 0) 100%
  );
}
.name-text {
  min-width: 0;
}
.name-scrim .common-name,
.name-scrim .scientific-name {
  color: #fff;
  text-shadow:
    0 2px 6px rgba(0, 0, 0, 0.75),
    0 1px 2px rgba(0, 0, 0, 0.85);
}
.caption {
  padding: 10px 12px 12px;
  background: #fff;
  min-height: 56px; /* reserve space so grid doesn't jump for short/long names */
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.caption-text {
  min-width: 0;
}
.plant-preview .common-name {
  font-size: 15px;
  margin: 0;
  padding: 0;
  font-weight: 650;
  line-height: 1.2;
  display: -webkit-box;
  line-clamp: 2;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.plant-preview .scientific-name {
  font-size: 12px;
  font-style: italic;
  margin: 0;
  padding: 0;
  font-weight: normal;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  opacity: 0.9;
}
.caption .common-name,
.caption .scientific-name {
  color: #1d2e26;
}

.plant-preview-wrapper:focus-visible .plant-preview {
  box-shadow: 0 0 0 3px rgba(183, 77, 21, 0.25);
}
@media (hover: hover) {
  .plant-preview-wrapper:hover .plant-preview {
    transform: translateY(-2px);
    box-shadow: 0 10px 22px rgba(0, 0, 0, 0.1);
  }
  .plant-preview-wrapper:hover .view-details-hint,
  .plant-preview-wrapper:focus-within .view-details-hint {
    opacity: 1;
    transform: translateY(0);
  }
}
@media (hover: none) {
  .view-details-hint {
    display: none;
  }
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

.two-up-image {
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

.scientific-name-line {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 8px 0;
  flex-wrap: wrap;
}

.scientific-name-text {
  font-style: italic;
  font-size: 24px;
  color: #1d2e26;
  font-family: Arvo;
}

.scientific-name-line .species-text {
  font-style: inherit;
  font-size: inherit;
  color: inherit;
  font-family: inherit;
}

.taxon-meta {
  margin: 8px 0;
  font-size: 14px;
  font-family: Roboto;
  color: #1d2e26;
}

.taxon-label {
  opacity: 0.75;
  margin-right: 6px;
}

.taxon-link {
  /* Override global button styling so this reads like inline text */
  background: none;
  border: none;
  border-radius: 0;
  padding: 0;
  margin: 0;
  font: inherit;
  color: inherit;
  letter-spacing: 0;
  cursor: pointer;
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 2px;
}

.taxon-link--scientific {
  /* Keep scientific name readable, but communicate clickability */
  text-decoration-color: rgba(29, 46, 38, 0.45);
}

.taxon-link--scientific + .species-text {
  /* Make the genus/species separation visually obvious */
  margin-left: 0.3ch;
}

.taxon-link--meta {
  text-decoration-color: rgba(29, 46, 38, 0.35);
}

@media (hover: hover) {
  .taxon-link:hover {
    color: #b74d15;
    text-decoration-color: rgba(183, 77, 21, 0.75);
  }
}

.taxon-link:focus-visible {
  outline: 2px solid rgba(183, 77, 21, 0.8);
  outline-offset: 2px;
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
  button.favorites .favorites-count-badge {
    right: 14px;
    top: 50%;
    transform: translateY(-50%);
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
    padding: 16px 32px;
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

/* Compact utility header styles
   Mobile/tablet: centered, clean (no grey bar)
   Desktop (orange hero): left-aligned with the utility bar styling */
.compact-utility-header {
  background: transparent;
  border-bottom: none;
  padding: 8px 16px 0;
  margin-bottom: 11px; /* match other primary controls spacing */
}

.utility-content {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 8px;
}

.location-section {
  width: 100%;
  display: flex;
  justify-content: center;
  flex-shrink: 0;
}

/* Keep default button styling for consistency; just lay out the icon/text nicely */
.location-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  font-size: 14px;
  cursor: pointer;
}

.location-btn .material-icons {
  font-size: 16px;
}

@media screen and (max-width: 768px) {
  .location-btn {
    font-size: 13px;
    padding: 8px 12px;
  }
}

@media all and (min-width: 1280px) {
  .compact-utility-header {
    background-color: #f5f5f5;
    border-bottom: 1px solid #e0e0e0;
    padding: 12px 40px 8px;
    margin-bottom: 8px;
  }

  .utility-content {
    justify-content: flex-start;
  }

  .location-section {
    width: auto;
    justify-content: flex-start;
  }
}
</style>
