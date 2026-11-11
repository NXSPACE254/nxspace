/**
 * @file event-card.js
 * @description Event Card component.
 * @module components/event-card
 */

/**
 * Creates Event Card.
 *
 * @param {Object} options
 * @returns {string}
 */
export function createEventCard({

  image = "",

  tag = "",

  title = "",

  description = "",

  date = "",

  location = "",

  footer = ""

}){

return `

<article class="event-card">

    ${
      image
      ?

      `
      <div class="event-card-image">

          <img
              src="${image}"
              alt="${title}"
              width="1200"
              height="800"
              loading="lazy"
              decoding="async">

      </div>
      `

      : ""

    }

    <div class="event-card-body">

        ${
          tag
          ?

          `
          <span class="event-card-tag">

              ${tag}

          </span>
          `

          : ""

        }

        <h3 class="event-card-title">

            ${title}

        </h3>

        <p class="event-card-description">

            ${description}

        </p>

        <div class="event-card-meta">

            ${
              date
              ?

              `<span>📅 ${date}</span>`

              : ""

            }

            ${
              location
              ?

              `<span>📍 ${location}</span>`

              : ""

            }

        </div>

        ${
          footer
          ?

          `
          <div class="event-card-footer">

              ${footer}

          </div>
          `

          : ""

        }

    </div>

</article>

`.trim();

}
