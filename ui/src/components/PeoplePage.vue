<template>
  <Page
    slug="/people-page"
    title="People Page"
    h1="About us and the project"
    theme="light"
  >
    <p>
      Many of us came together in April 2021, to join Zachary Leahan in this
      Code for Philly Project. Some of us joined on a little later on, but
      whether here for a short time or a long time or somewhere in between, we
      were all on fire to get this built in order to help gardeners from
      novice to expert find native plants to put into their gardens. For many
      of us, it is an app we had always wanted, for others, it was a chance to
      learn a lot about native plants. The project’s original name was the
      PA-Wildflower Selector. This initial idea that began with Zachary
      creating a Tableau project to utilize a database he had found, morphed
      over many months into the responsive web application you find here
      today.
    </p>
    <menu>
      <li><a href="#the-team">The team</a></li>
      <li><a href="#the-tools">The tools</a></li>
      <li><a href="#the-method">The method</a></li>
    </menu>
    <article class="page-facing">
      <h3 id="the-team">The team</h3>
      <p>
        The team consisted of 3 UX Designers fresh from bootcamp/flex programs,
        a seasoned developer, a new developer, a technical CPA, and a data
        engineer. So many varied backgrounds and side interests in this bunch.
        What a great team to work with.
      </p>
      <section class="people-grid">
        <Person image="zach-leahan" alt="Photo of Zach Leahan">
          <h4>Project Sponsor &amp; Data Guru</h4>
          <p>
            Zach Leahan is a Senior Manager within Product Development at PwC
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
      </section>
    </article>
    <article class="page-running">
      <h3 id="the-tools">The tools</h3>
      <p>
        Here is a short list of the tools used to keep us organized and get
        things going.
      </p>
      <ul>
        <li>Notion</li>
        <li>Figma</li>
        <li>Slack</li>
        <li>Maze</li>
        <li>Github</li>
        <li>Javascript</li>
        <li>Vue</li>
        <li>MongoDB</li>
      </ul>
    </article>
    <article class="page-facing">
      <h3 id="the-method">The method</h3>
      <ul>
        <li>We began meeting April 12, 2021</li>
        <li>Many discussions and sketches ensued</li>
        <li>
          A Survey was created and sent out to many Facebook groups an
          subreddits to help define what functionality would be included in the
          MVP
        </li>
        <li>
          An analysis of the data was completed and functionality was determined
        </li>
        <li>Wireframes were crafted in Figma</li>
        <li>
          A competitive analysis was completed and existing plant finders were
          analyzed
        </li>
        <li>The database was discussed and explained</li>
        <li>A style guide was decided upon</li>
        <li>A high fidelity prototype was completed</li>
        <li>
          A Maze test was completed by testers from the facebook groups and
          subredits
        </li>
        <li>Many iterations of hi-fi prototype design were completed</li>
        <li>The responsive mobile-first website design was coded</li>
        <li>
          The project was launched on [insert date] in time for Spring planting
          season in Pennsylvania.
        </li>
      </ul>
    </article>
  </Page>
</template>

<script>
import Page from './Page.vue';
import Person from './Person.vue';

export default {
  name: 'PeoplePage',
  components: {
    Page, Person
  }
};

</script>
