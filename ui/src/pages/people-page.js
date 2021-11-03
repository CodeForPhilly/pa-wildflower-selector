const { stripIndent } = require('common-tags');
module.exports = {
  slug: '/people-page',
  title: 'People Page',
  h1: 'About us and the project',
  theme: 'light',
  intro: `
    Many of us came together in April 2021, to join Zachary Leahan in this Code for
    Philly Project. Some of us joined on a little later on, but whether here for a
    short time or a long time or somewhere in between, we were all on fire to get
    this built in order to help gardeners from novice to expert find native plants
    to put into their gardens. For many of us, it is an app we had always wanted,
    for others, it was a chance to learn a lot about native plants. The project’s
    original name was the PA-Wildflower Selector. This initial idea that began with
    Zachary creating a Tableau project to utilize a database he had found, morphed
    over many months into the responsive web application you find here today. 
  `,
  headings: {
    'The team': {
      class: 'page-facing',
      html: `
        <p>
          The team consisted of 3 UX Designers fresh from bootcamp/flex programs,
          a seasoned developer, a new developer, a technical CPA, and a data engineer.
          So many varied backgrounds and side interests in this bunch. What a great
          team to work with.
        </p>
        <section class="page-people-grid">
          <article class="page-person">
      `
    },
    'The context': {
      class: 'page-facing',
      html: `
        <ul>
          <li>
            <p>
              This project is a <a href="http://codeforphilly.org">Code for Philly Project.</a>
              This web site is open source under a GPL license.
            </p>
          </li>
          <li>
            <p>
              The database for this lookup tool is based upon Mark Skinner’s USDA database:
            </p>
            <p>
              United States Department of Agriculture and US Federal Highway Administration.
              2017. <a href="http://www.nativerevegetation.org/era/">National database</a>
              for pollinator-friendly revegetation and restoration. Compiled by Mark W. Skinner,
              Gretchen LeBuhn, David Inouye, Terry Griswold, and Jennifer Hopwood. Online at .
              Contact <a href="http://mwskinner55@gmail.com)">Mark W. Skinner</a>
              for updates or more information.
            </p>
          </li>
        </ul>
      `
    },
    'The directions': {
      class: 'page-running',
      html: `
        <p>
          Once you land on <a href="http://choosenativeplants.com">choosenativeplants.com</a>,
          decide if you just want to answer 5 questions to find some plants or if you want to
          use some filters.
        </p>
        <h4>Using filters</h4>
        <ul>
          <li>
            Tap the orange filter button and see the drawer of filters slide
            out from the left
          </li>
          <li>
            Go through the choices, opening and closing the accordions by tapping
            the down chevron to see all the choices for life cycle, plant type,
            sun exposure, water needs, pollinator attractors, color, availability
            whether online, local or both, height and bloom month
          </li>
          <li>
            After selecting all that apply to your needs, tap the apply button
            to the top left of the filter drawer
          </li>
          <li>
            The drawer will then close, and the columns of plant images you now
            see on the main page will be those that you filtered for.
          </li>
          <li>
            You can sort this list by tapping on the Sort By drop down.
            Choices for sort by include Common Name and Scientific Name.
          </li>
          <li>
            The small “i” ‘s that are superscripts on some terms are info tooltips.
            Hover if on a desktop or long press on a mobile device and the tooltip
            will explain the term.
          </li>
        </ul>
        <h4>Using 5 questions to find plants</h4>
        <ul>
          <li>
            Tap on the link that says “Not sure where to start? Answer 5 questions “
          </li>
          <li>
            A page with question number 1 will open.
          </li>
          <li>
            Answer each question in turn. at the last page of questions,
            you will see a “Show plants button.” Tap this button to return to the main page,
            which now has a list of plants and images that represent the answers to your
            questions.
          </li>
          <li>
            After selecting all that apply to your needs, tap the apply button to the top
            left of the filter drawer
          </li>
          <li>You can sort this list by tapping on the Sort By drop down. Choices for sort
            by include, height, name (latin and common), and color
          </li>
          <li>
            The small “i” ‘s that are superscripts on some terms are info tooltips. Hover
            if on a desktop or long press on a mobile device and the tooltip will explain
            the term.
          </li>
        </ul>
        <h4>Favoriting Plants</h4>
        <ul>
          <li>
            Tap the heart on any image to add it to your favorite list
          </li>
          <li>
            This list allows you to essentially save what you are liking or
            want to check out later
          </li>
          <li>Unfavorite the plant by tapping the heart, it will no longer
            be a filled in heart, but an outlined heart. outlined heart = not a favorite;
            filled-in heart = favorite.
          </li>
        </ul>
        <h4>See your favorites</h4>
        <ul>
          <li>
            Tap the favorite list button
          </li>
          <li>
            This takes you to a page similar to the main page that shows only
            your favorites that you have selected.
          </li>
          <li>
            There is a “sort by” button, which you can tap to sort this list
            according to height, color, latin or common name.
          </li>
          <li>
            You can unfavorite a plant by tapping the heart and it will turn
            the heart back into an outlined heart which means “not favorite”
          </li>
        </ul>
        <h4>Get more info</h4>
        <ul>
          <li>
            Any of the image blocks has a “more info” link on it. Tap this link to
            open a POP UP that shows a larger picture of the plant, might give a
            description, and lists more characteristics of the plant. All the labels
            have tooltips which when hovered on or long pressed will give the definition
            of the label if needed
          </li>
        </ul>
        <h4>Find the plants</b>
        <ul>
          <li>
            Open the hamburger menu and tap on PA Nurseries. This will lead you to a
            page that lists 5 PA nurseries that are known to carry many species.
          </li>
          <li>
            The Nursery’s address, phone number and email are listed. Please contact
            the Nursery to determine if your favorite plants are in stock yet.
          </li>
          <li>
            The online website for each nursery is also listed. Some of the nurseries
            will allow online ordering.
          </li>
          <li>
            Once you have your favorite list, you can google for additional online sellers.
          </li>
        </ul>
        <h4>Reporting bugs</h4>
        <ul>
          <li>
            If you find a glitch in the website or incorrect information, tap the hamburger
            menu and then tap Bug Report. This will take you to the bug report page.
            Follow the directions on this page to file a bug report
          </li>
        </ul>
        <h4>Contact us</h4>
        <ul>
          <li>
            Open the hamburger menu. Tap on Contact to open the Contact page.
            Follow the directions on the page to Contact the site administrator
            if you have a question about the project, the data, a suggestion or information
            about additional PA Nurseries that can be added.
          </li>
        </ul>
      `
    },
    'The terms': {
      class: 'page-running',
      h2: 'The terms &amp; conditions',
      html: `
        <h3>
          Last updated October 04, 2021
        </h3>
        <h3>
          AGREEMENT TO TERMS
        </h3>
        <p>
          TBD (project released under GPL)
        </p>
      `
    }
  }
};
