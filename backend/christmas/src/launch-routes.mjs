import { campaignProgress, paperDocuments, workspaceCases, caseDetail, supportEvent, exportMailingList, phoneSearch } from './case-workspace.mjs';
import { directPostalData, directRoute, getPrivacy, mailingCorrection, ownerCookie, resetPin } from './direct-claims.mjs';
import { collectionSites } from './operational-policy.mjs';
import { publicCampaignBrand } from './campaign-brand.mjs';
import { ApiError } from './validation.mjs';

export function launchFlags(env) {
  return {
    intake: env.FEATURE_INTAKE === 'true', browse: env.FEATURE_BROWSE === 'true',
    adopt: env.FEATURE_ADOPT === 'true', fulfillment: env.FEATURE_FULFILLMENT === 'true',
    owner: env.FEATURE_OWNER === 'true'
  };
}

export async function launchPrivacy({ ops, campaign }, env) {
  const effectiveAt = Number(env.PRIVACY_EFFECTIVE_AT);
  if (![env.PRIVACY_APPROVED_VERSION, env.PRIVACY_CONTROLLER, env.PRIVACY_CONTACT, env.PRIVACY_APPROVAL_REF]
      .every(value => typeof value === 'string' && value.trim()) ||
      !Number.isSafeInteger(effectiveAt) || effectiveAt <= 0 || effectiveAt > Math.floor(Date.now()/1000)) return null;
  try {
    const policy = await getPrivacy(ops, campaign);
    if (policy.version !== env.PRIVACY_APPROVED_VERSION || !policy.title?.trim() || !policy.body?.trim()) return null;
    return { ...policy, effectiveAt, controller: env.PRIVACY_CONTROLLER, contact: env.PRIVACY_CONTACT };
  } catch (error) {
    if (error instanceof ApiError && error.code === 'PRIVACY_NOT_PUBLISHED') return null;
    throw error;
  }
}

const ownerPaths = new Set(['/direct/login', '/direct/claims', '/direct/logout', '/direct/cancel']);
const publicReads = new Set(['', '/content', '/progress', '/privacy', '/postal-areas']);

export function publicRoute(method, path) {
  if (method === 'GET') return publicReads.has(path) || /^\/wishes(?:\/NX-[0-9]{3,12})?$/.test(path) || /^\/brand-media\/[0-9a-f]{32}$/.test(path);
  return method === 'POST' && (path === '/direct/adopt' || ownerPaths.has(path));
}

export async function runPublic(runtime, request, env, path, body) {
  const { core, ops, campaign, experience, flags } = runtime;
  const privacy = await launchPrivacy(runtime, env);
  const direct = Boolean((await ops.rule(campaign)).direct_claims);
  const canAdopt = flags.adopt && flags.browse && direct && Boolean(privacy);
  if (ownerPaths.has(path) || path === '/direct/adopt') {
    if (path === '/direct/adopt' ? !canAdopt : !flags.owner || !direct || !privacy) throw new ApiError('NOT_FOUND', 404);
    if (path === '/direct/adopt' && ((await core.campaign(campaign)).status !== 'open')) throw new ApiError('CLAIMS_CLOSED', 409);
    if (path === '/direct/adopt') {
      if (body.privacyConfirmed !== true) throw new ApiError('PRIVACY_ACK_REQUIRED', 400);
      delete body.privacyConfirmed;
    }
    const result = await directRoute(ops, campaign, path, body, request);
    return { data: result.data, cookie: Object.hasOwn(result, 'session') ? ownerCookie(request, result.session) : null };
  }
  if (path === '/privacy' && privacy) return { data: privacy };
  if (path === '/postal-areas' && (canAdopt || flags.fulfillment && privacy)) return { data: directPostalData() };
  // Existing donors can still read their progress if public browsing is paused.
  if (path === '/content' && !flags.browse && flags.owner && direct && privacy) return { data: { content: { collectionSites: await collectionSites(ops,campaign) } } };
  if (!flags.browse || !privacy) throw new ApiError('NOT_FOUND', 404);
  if (path === '') return { data: await core.campaign(campaign) };
  if (path === '/content') {
    const published = await ops.publicContent(campaign);
    const sites = await collectionSites(ops,campaign);
    const brand=publicCampaignBrand(published.content?.brand);
    return { data: { ...published, brand, ...(published.content ? { content: { ...published.content, brand, collectionSites: sites } } : { collectionSites: sites }) } };
  }
  if (path === '/progress') {
    const { total, claimed, remaining, percentage } = await campaignProgress(ops, campaign);
    return { data: { total, claimed, remaining, percentage } };
  }
  if (path === '/wishes' || path.startsWith('/wishes/')) {
    const rows = await experience.wishes(campaign, path.split('/')[2] || null);
    return { data: rows.map(({ public_code, public_nickname, title, description, gift_name, specifications, status, claim_due_at, gift_due_at, canAdopt: available }) => ({
      public_code, public_nickname, title, description, gift_name, specifications, status, claim_due_at, gift_due_at, canAdopt: canAdopt && available
    })) };
  }
  throw new ApiError('NOT_FOUND', 404);
}

export const launchStaffRoutes = new Map([
  ['GET /workspace/cases', ({ ops, campaign }, actor) => workspaceCases(ops, campaign, actor)],
  ['POST /workspace/case', ({ ops, campaign }, actor, principal, body) => caseDetail(ops, campaign, body, actor)],
  ['POST /ops/search', ({ ops, campaign }, actor, principal, { code }) => ops.search(campaign, { code, normalizeCode: true }, actor)],
  ['POST /workspace/phone', ({ ops, campaign }, actor, principal, body) => phoneSearch(ops, campaign, body, actor)],
  ['POST /ops/fulfillment', ({ ops, campaign }, actor, principal, body, key) => ops.fulfill(campaign, body, actor, key)],
  ['POST /ops/case', ({ ops, campaign }, actor, principal, body, key) => ops.caseOperation(campaign, body, actor, key)],
  ['POST /ops/profile', ({ ops, campaign }, actor, principal, body) => ops.contactProfile(campaign, body, actor)],
  ['POST /workspace/documents', ({ ops, campaign }, actor, principal, body, key) => paperDocuments(ops, campaign, body, actor, key)],
  ['POST /workspace/support', ({ ops, campaign }, actor, principal, body, key) => supportEvent(ops, campaign, body, actor, key)],
  ['POST /workspace/export', ({ ops, campaign }, actor, principal, body) => exportMailingList(ops, campaign, body, actor)],
  ['POST /workspace/pin-reset', ({ ops, campaign }, actor, principal, body, key) => resetPin(ops, campaign, body, actor, key)],
  ['POST /workspace/mailing', ({ ops, campaign }, actor, principal, body, key) => mailingCorrection(ops, campaign, body, actor, key)]
]);

export const intakeWriteRoutes = new Set(['POST /wish-editor','POST /ops/wish-submit','POST /ops/proposal-review']);
