/**
 * @file section.js
 * @description Reusable Section component for NXSPACE Platform Beta V1.
 * @module components/section
 */

/**
 * Creates a reusable content section.
 *
 * @param {Object} options
 * @param {string} options.title
 * @param {string} [options.subtitle=""]
 * @param {string} [options.content=""]
 * @returns {string}
 */
export function createSection({
  title,
  subtitle = "",
  content = ""
}) {
  return `
    <section class="section">

      <div class="section-container">

        <div class="section-header">

          <h2 class="section-title">
            ${title}
          </h2>

          ${
            subtitle
              ? `
                <p class="section-subtitle">
                  ${subtitle}
                </p>
              `
              : ""
          }

        </div>

        <div class="section-content">
          ${content}
        </div>

      </div>

    </section>
  `.trim();
}