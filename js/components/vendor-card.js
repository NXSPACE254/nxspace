/**
 * @file vendor-card.js
 * @description Vendor Card component for NXSPACE Platform Beta V1.
 * @module components/vendor-card
 */

/**
 * Creates a Vendor Card.
 *
 * @param {Object} options
 * @param {string} [options.image=""]
 * @param {string} [options.tag=""]
 * @param {string} [options.title=""]
 * @param {string} [options.description=""]
 * @param {string} [options.footer=""]
 * @returns {string}
 */
export function createVendorCard({

  image = "",

  tag = "",

  title = "",

  description = "",

  footer = ""

}) {

  return `

<article class="vendor-card">

  ${
    image
      ? `
      <div class="vendor-card-image">
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

  <div class="vendor-card-body">

    ${
      tag
        ? `
        <span class="vendor-card-tag">
          ${tag}
        </span>
        `
        : ""
    }

    <h3 class="vendor-card-title">
      ${title}
    </h3>

    <p class="vendor-card-description">
      ${description}
    </p>

    ${
      footer
        ? `
        <div class="vendor-card-footer">
          ${footer}
        </div>
        `
        : ""
    }

  </div>

</article>

  `.trim();

}
