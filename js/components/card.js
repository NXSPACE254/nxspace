/**
 * @file card.js
 * @description Reusable Card component for NXSPACE Platform Beta V1.
 * @module components/card
 */

/**
 * Creates a reusable card component.
 *
 * @param {Object} options
 * @param {string} options.title
 * @param {string} [options.description=""]
 * @param {string} [options.image=""]
 * @param {string} [options.tag=""]
 * @param {string} [options.footer=""]
 * @returns {string}
 */
export function createCard({
  title,
  description = "",
  image = "",
  tag = "",
  footer = ""
}) {
  return `
    <article class="card">

      ${
        image
          ? `
            <div class="card-image">
              <img src="${image}" alt="${title}" width="1200" height="800" loading="lazy" decoding="async">
            </div>
          `
          : ""
      }

      <div class="card-body">

        ${
          tag
            ? `
              <span class="card-tag">
                ${tag}
              </span>
            `
            : ""
        }

        <h3 class="card-title">
          ${title}
        </h3>

        ${
          description
            ? `
              <p class="card-description">
                ${description}
              </p>
            `
            : ""
        }

      </div>

      ${
        footer
          ? `
            <div class="card-footer">
              ${footer}
            </div>
          `
          : ""
      }

    </article>
  `.trim();
}
