<template>
  <Page
    slug="/people-page"
    title="About"
    h1="About us and the project"
  >
    <p>
      We came together in April 2021 to join Zach Leahan in this Code for Philly project, 
      building a tool to help gardeners find native plants for their gardens. What began 
      as a Tableau project using a discovered database evolved into the responsive web 
      application you see today.
    </p>
    <menu>
      <li><a href="#the-team">The team</a></li>
      <li><a href="#the-purpose">The purpose</a></li>
      <li><a href="#the-context">The context</a></li>
      <li><a href="#the-directions">The directions</a></li>
      <li><a href="#the-terms">The terms</a></li>
    </menu>
    <div class="tone">
      <div class="carrier-wave">
        <img src="/assets/images/wave-top-dark.png" class="wave" />
      </div>
      <article>
        <div class="facing">
          <h3 id="the-team">The team</h3>
          <div>
            <p>
              Our diverse team includes UX designers, developers, and data specialists 
              with varied backgrounds and shared passion for native plants.
            </p>
          </div>
        </div>
        <section class="people-grid">
          <Person image="zach-leahan" alt="Photo of Zach Leahan">
            <h4>Project Sponsor &amp; Data Guru</h4>
            <p>
              Zach Leahan is a Director within Product Development at PwC
              Digital. Zach looks for opportunities to leverage his tech skills
              outside of work for the common good. Zach is an avid native plant
              gardener to support wildlife, especially birds and bees.
            </p>
          </Person>
          <Person image="cristina-zanoni" alt="Photo of Cristina Zanoni">
            <h4>Design - UX/UI</h4>
            <p>
              Cristina Zanoni is a Brazilian UX Designer based in Philadelphia.
              Empathy, curiosity, and inclusion play a significant role in her
              day-to-day life. She volunteers with @ibelongphilly to increase
              immigrant visibility. When not working, she loves walking around
              discovering art hidden around Philly. Reach her at
              <a href="https://cristinazanoni.com" target="_blank"
                >cristinazanoni.com</a
              >.
            </p>
          </Person>
          <Person image="anne-marie-lloyd" alt="Photo of Anne-Marie Lloyd">
            <h4>Design - UX/UI</h4>
            <p>
              Anne-Marie Lloyd is a UX Designer with CapTech with a background in
              market research. She's an advocate for accessible and ethical
              product design, and uses her cross-disciplinary knowledge to bring
              fresh perspectives to her design work. In her free time she enjoys
              skiing, hiking, and playing with her rescue dog. Drop her a line and
              check out her work at
              <a href="https://annemarielloyd.com">annemarielloyd.com</a>.
            </p>
          </Person>
          <Person image="roxanne-g" alt="Photo of Roxanne G">
            <h4>Design - UX/UI</h4>
            <p>
              Roxanne G is a full-time UX/UI designer with Assetworks, LLC and a
              freelance WordPress website creator who is also an avid gardener,
              crafter, and mother of 2. Roxanne believes technology should be used
              for the greater good; to serve humanity and the planet. Check out
              her work at
              <a href="https://roxanneg.design">roxanneg.design</a>.
            </p>
          </Person>
          <Person image="tom-boutell" alt="Photo of Tom Boutell">
            <h4>Development / Code Engineer</h4>
            <p>
              Tom Boutell is the CTO of
              <a href="https://apostrophecms.com" target="_blank"
                >Apostrophe Technologies</a
              >. As a longtime developer he enjoys the mentorship aspect of his
              job most, as well as software architecture and hands-on programming.
              He's fond of classic video games, matcha lattes and pedaling around
              Philadelphia. You can drop him a line at
              <a href="https://boutell.dev" target="_blank">boutell.dev</a> or on
              <a href="https://twitter.com/boutell" target="_blank">Twitter</a>.
            </p>
          </Person>
          <Person image="ella-heron" alt="Photo of Ella Heron">
            <h4>Development / Code Engineer</h4>
            <p>
              Ella Heron is a sound artist, educator, software engineer, and
              aspiring agrarian living on occupied Lenapehoking. She wants to
              cultivate interdependence and put chestnut trees back on Chestnut
              Street. Check out her work at
              <a href="https://diaphanous.cloud/">diaphanous.cloud</a>.
            </p>
          </Person>
          <Person image="anthony-hopkins" alt="Photo of Anthony Hopkins">
            <h4>Data Engineer</h4>
            <p>
              Anthony Hopkins is a budding data engineer/scientist and amateur baker. When he
              isn't trying out a new recipe for scones or muffins, he's building his knowledge
              of data. Anthony is particularly interested in data justice and the growing
              conversations around biases in data algorithms.
            </p>
          </Person>
          <Person image="kio-p" alt="Photo of Kio P">
            <h4>Development / Code Engineer</h4>
            <p>
            Kio is an aspiring Librarian and definitely not a bona fide city nymph. Kio currently 
            works in IT, tech, and various customer support capacities, and absolutely cannot charm 
            privateers to lose their stolen goods. In Kio’s spare time they enjoy acting, 
            playing piano, and never shape-shifting.
            </p>
          </Person>
          <Person image="charles-leahan" alt="Photo of Charles Leahan">
            <h4>Data Specialist</h4>
            <p>
              Charles Leahan is an aspiring data scientist, self-taught programmer and math lover. 
              He also enjoys lifting, trail running and plays too much online chess. 
            </p>
          </Person>
        </section>
      </article>
      <div class="carrier-wave">
        <img src="/assets/images/wave-bottom-dark.png" class="wave" />
      </div>
    </div>
    <div class="tone light">
      <div class="carrier-wave">
        <img src="/assets/images/wave-top-light.png" class="wave" />
      </div>
      <article>
        <div class="facing">
          <h3 id="the-purpose">The purpose</h3>
          <div>
            <p>
              This site helps gardeners of all experience levels find PA native plants 
              for their gardens and discover which nurseries carry them or where to 
              purchase them online.
            </p>
          </div>
        </div>
      </article>
      <article>
        <div class="facing">
          <h3 id="the-context">The context</h3>
          <p>
            This is a <a href="https://codeforphilly.org/projects/pa_wildflower_selector" target="_blank">Code for Philly Project</a>, 
            an open source application under a GPL license. Source code is available on 
            <a href="https://github.com/CodeForPhilly/pa-wildflower-selector" target="_blank">GitHub</a>.
          </p>
          <p>
            The database is based on Mark Skinner's USDA database: United States Department 
            of Agriculture and US Federal Highway Administration. 2017. 
            <a href="http://www.nativerevegetation.org/era/">National database</a> for 
            pollinator-friendly revegetation and restoration. Compiled by Mark W. Skinner, 
            Gretchen LeBuhn, David Inouye, Terry Griswold, and Jennifer Hopwood. Contact 
            <a href="mailto:mwskinner55@gmail.com">Mark W. Skinner</a> for updates. 
            Raw plant data is available in our 
            <a href="https://docs.google.com/spreadsheets/d/1R_zhN3GUxhDEMlGFMhcPB_gAoaE9IoyWi10I_nM9f3o/edit?gid=1957761759" target="_blank">Google Sheets database</a>.
          </p>
        </div>
      </article>
      <article>
        <h3 id="the-directions">The directions</h3>
        <h4>Using filters</h4>
        <ul>
          <li>Tap the orange filter button to open the filter drawer</li>
          <li>Browse filter options: life cycle, plant type, sun exposure, water needs, pollinator attractors, color, availability, height, and bloom month</li>
          <li>"Super Plants" are popular and highly recommended in local gardening circles</li>
          <li>Tap Apply to filter results, then use Sort By to organize by Common or Scientific Name</li>
          <li>Hover (desktop) or long press (mobile) on "i" tooltips for term explanations</li>
        </ul>
        <h4>Favoriting and viewing plants</h4>
        <ul>
          <li>Tap the heart icon on any plant to add it to favorites (filled heart = favorited, outlined = not favorited)</li>
          <li>View your favorites page via the favorites button, where you can sort by height, color, or name</li>
          <li>Tap "more info" on any plant card to see a larger image, description, and detailed characteristics</li>
        </ul>
        <h4>Finding plants</h4>
        <ul>
          <li>Visit the Nurseries page (hamburger menu) to find nurseries that carry native species</li>
          <li>Contact information and websites are listed for each nursery; some offer online ordering</li>
        </ul>
        <h4>Contact us</h4>
        <p>
          <a href="mailto:contact@choosenativeplants.com">contact@choosenativeplants.com</a>
        </p>
      </article>
      <div class="carrier-wave">
        <img src="/assets/images/wave-bottom-light.png" class="wave" />
      </div>
    </div>
    <article>
      <h3 id="the-terms">The terms</h3>
      <p>
        By using this website, you agree to the terms below. This site and its data 
        are maintained by volunteers and offered "as is" with no warranty of completeness 
        or accuracy. Data should not be cited in scholarly publications. We are not 
        accountable for errors or omissions.
      </p>
      <p>
        Do not rely on this site for edibility or medicinal information. Consult medical 
        professionals before ingesting or applying any plants.
      </p>
      <p>
        Bot scraping is not permitted. Contact us for the dataset. Source code is available 
        on <a href="https://github.com/CodeForPhilly/pa-wildflower-selector">GitHub</a> under 
        a GPL license, meaning any enhancements must also be open source.
      </p>
      <p>
        Favorites are stored only in your browser's local storage. No session tracking or 
        cookies are used. We are not responsible for offensive content that may appear.
      </p>
      <p>© 2025 Choose Native Plants - USA</p>
    </article>
    <Up />
    <div class="tone">
      <div class="carrier-wave">
        <img src="/assets/images/wave-top-dark.png" class="wave" />
      </div>
    </div>
  </Page>
</template>

<script>
import Page from './Page.vue';
import Person from './Person.vue';
import Up from './Up.vue';

export default {
  name: 'PeoplePage',
  components: {
    Page, Person, Up
  }
};

</script>

<style scoped>
.people-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 8px;
  flex-direction: column;
}
</style>
