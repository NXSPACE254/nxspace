/**
 * @file product-card.js
 * @description Product Card component for NXSPACE Platform Beta V1.
 * @module components/product-card
 */

/**
 * Creates Product Card.
 *
 * @param {Object} options
 * @param {string} [options.image=""]
 * @param {string} [options.tag=""]
 * @param {string} [options.title=""]
 * @param {string} [options.description=""]
 * @param {string} [options.price=""]
 * @param {string} [options.footer=""]
 * @returns {string}
 */
export function createProductCard({

  image = "",

  tag = "",

  title = "",

  description = "",

  price = "",

  footer = ""

}) {

  return `

<article class="product-card">

  ${
    image
      ? `
      <div class="product-card-image">
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

  <div class="product-card-body">

    ${
      tag
        ? `
        <span class="product-card-tag">
          ${tag}
        </span>
        `
        : ""
    }

    <h3 class="product-card-title">
      ${title}
    </h3>

    <p class="product-card-description">
      ${description}
    </p>

    ${
      price
        ? `
        <div class="product-card-price">
          ${price}
        </div>
        `
        : ""
    }

    ${
      footer
        ? `
        <div class="product-card-footer">
          ${footer}
        </div>
        `
        : ""
    }

  </div>

</article>

  `.trim();

}
