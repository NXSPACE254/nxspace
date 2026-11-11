/**
 * Creates an actionable quick-entry card.
 */
export function createQuickEntryCard({
  icon = "",
  title = "",
  description = "",
  href = "#home"
} = {}) {
  return `
    <a class="quick-entry-item" href="${href}" data-route-link>
      <span class="quick-entry-icon" aria-hidden="true">${icon}</span>
      <h3 class="quick-entry-title">${title}</h3>
      <p class="quick-entry-description">${description}</p>
      <span class="visually-hidden">前往${title}</span>
    </a>
  `.trim();
}
