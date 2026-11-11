/**
 * Creates the public home hero from prepared content.
 */
export function createHero({
  eyebrow = "TODAY AT NXSPACE",
  title = "探索城市生活",
  description = "",
  primaryAction = { label: "探索活動", href: "#activities" },
  secondaryAction = { label: "認識 NXSPACE", href: "#about" },
  highlights = []
} = {}) {
  return `
    <section class="hero" aria-labelledby="home-hero-title">
      <div class="hero-container">
        <div class="hero-content">
          <span class="hero-tag">${eyebrow}</span>
          <h1 id="home-hero-title" class="hero-title">${title}</h1>
          <p class="hero-description">${description}</p>
          <div class="hero-actions">
            <a class="btn btn-primary" href="${primaryAction.href}" data-route-link>
              ${primaryAction.label}
            </a>
            <a class="btn btn-secondary" href="${secondaryAction.href}" data-route-link>
              ${secondaryAction.label}
            </a>
          </div>
        </div>

        <div class="hero-panel" aria-label="NXSPACE 即時資訊">
          ${highlights.map((highlight) => `
            <article class="hero-card">
              <p class="hero-card-label">${highlight.label}</p>
              <h2 class="hero-card-title">${highlight.title}</h2>
              <div class="hero-card-meta">
                ${highlight.lines.map((line) => `<span>${line}</span>`).join("")}
              </div>
            </article>
          `.trim()).join("")}
        </div>
      </div>
    </section>
  `.trim();
}
