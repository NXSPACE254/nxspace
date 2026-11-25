import { collectionSites } from './operational-policy.mjs';
import { createAccessVerifier } from './access-auth.mjs';
import { CampaignExperience } from './campaign-experience.mjs';
import { campaignSettings, cleanSingleTestCase, contentEditor, intakeCaseDetail, testCaseCleanupPreview } from './case-workspace.mjs';
import { brandImageIds, brandMediaUsage, readBrandImage, uploadBrandImage } from './campaign-brand-media.mjs';
import { createKeyring } from './crypto.mjs';
import { FulfillmentRepository } from './fulfillment.mjs';
import { intakeWriteRoutes, launchFlags, launchPrivacy, launchStaffRoutes, publicRoute, runPublic } from './launch-routes.mjs';
import { ChristmasManagement } from './management.mjs';
import { bulkWishes } from './operational-policy.mjs';
import { listPlatformAudit, recordPlatformEvent } from './platform-audit.mjs';
import { ChristmasRepository } from './repository.mjs';
import { createD1RateLimiter, securityEvent } from './security.mjs';
import { staffIdentity } from './staff-identity.mjs';
import { standardPasswordMinimum } from './supabase-staff-auth.mjs';
import { UnitOperations } from './unit-operations.mjs';
import { ApiError, isId, readJson } from './validation.mjs';

const safeHeaders = {
  'Cache-Control': 'private, no-store',
  'Content-Security-Policy': "default-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow'
};
const apiPrefix = '/christmas-api';
const verifiedPermissions = new Set(['wish.write', 'child.read', 'staff.manage']);

function json(value, status = 200, cookie = null) {
  return Response.json(value, { status, headers: { ...safeHeaders, ...(cookie ? { 'Set-Cookie': cookie } : {}) } });
}

function parseKeys(value) {
  const keys = JSON.parse(value);
  if (!keys || Array.isArray(keys) || typeof keys !== 'object') throw new ApiError('KEYS_NOT_CONFIGURED', 503);
  return Object.fromEntries(Object.entries(keys).map(([version, key]) => {
    if (!/^[a-zA-Z0-9_-]{1,32}$/.test(version) || typeof key !== 'string' || !/^[a-fA-F0-9]{64}$/.test(key)) throw new ApiError('KEYS_NOT_CONFIGURED', 503);
    return [version, Uint8Array.from(key.match(/../g), byte => Number.parseInt(byte, 16))];
  }));
}

async function createRuntime(env, routeKey, authOnly) {
  const launch = env.DEPLOYMENT_MODE === 'production-launch';
  const localStaff = launch && env.STAFF_AUTH_MODE === 'supabase';
  if ((!launch && env.DEPLOYMENT_MODE !== 'production-intake') || !isId(env.CAMPAIGN_ID) || !env.INTAKE_DB || !env.ASSETS ||
      (!localStaff && (env.STAFF_AUTH_MODE || !env.ACCESS_AUDIENCE))) throw new ApiError('INTAKE_NOT_CONFIGURED', 503);
  const origin = new URL(env.INTAKE_ORIGIN);
  if (origin.protocol !== 'https:' || origin.origin !== env.INTAKE_ORIGIN) throw new ApiError('INTAKE_NOT_CONFIGURED', 503);
  const cryptoService = await createKeyring({
    encryptionKeys: parseKeys(env.INTAKE_ENCRYPTION_KEYS), requestKeys: parseKeys(env.INTAKE_REQUEST_KEYS),
    activeEncryptionVersion: env.INTAKE_ENCRYPTION_VERSION, activeRequestVersion: env.INTAKE_REQUEST_VERSION
  });
  // Keep authorization reads on the primary even if the database adds replicas.
  const db = env.INTAKE_DB.withSession('first-primary');
  const identity = localStaff ? staffIdentity(db, cryptoService, env) : null;
  const verifyAccess = identity?.authenticate ?? createAccessVerifier({ issuer: env.ACCESS_ISSUER, audience: env.ACCESS_AUDIENCE, fetchJwks: (url, options) => fetch(url, options), maxSessionSeconds: 86400 });
  if (authOnly) return { identity, verifyAccess };
  const reuseRequestCampaign = launch && ['POST /wish-editor', 'POST /ops/wish-submit'].includes(routeKey);
  const core = new ChristmasRepository(db, cryptoService, { reuseRequestCampaign });
  const management = new ChristmasManagement(core);
  const experience = new CampaignExperience({ core, management });
  // This runtime is created for one HTTP request. Nested wish calls still check their own permissions.
  const reuseRequestContext = reuseRequestCampaign || launch && (
    ['POST /ops/proposal-review', 'GET /workspace/cases', 'POST /platform-audit/page'].includes(routeKey) ||
    (editorRoutes.has(routeKey) && routeKey !== 'POST /workspace/settings')
  );
  const ops = new UnitOperations({ core, management, experience, fulfillment: launch ? new FulfillmentRepository(core) : null, reuseRequestContext });
  ops.caseMode = true;
  ops.directMode = launch;
  ops.manualMode = launch;
  const rateLimit = createD1RateLimiter({ db, fingerprint: cryptoService.fingerprint, limit: 90 });
  return { core, ops, experience, campaign: env.CAMPAIGN_ID, identity, verifyAccess, rateLimit, flags: launchFlags(env) };
}

async function serveAsset(env, url, path) {
  const asset = await env.ASSETS.fetch(new Request(new URL(path, url.origin)));
  const headers = new Headers(asset.headers);
  for (const [name, value] of Object.entries(safeHeaders)) headers.set(name, value);
  return new Response(asset.body, { status: asset.status, headers });
}

function restoreDashboardAsset(response) {
  if (!response.ok) return response;
  return new HTMLRewriter()
    .on('title', { element: title => title.setInnerContent('NXSPACE 營運中心') })
    .on('head', { element: head => head.append('<link rel="stylesheet" href="/css/pages/dashboard.css">', { html: true }) })
    .on('body', { element: body => body.setAttribute('class', 'dashboard-body') })
    .on('[data-christmas-admin]', { element: source => {
      source.setAttribute('hidden', '');
      source.before('<main class="admin-auth-page" data-dashboard-loading><section class="admin-auth-card"><h1>NXSPACE 營運中心</h1><p role="status">正在載入工作台…</p><a class="btn btn-secondary" href="/admin/" hidden>重新載入</a></section></main>', { html: true });
    } })
    .on('[data-christmas-admin] h1', { element: heading => heading.setInnerContent('') })
    .on('[data-intake-status]', { element: status => status.setInnerContent('') })
    .transform(response);
}

async function requestBody(request, maxBytes) {
  const body = await readJson(request, maxBytes);
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ApiError('INVALID_FIELDS');
  return body;
}

async function wishList({ ops, core, campaign }, actor) {
  const rows = await ops.read(campaign, '/wishes', actor);
  const pending = new Set((await core.statement("SELECT wish_id FROM PublicWishProposals WHERE campaign_id=? AND status='pending'", campaign).all()).results.map(row => row.wish_id));
  return { rows: rows.map(({ id, public_code, public_nickname, gift_name, status, publication_status }) => ({
    id, public_code, public_nickname, gift_name, status, publication_status, pending_review: pending.has(id)
  })), nextCode: 'NX-'+String(1+rows.reduce((max,row)=>Math.max(max,/^NX-\d{3,12}$/.test(row.public_code)?Number(row.public_code.slice(3)):0),0)).padStart(3,'0') };
}

const routes = new Map([
  ['GET /context', async ({ core, campaign }, actor, principal) => {
    await recordPlatformEvent(core, campaign, principal, { action: 'auth.session_confirmed' });
    return { ...principal, permissions: principal.permissions.filter(permission => verifiedPermissions.has(permission)), collectionSites: [] };
  }],
  ['GET /workspace/cases', wishList],
  ['POST /session/logout', async ({ core, campaign }, actor, principal) => {
    await core.db.batch([
      core.statement(`INSERT INTO IntakeSessionRevocations(campaign_id,user_id,revoked_through) VALUES(?,?,max(unixepoch(),?))
        ON CONFLICT(campaign_id,user_id) DO UPDATE SET revoked_through=max(revoked_through,excluded.revoked_through)`, campaign, principal.id, actor.issuedAt),
      core.statement(`INSERT INTO PlatformAudit(id,campaign_id,actor_id,actor_name,unit_id,action,resource_id,result)
        VALUES(?,?,?,?,?,'auth.logout',?,'success')`, crypto.randomUUID(), campaign, principal.id, principal.displayName, principal.unit_id, principal.id)
    ]);
    return { revoked: true };
  }],
  ['POST /workspace/case', ({ ops, campaign }, actor, principal, body) => intakeCaseDetail(ops, campaign, body, principal)],
  ['POST /wish-editor', ({ ops, campaign }, actor, principal, body, key) => ops.saveWish(campaign, body, actor, key)],
  ['POST /ops/wish-submit', ({ ops, campaign }, actor, principal, body, key) => ops.submitWish(campaign, body, actor, key)],
  ['POST /ops/proposal-review', ({ ops, campaign }, actor, principal, body, key) => ops.reviewProposal(campaign, body, actor, key)],
  ['POST /ops/wish-unpublish', ({ ops, campaign }, actor, principal, body, key) => {
    if (principal.kind !== 'admin' || !principal.permissions.includes('staff.manage')) throw new ApiError('FORBIDDEN', 403);
    return bulkWishes(ops, campaign, {
      action: 'unpublish', items: [{ wishId: body.wishId, version: body.expectedVersion }], previewOnly: false
    }, actor, key);
  }],
  ['POST /ops/child', ({ ops, campaign }, actor, principal, { wishId }) => ops.child(campaign, { wishId }, actor)],
  ['POST /platform-audit/page', async ({ ops, campaign }, actor, principal, body) => {
    const page = await listPlatformAudit(ops, campaign, actor, body);
    return { ...page, rows: page.rows.map(({ actor_name, actor_role, unit_label, action, resource_label, result, occurred_at }) =>
      ({ actor_name, actor_role, unit_label, action, resource_label, result, occurred_at })) };
  }]
]);

const editorRoutes = new Map([
  ['GET /workspace/sites', collectionSites],
  ['POST /workspace/sites', collectionSites],
  ['GET /workspace/settings', campaignSettings],
  ['POST /workspace/settings', campaignSettings],
  ['GET /workspace/content', contentEditor],
  ['POST /workspace/content', contentEditor]
]);

export default {
  async fetch(request, env, context) {
    try {
      const url = new URL(request.url);
      if (env.PUBLIC_CHRISTMAS_REDIRECT_ORIGIN && url.origin === env.PUBLIC_CHRISTMAS_REDIRECT_ORIGIN) {
        const target = new URL(env.PUBLIC_CHRISTMAS_ORIGIN);
        url.protocol = target.protocol;
        url.host = target.host;
        return Response.redirect(url.href, 308);
      }
      const publicMount = url.origin === env.PUBLIC_CHRISTMAS_ORIGIN ||
        Boolean(env.PUBLIC_CHRISTMAS_ALIAS_ORIGIN && url.origin === env.PUBLIC_CHRISTMAS_ALIAS_ORIGIN);
      if (publicMount) {
        if (url.pathname === '/christmas') {
          url.pathname = '/christmas/';
          return Response.redirect(url.href, 308);
        }
        if (!url.pathname.startsWith('/christmas/')) return fetch(request);
        url.pathname = url.pathname.slice('/christmas'.length);
        const prefix = `${apiPrefix}/public/campaigns/${env.CAMPAIGN_ID}`;
        const path = url.pathname.slice(prefix.length);
        const campaignRoute = (url.pathname === prefix || url.pathname.startsWith(prefix + '/')) &&
          (publicRoute(request.method, path) || request.method === 'GET' && /^\/hero\/[0-9a-f]{32}\.(?:jpg|png|webp)$/.test(path));
        const pageOrAsset = request.method === 'GET' && (['/', '/privacy/', `${apiPrefix}/public/config`].includes(url.pathname) ||
          /^\/public-assets\/[a-z0-9/.-]+\.(?:css|js)$/.test(url.pathname));
        if (!campaignRoute && !pageOrAsset) {
          return json({ error: { code: 'NOT_FOUND' } }, 404);
        }
      }
      const apiPath = `${apiPrefix}/admin/campaigns/${env.CAMPAIGN_ID}/`;
      const method = request.method;
      const launch = env.DEPLOYMENT_MODE === 'production-launch';
      const localStaff = launch && env.STAFF_AUTH_MODE === 'supabase';
      const flags = launchFlags(env);
      const routeKey = url.pathname.startsWith(apiPath) ? `${method} /${url.pathname.slice(apiPath.length)}` : '';
      const retentionRoute = localStaff && env.CASE_RETENTION_ADMIN === 'true' &&
        /^POST \/ops\/retention\/(child|close-unclaimed|erase-unclaimed|pin|documents|test-preview|test-cleanup)$/.exec(routeKey)?.[1];
      const editorEnabled = localStaff && env.STAGING_CONTENT_EDITOR === 'true' && env.CAMPAIGN_ID === 'auth_staging_02b' &&
        !flags.browse && !flags.adopt && !flags.owner && !flags.fulfillment;
      const productionEditor = localStaff && env.V11_DASHBOARD === 'true' && env.DASHBOARD_CONTENT_EDITOR === 'true';
      const editorRoute = (editorEnabled || productionEditor) && editorRoutes.get(routeKey);
      const brandMediaRoute = productionEditor && /^GET \/workspace\/brand-media\/([0-9a-f]{32})$|^POST \/workspace\/brand-media$/.exec(routeKey);
      const apiRoute = (launch && flags.fulfillment && launchStaffRoutes.get(routeKey)) ||
        (launch || routeKey !== 'POST /ops/wish-unpublish' ? routes.get(routeKey) : null);
      const publicPath = `${apiPrefix}/public/campaigns/${env.CAMPAIGN_ID}`;
      const suffix = url.pathname.slice(publicPath.length);
      const publicApi = launch && (url.pathname === publicPath || url.pathname.startsWith(publicPath + '/')) && publicRoute(method, suffix);
      const publicConfig = launch && method === 'GET' && url.pathname === `${apiPrefix}/public/config`;
      const publicAsset = launch && method === 'GET' && (url.pathname === '/' || url.pathname === '/privacy/' || url.pathname === '/public-assets/privacy-v1.0.md' || /^\/public-assets\/[a-z0-9/.-]+\.(?:css|js)$/.test(url.pathname));
      const dashboardEnabled = localStaff && env.V11_DASHBOARD === 'true';
      const dashboardPage = method === 'GET' && dashboardEnabled && url.pathname === '/admin/';
      const dashboardAlias = method === 'GET' && dashboardEnabled && url.pathname === '/admin';
      const staticPath = method === 'GET' && (dashboardPage || dashboardAlias || url.pathname === '/staff/' || /^\/(?:css|js)\/[a-z0-9/.-]+\.(?:css|js)$/.test(url.pathname));
      const configPath = method === 'GET' && url.pathname === `${apiPrefix}/config`;
      const dashboardLogin = dashboardEnabled && url.pathname === '/admin/login/';
      const dashboardNavigation = dashboardAlias || dashboardPage || method === 'GET' && dashboardLogin;
      const loginAsset = localStaff && method === 'GET' && (dashboardLogin || ['/staff/login/', '/staff/login.js', '/js/staff-password.js'].includes(url.pathname));
      const authAction = localStaff && /^\/christmas-api\/staff-auth\/(login|logout|status|password|password-prepare|password-commit|step-up|export-step-up)$/.exec(url.pathname)?.[1];
      const authRoute = authAction && method === (authAction === 'status' ? 'GET' : 'POST');
      const accountAction = localStaff && /^(GET \/accounts\/(list)|POST \/accounts\/(create|reset|enable|disable|revoke|suspend-access|restore-access))$/.exec(routeKey);
      const profileRoute = localStaff && ['GET /account/profile', 'POST /account/profile'].includes(routeKey);
      if (!apiRoute && !retentionRoute && !editorRoute && !brandMediaRoute && !staticPath && !configPath && !publicApi && !publicConfig && !publicAsset && !loginAsset && !authRoute && !accountAction && !profileRoute) return json({ error: { code: 'NOT_FOUND' } }, 404);
      const publicCampaignTracking = publicMount && method === 'GET' && url.pathname === '/' &&
        [...url.searchParams.keys()].every(key => /^utm_[a-z0-9_]{1,48}$/i.test(key));
      if ((!publicMount && url.origin !== env.INTAKE_ORIGIN) || (url.search && !dashboardNavigation && !publicCampaignTracking) || request.headers.has('Authorization') ||
          request.headers.get('Sec-Fetch-Site') === 'cross-site' && !staticPath && !publicAsset && !loginAsset ||
          (request.headers.has('Origin') && request.headers.get('Origin') !== url.origin) ||
          (method === 'POST' && request.headers.get('Origin') !== url.origin)) throw new ApiError('ORIGIN_FORBIDDEN', 403);
      if (dashboardAlias || dashboardNavigation && url.search) return new Response(null, { status: 308, headers: { ...safeHeaders, Location: dashboardLogin ? '/admin/login/' : '/admin/' } });
      if (publicAsset) {
        const asset = await serveAsset(env, url, url.pathname === '/' ? '/public/index.html' : url.pathname === '/privacy/' ? '/public/privacy.html' : url.pathname);
        if (url.pathname === '/' && flags.browse && asset.ok && url.origin === env.PUBLIC_CHRISTMAS_ORIGIN) {
          asset.headers.delete('X-Robots-Tag');
        }
        if (url.pathname !== '/' || flags.browse || !asset.ok) return asset;
        const headers = new Headers(asset.headers);
        for (const name of ['Content-Length', 'ETag', 'Last-Modified']) headers.delete(name);
        return new HTMLRewriter().on('[data-public-campaign] > section', {
          element(section) {
            section.removeAttribute('data-christmas');
            section.setInnerContent('<h1>NXSPACE 聖誕心願公益計畫</h1><p>目前暫停公開心願瀏覽。</p>', { html: true });
          }
        }).transform(new Response(asset.body, { status: asset.status, headers }));
      }
      if (loginAsset) {
        if(dashboardEnabled&&url.pathname==='/staff/login/')return new Response(null,{status:303,headers:{...safeHeaders,Location:'/admin/login/'}});
        return serveAsset(env,url,dashboardLogin||url.pathname==='/staff/login/'?'/staff/login.html':url.pathname);
      }
      const runtime = await createRuntime(env, routeKey, authRoute);
      const { core, ops, experience, campaign, identity, rateLimit, verifyAccess } = runtime;
      if (authRoute) {
        if(authAction==='export-step-up'&&!flags.fulfillment)throw new ApiError('NOT_FOUND',404);
        const body = method === 'POST' ? await requestBody(request) : null;
        const result = authAction === 'login' ? await identity.login(request, body) :
          await identity.sessionAction(authAction, request, body, await verifyAccess(request));
        return json(result.data, 200, result.cookie);
      }
      if (publicConfig) {
        const privacy = await launchPrivacy(runtime, env);
        const direct = Boolean((await ops.rule(campaign)).direct_claims);
        return json({ enabled: true, baseUrl: publicMount ? '/christmas' + apiPrefix : apiPrefix, campaignId: campaign, caseMode: true, directMode: true,
          browse: flags.browse && Boolean(privacy), adoption: flags.browse && flags.adopt && direct && Boolean(privacy),
          owner: flags.owner && direct && Boolean(privacy), privacy: Boolean(privacy), launchMode: true });
      }
      if (publicApi) {
        if (suffix.startsWith('/brand-media/')) {
          if (!flags.browse || !env.BRAND_MEDIA) throw new ApiError('NOT_FOUND',404);
          if (env.BRAND_MEDIA_RATE) {
            const client=request.headers.get('CF-Connecting-IP')||'unknown';
            const {success}=await env.BRAND_MEDIA_RATE.limit({key:'brand-media:'+client});
            if(!success)throw new ApiError('RATE_LIMITED',429);
          }
          if(!await launchPrivacy(runtime,env))throw new ApiError('NOT_FOUND',404);
          const id=suffix.split('/').at(-1);
          const {content}=await ops.publicContent(campaign);
          if(!brandImageIds(content?.brand,{publicOnly:true}).includes(id))throw new ApiError('NOT_FOUND',404);
          const cache=context&&globalThis.caches?.default;
          const cacheKey=new Request(request.url);
          const cached=await cache?.match(cacheKey).catch(()=>undefined);
          if(cached)return cached;
          const image=await readBrandImage(core,campaign,env.BRAND_MEDIA,id,true);
          if(cache)context.waitUntil(cache.put(cacheKey,image.clone()).catch(()=>{}));
          return image;
        }
        const result = await runPublic(runtime, request, env, suffix, method === 'POST' ? await requestBody(request) : undefined);
        return json(result.data, 200, result.cookie);
      }
      let actor, principal;
      try {
        actor = await verifyAccess(request);
        if (identity && actor.must_change) throw new ApiError('PASSWORD_CHANGE_REQUIRED', 403);
        if (!staticPath && !await rateLimit({ scope: `intake:${actor.issuer}:${actor.subject}` })) throw new ApiError('RATE_LIMITED', 429);
        principal = await ops.context(campaign, actor, 'claim.read', { reviewSubmit: routeKey === 'POST /ops/wish-submit' });
        const isBookhouse = principal.kind === 'bookhouse' && principal.unit_id === principal.bookhouseId &&
          principal.organisations.some(organisation => organisation.id === principal.unit_id);
        const isCollection = launch && principal.kind === 'collection' &&
          principal.collectionSites.some(site => site.id === principal.unit_id) && principal.organisations.some(unit => unit.id === principal.unit_id);
        if (principal.kind !== 'admin' && !isBookhouse && !isCollection) throw new ApiError('UNIT_FORBIDDEN_OR_REVOKED', 403);
        if (!identity) {
          const cutoff = await core.statement('SELECT revoked_through FROM IntakeSessionRevocations WHERE campaign_id=? AND user_id=?', campaign, principal.id).first();
          if (cutoff && actor.issuedAt <= cutoff.revoked_through) throw new ApiError('SESSION_REVOKED', 401);
        }
      } catch (error) {
        if (identity && (dashboardPage || url.pathname === '/staff/') && error instanceof ApiError &&
            (error.status === 401 || error.code === 'PASSWORD_CHANGE_REQUIRED')) {
          const location = dashboardEnabled ? (dashboardPage ? '/admin/login/' : '/admin/login/#staff') : '/staff/login/';
          return new Response(null, { status: 303, headers: { ...safeHeaders, Location: location } });
        }
        if (identity && (dashboardPage || url.pathname === '/staff/') && error instanceof ApiError &&
            error.code === 'UNIT_FORBIDDEN_OR_REVOKED') {
          return new Response('<!doctype html><html lang="zh-Hant-TW"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>NXSPACE 營運中心</title><link rel="stylesheet" href="/public-assets/css/tokens.css"><link rel="stylesheet" href="/public-assets/css/pages/dashboard.css"><body class="dashboard-body"><main class="admin-auth-page"><section class="admin-auth-card"><h1>目前無法開啟工作台</h1><p>這個帳號目前沒有工作台存取權限，請聯絡 NXSPACE 核對單位與授權。</p></section></main></body></html>',
            { status: 403, headers: { ...safeHeaders, 'Content-Type': 'text/html; charset=utf-8' } });
        }
        if (error instanceof ApiError && [401, 403].includes(error.status) && !staticPath && await rateLimit({ scope: 'intake:denied-audit' })) {
          await recordPlatformEvent(core, campaign, { id: 'unverified', label: '未授權', unit_id: 'unassigned' }, { action: 'auth.denied', result: 'failure', details: { code: error.code } });
        }
        throw error;
      }
      if (identity && routeKey === 'POST /session/logout') {
        const result = await identity.sessionAction('logout', request, null, actor);
        return json(result.data, 200, result.cookie);
      }
      if (staticPath) {
        const asset = await serveAsset(env, url, dashboardPage || url.pathname === '/staff/' ? '/staff/index.html' : url.pathname);
        return dashboardPage ? restoreDashboardAsset(asset) : asset;
      }
      if (profileRoute) return json(await identity.profile(actor, method === 'POST' ? await requestBody(request) : null));
      if (accountAction) {
        if (principal.kind !== 'admin') throw new ApiError('FORBIDDEN', 403);
        return json(await identity.accounts(accountAction[2] || accountAction[3], method === 'POST' ? await requestBody(request) : null, actor, campaign));
      }
      if (identity && routeKey === 'POST /workspace/pin-reset') identity.requireElevation(actor);
      if (identity && routeKey === 'POST /workspace/export') await identity.requireExportAccess(actor);
      const intakeReady = async () => flags.intake && Boolean(await launchPrivacy(runtime, env));
      const superAdmin = Boolean(identity && actor.is_super && principal.kind === 'admin');
      if (brandMediaRoute) {
        if (!superAdmin || !principal.permissions.includes('staff.manage')) throw new ApiError('FORBIDDEN',403);
        if (method === 'GET') return await readBrandImage(core,campaign,env.BRAND_MEDIA,brandMediaRoute[1],false);
        if (request.headers.get('X-Requested-With')!=='XMLHttpRequest') throw new ApiError('ORIGIN_FORBIDDEN',403);
        return json(await uploadBrandImage(core,campaign,principal,env.BRAND_MEDIA,request,env.BRAND_MEDIA_CAPACITY_BYTES));
      }
      if (retentionRoute) {
        if (!superAdmin || !principal.permissions.includes('staff.manage')) throw new ApiError('FORBIDDEN', 403);
        identity.requireElevation(actor);
        const input = await requestBody(request);
        if (retentionRoute === 'child') {
          const { claimId, confirmClaimId } = input;
          if (!isId(claimId) || confirmClaimId !== claimId) throw new ApiError('CONFIRMATION_REQUIRED', 400);
          return json(await experience.eraseClosedCaseChildProfile(campaign, claimId, actor));
        }
        const { id, confirmId } = input;
        if (!isId(id) || confirmId !== id) throw new ApiError('CONFIRMATION_REQUIRED', 400);
        if (retentionRoute === 'test-preview') {
          if (id !== env.TEST_CLEANUP_PREVIEW_WISH_ID) throw new ApiError('NOT_FOUND',404);
          const preview=await testCaseCleanupPreview(core,campaign,id);
          return json({...preview,deletionSupported:env.TEST_CASE_CLEANUP_ENABLED==='true'&&preview.public_code==='NX-001'&&
            preview.status==='delivered'&&preview.publication_status==='draft'&&preview.claims===1&&
            ![preview.media,preview.sharedContacts,preview.sharedPortals,preview.sharedHandoffs,preview.sharedEvidence].some(Boolean)});
        }
        if (retentionRoute === 'test-cleanup') {
          if (env.TEST_CASE_CLEANUP_ENABLED!=='true'||id!==env.TEST_CLEANUP_PREVIEW_WISH_ID) throw new ApiError('NOT_FOUND',404);
          return json(await cleanSingleTestCase(core,campaign,id,principal.id,input));
        }
        if (retentionRoute === 'documents') return json(await experience.eraseRetainedDocuments(campaign,id,actor));
        if (retentionRoute === 'close-unclaimed') return json(await experience.closeUnclaimedWish(campaign,id,actor));
        if (retentionRoute === 'erase-unclaimed') return json(await experience.eraseUnclaimedChildProfile(campaign,id,actor));
        return json(await experience.eraseExpiredPortalPin(campaign,id,actor));
      }
      if (configPath) {
        const privacy = launch && (flags.intake || flags.browse || flags.fulfillment) ? await launchPrivacy(runtime, env) : null;
        const fulfillmentMode = launch && flags.fulfillment && Boolean(privacy);
        const publicWishBrowse = !launch || flags.browse && Boolean(privacy);
        const adoptionCampaign = launch && flags.adopt && publicWishBrowse && (await ops.rule(campaign)).direct_claims
          ? await core.campaign(campaign) : null;
        const now = Math.floor(Date.now() / 1000);
        const publicAdoption = Boolean(adoptionCampaign && adoptionCampaign.status === 'open' &&
          adoptionCampaign.opens_at <= now && adoptionCampaign.closes_at > now &&
          (adoptionCampaign.claim_deadline_at == null || adoptionCampaign.claim_deadline_at > now));
        const canEdit = superAdmin && principal.permissions.includes('staff.manage');
        let dashboardContext;
        if (dashboardEnabled && request.headers.get('X-NXSPACE-Dashboard') === 'bootstrap') {
          if (fulfillmentMode) {
            await recordPlatformEvent(core, campaign, principal, { action: 'auth.session_confirmed' });
            dashboardContext = principal;
          } else {
            dashboardContext = await routes.get('GET /context')(runtime, actor, principal);
          }
        }
        return json({ enabled: true, baseUrl: apiPrefix, campaignId: campaign, intakeMode: !fulfillmentMode, fulfillmentMode, directMode: launch, launchMode: launch, wishUnpublish: launch, intakeWrites: !launch || flags.intake && Boolean(privacy), publicWishBrowse, publicAdoption, staffPassword: Boolean(identity), superAdmin, testCleanupPreviewId: canEdit && env.CASE_RETENTION_ADMIN === 'true' && isId(env.TEST_CLEANUP_PREVIEW_WISH_ID) ? env.TEST_CLEANUP_PREVIEW_WISH_ID : null, contentEditorPreview: editorEnabled && superAdmin, contentEditor: productionEditor && canEdit, brandMedia: productionEditor && canEdit && Boolean(env.BRAND_MEDIA), websiteContentPublish: productionEditor && canEdit && env.DASHBOARD_WEBSITE_PUBLISH === 'true', dashboardContext, minimumPasswordLength: actor?.is_super ? 15 : standardPasswordMinimum(env) });
      }
      if (principal.kind === 'collection' && !flags.fulfillment && routeKey !== 'GET /context') {
        throw new ApiError('FULFILLMENT_NOT_OPEN', 403);
      }
      if (editorRoute) {
        if (!superAdmin || !principal.permissions.includes('staff.manage')) throw new ApiError('FORBIDDEN', 403);
        const settingsOptions = {
          preserveUnsetDeliveryDate: productionEditor,
          requireOperationalElevation: () => identity.requireElevation(actor)
        };
        if (editorRoute === collectionSites) {
          if (!productionEditor) throw new ApiError('FORBIDDEN', 403);
          const input = method === 'POST' ? await requestBody(request) : null;
          return json(await collectionSites(ops, campaign, actor, input, settingsOptions.requireOperationalElevation));
        }
        if (method === 'GET') {
          const result=await editorRoute(ops,campaign,null,actor,settingsOptions);
          if(editorRoute===contentEditor&&productionEditor&&env.BRAND_MEDIA){
            result.mediaUsage=await brandMediaUsage(core,env.BRAND_MEDIA_CAPACITY_BYTES);
          }
          return json(result);
        }
        const contentRoute = editorRoute === contentEditor;
        const input = await requestBody(request, contentRoute ? 131072 : undefined);
        if (contentRoute) {
          if (!productionEditor && (input.action !== 'save' || Object.hasOwn(input.content || {}, 'privacyStatement'))) throw new ApiError('FORBIDDEN', 403);
          if (productionEditor && input.action === 'publish' && env.DASHBOARD_WEBSITE_PUBLISH !== 'true') throw new ApiError('FORBIDDEN', 403);
          if (!productionEditor) identity.requireElevation(actor);
          return json(await contentEditor(ops, campaign, input, actor, { websiteOnly: productionEditor, brandMediaBucket:env.BRAND_MEDIA }));
        }
        return json(await editorRoute(ops, campaign, input, actor, settingsOptions));
      }
      if (launch && intakeWriteRoutes.has(routeKey) && !await intakeReady()) throw new ApiError('INTAKE_NOT_OPEN', 403);
      if (launch && launchStaffRoutes.has(routeKey) && flags.fulfillment && !await launchPrivacy(runtime, env)) throw new ApiError('FULFILLMENT_NOT_OPEN', 403);
      if (launch && flags.fulfillment && routeKey === 'GET /context') {
        await recordPlatformEvent(core, campaign, principal, { action: 'auth.session_confirmed' });
        return json(principal);
      }
      const body = method === 'POST' ? await requestBody(request) : undefined;
      if (launch && routeKey === 'POST /wish-editor') {
        if (body.disclosureConfirmed !== true) throw new ApiError('DISCLOSURE_ACK_REQUIRED', 400);
        delete body.disclosureConfirmed;
      }
      return json(await apiRoute(runtime, actor, principal, body, request.headers.get('Idempotency-Key')));
    } catch (error) {
      const safe = error instanceof ApiError ? error : new ApiError('INTAKE_UNAVAILABLE', 503);
      if (safe.status === 429 || safe.status >= 500) console.warn(securityEvent(safe.status === 429 ? 'RATE_LIMITED' : 'AUTH_UNAVAILABLE'));
      return json({ error: { code: safe.code } }, safe.status);
    }
  }
};
