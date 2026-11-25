import { createChristmasApi } from './services/christmas-api.js';
import { christmasDate } from './pages/christmas.js';
import { initializeChristmasBrowse } from './pages/christmas-browse.js';
import { initializePinOwner } from './pages/christmas-direct.js';

const campaign = document.querySelector('[data-public-campaign]');
const privacy = document.querySelector('[data-public-privacy]');
const publicRoot = new URL('../../', import.meta.url);
const apiPath = new URL('christmas-api', publicRoot).pathname;
const policyPath = new URL('privacy/', publicRoot).pathname;
function showInitialCopy() {
  document.querySelectorAll('[data-initial-copy]').forEach(section=>section.removeAttribute('data-initial-copy'));
}

function renderPolicy(body) {
  for (const block of body.split(/\n\s*\n/)) {
    const node = document.createElement(block.startsWith('### ') ? 'h3' : block.startsWith('## ') ? 'h2' : 'p');
    node.className = 'christmas-preserve';
    node.textContent = block.replace(/^#{1,3} /gm,'').replace(/\*\*/g,'');
    privacy.append(node);
  }
}

try {
  const response = await fetch(apiPath + '/public/config', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error();
  const config = await response.json();
  if (!config.enabled || config.baseUrl !== apiPath) throw new Error();
  const api = await createChristmasApi({ configuration: config });
  if (privacy) {
    const policy = config.privacy ? await api.public('/privacy') : null;
    if (policy) privacy.querySelector('[role="status"]').textContent = `版本 ${policy.version} · 生效 ${christmasDate(policy.effectiveAt)}`;
    if (policy) {
      renderPolicy(policy.body);
      const contact = document.createElement('p');
      contact.textContent = '聯絡方式：' + policy.contact;
      privacy.append(contact);
    }
  }
  if (campaign) {
    const browseMarkup = campaign.innerHTML;
    let initialBrowse = campaign.querySelector(':scope > [data-christmas]');
    const footer = document.querySelector('[data-public-campaign-footer]');
    const holding = !config.browse && initialBrowse
      ? '<section class="container christmas"><h1>NXSPACE 聖誕心願公益計畫</h1><p>目前暫停公開心願瀏覽。</p></section>'
      : campaign.innerHTML;
    const render = async () => {
      const hash = location.hash;
      const ownerPage = hash === '#christmas/manage' && config.owner;
      if (footer) footer.hidden = ownerPage;
      if (ownerPage) {
        campaign.innerHTML = '<section class="container christmas p31-owner"><h1>我的認領管理</h1><div class="christmas-owner-login" data-owner-login></div><p role="status" data-owner-result></p><div data-owner-list></div><a class="btn btn-secondary" href="#christmas">返回聖誕心願</a></section>';
        await initializePinOwner(campaign.firstElementChild, api);
      } else if (config.browse) {
        if (!initialBrowse?.isConnected) campaign.innerHTML = browseMarkup;
        const root = campaign.firstElementChild;
        initialBrowse = null;
        root.querySelector('a[href="#christmas/manage"]').hidden = !config.owner;
        await initializeChristmasBrowse({ root, api, code: hash.match(/^#christmas\/wishes\/(NX-\d{3,12})$/)?.[1] });
        root.querySelectorAll('a[href="/privacy/"]').forEach(link => { link.href = policyPath; });
      } else {
        campaign.innerHTML = holding;
        if (config.owner) {
          const link = document.createElement('a');
          link.href = '#christmas/manage';
          link.textContent = '查詢我的認領';
          campaign.firstElementChild.append(link);
        }
      }
    };
    const safeRender = () => render().catch(() => {
      campaign.innerHTML = holding;
      if (footer) footer.hidden = false;
    }).finally(showInitialCopy);
    window.addEventListener('hashchange', safeRender);
    window.addEventListener('pageshow', event => {
      if (event.persisted && config.browse) location.reload();
    });
    await safeRender();
  }
} catch {
  showInitialCopy();
  const status = campaign?.querySelector('[data-christmas-content] [role="status"]');
  if (status) status.textContent = '目前無法取得最新心願，請稍後重新整理。';
}

if (privacy && privacy.childElementCount === 2) {
  try {
    const draft = await fetch(new URL('public-assets/privacy-v1.0.md', publicRoot), { cache: 'no-store', signal: AbortSignal.timeout(10000) });
    if (draft.ok) renderPolicy(await draft.text());
  } catch { /* The page continues to identify the policy as unpublished. */ }
}
