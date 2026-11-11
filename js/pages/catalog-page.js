import { createStateView } from "../components/state-view.js";

const DEFAULT_PAGE_SIZE = 6;

function normalizeText(value = "") {
  return String(value).trim().toLocaleLowerCase("zh-Hant-TW");
}

function getSearchText(item = {}) {
  return normalizeText([
    item.title,
    item.description,
    item.content,
    item.tag,
    item.vendor,
    item.location
  ].filter(Boolean).join(" "));
}

export function filterAndSortCatalogItems({
  items = [],
  query = "",
  category = "",
  sorter
} = {}) {
  const normalizedQuery = normalizeText(query);
  const filteredItems = items.filter((item) => {
    const matchesQuery = !normalizedQuery || getSearchText(item).includes(normalizedQuery);
    const matchesCategory = !category || item.tag === category;
    return matchesQuery && matchesCategory;
  });

  return sorter ? [...filteredItems].sort(sorter) : filteredItems;
}

export function createPageHeader({ eyebrow = "NXSPACE", title = "", description = "" } = {}) {
  return `
    <header class="page-hero">
      <div class="page-container page-hero-inner">
        <p class="page-eyebrow">${eyebrow}</p>
        <h1>${title}</h1>
        <p>${description}</p>
      </div>
    </header>
  `.trim();
}

export function createCatalogPage({
  id = "catalog",
  eyebrow = "EXPLORE",
  title = "探索內容",
  description = "",
  items = [],
  renderCard = () => "",
  searchLabel = "搜尋",
  sortOptions = []
} = {}) {
  const categories = [...new Set(items.map((item) => item.tag).filter(Boolean))];
  const initialItems = items.slice(0, DEFAULT_PAGE_SIZE);

  return `
    <section class="public-page" data-catalog-root="${id}">
      ${createPageHeader({ eyebrow, title, description })}

      <div class="page-container catalog-layout">
        <form class="catalog-toolbar" data-catalog-form role="search">
          <label class="field-group catalog-search">
            <span>${searchLabel}</span>
            <input
              type="search"
              name="query"
              placeholder="輸入關鍵字"
              autocomplete="off"
              data-catalog-query>
          </label>

          <label class="field-group">
            <span>分類</span>
            <select name="category" data-catalog-category>
              <option value="">全部分類</option>
              ${categories.map((category) => `<option value="${category}">${category}</option>`).join("")}
            </select>
          </label>

          <label class="field-group">
            <span>排序</span>
            <select name="sort" data-catalog-sort>
              <option value="default">推薦排序</option>
              ${sortOptions.map(({ value, label }) => `<option value="${value}">${label}</option>`).join("")}
            </select>
          </label>
        </form>

        <div class="catalog-summary" role="status" aria-live="polite" data-catalog-summary>
          共 ${items.length} 筆內容
        </div>

        <div class="catalog-results home-event-grid" data-catalog-results>
          ${initialItems.map((item) => renderCard(item)).join("")}
        </div>

        <div class="catalog-actions">
          <button
            class="btn btn-secondary"
            type="button"
            data-catalog-load-more
            ${items.length <= DEFAULT_PAGE_SIZE ? "hidden" : ""}>
            載入更多
          </button>
        </div>
      </div>
    </section>
  `.trim();
}

export function initializeCatalogPage({
  id = "catalog",
  items = [],
  renderCard = () => "",
  sorters = {},
  pageSize = DEFAULT_PAGE_SIZE
} = {}) {
  const root = document.querySelector(`[data-catalog-root="${id}"]`);

  if (!root) {
    return;
  }

  const form = root.querySelector("[data-catalog-form]");
  const queryInput = root.querySelector("[data-catalog-query]");
  const categoryInput = root.querySelector("[data-catalog-category]");
  const sortInput = root.querySelector("[data-catalog-sort]");
  const results = root.querySelector("[data-catalog-results]");
  const summary = root.querySelector("[data-catalog-summary]");
  const loadMore = root.querySelector("[data-catalog-load-more]");
  let visibleCount = pageSize;

  function getFilteredItems() {
    const sorter = sorters[sortInput.value];

    return filterAndSortCatalogItems({
      items,
      query: queryInput.value,
      category: categoryInput.value,
      sorter
    });
  }

  function renderResults() {
    try {
      const filteredItems = getFilteredItems();
      const visibleItems = filteredItems.slice(0, visibleCount);

      summary.textContent = `共 ${filteredItems.length} 筆內容，顯示 ${visibleItems.length} 筆`;

      if (filteredItems.length === 0) {
        results.innerHTML = createStateView({
          type: "empty",
          title: "找不到符合條件的內容",
          description: "請調整關鍵字或分類後再試一次。",
          action: '<button class="btn btn-secondary" type="button" data-clear-filters>清除篩選</button>'
        });
        loadMore.hidden = true;
        return;
      }

      results.innerHTML = visibleItems.map((item) => renderCard(item)).join("");
      loadMore.hidden = visibleItems.length >= filteredItems.length;
    } catch (error) {
      console.error("[NXSPACE] Catalog rendering failed.", error);
      results.innerHTML = createStateView({
        type: "error",
        title: "內容載入失敗",
        description: "請重新整理頁面後再試一次。",
        action: '<button class="btn btn-secondary" type="button" data-catalog-retry>重新載入</button>'
      });
      loadMore.hidden = true;
    }
  }

  function resetAndRender() {
    visibleCount = pageSize;
    renderResults();
  }

  form.addEventListener("submit", (event) => event.preventDefault());
  queryInput.addEventListener("input", resetAndRender);
  categoryInput.addEventListener("change", resetAndRender);
  sortInput.addEventListener("change", resetAndRender);

  loadMore.addEventListener("click", () => {
    visibleCount += pageSize;
    renderResults();
  });

  root.addEventListener("click", (event) => {
    if (event.target.closest("[data-clear-filters]")) {
      form.reset();
      resetAndRender();
      queryInput.focus();
    }

    if (event.target.closest("[data-catalog-retry]")) {
      renderResults();
    }
  });
}

export function createDetailPage({
  eyebrow = "NXSPACE",
  item,
  backHref = "#home",
  backLabel = "返回列表",
  meta = [],
  action = ""
} = {}) {
  if (!item) {
    return "";
  }

  return `
    <article class="public-page detail-page">
      <div class="page-container detail-breadcrumb">
        <a class="text-link" href="${backHref}" data-route-link>← ${backLabel}</a>
      </div>

      <header class="page-container detail-header">
        <div>
          <p class="page-eyebrow">${eyebrow}</p>
          <h1>${item.title}</h1>
          <p>${item.description}</p>
        </div>
        ${item.image ? `<img src="${item.image}" alt="${item.title}" width="1200" height="675" loading="lazy" decoding="async">` : ""}
      </header>

      <div class="page-container detail-layout">
        <div class="detail-content">
          <h2>內容介紹</h2>
          <p>${item.content}</p>
          ${action}
        </div>
        <dl class="detail-meta" aria-label="詳細資訊">
          ${meta.map(({ label, value }) => `
            <div>
              <dt>${label}</dt>
              <dd>${value}</dd>
            </div>
          `.trim()).join("")}
        </dl>
      </div>
    </article>
  `.trim();
}
