const stateIcons = {
  loading: "◌",
  empty: "○",
  error: "!",
  notFound: "404"
};

export function createStateView({
  type = "empty",
  title = "目前沒有內容",
  description = "請稍後再回來看看。",
  action = "",
  headingLevel = "h2"
} = {}) {
  const isLoading = type === "loading";
  const headingTag = headingLevel === "h1" ? "h1" : "h2";

  return `
    <section
      class="state-view state-view-${type}"
      ${isLoading ? 'role="status" aria-live="polite"' : ""}>
      <span class="state-view-icon" aria-hidden="true">${stateIcons[type] || stateIcons.empty}</span>
      <${headingTag} class="state-view-title">${title}</${headingTag}>
      <p class="state-view-description">${description}</p>
      ${action}
    </section>
  `.trim();
}
