export const WISH_STATES = Object.freeze(['available','claimed','gift_received','handed_over','delivered','cancelled','expired','exception']);
export const ROLE_PERMISSIONS = Object.freeze({
  nx_admin: Object.freeze(['wish.write','wish.reopen','claim.read','claim.cancel','claim.assist','gift.receive','gift.handoff','gift.exception','audit.read','contact.read','contact.rotate','contact.erase','claim.revoke','staff.manage']),
  nx_staff: Object.freeze(['wish.write','wish.reopen','claim.read','claim.cancel','claim.assist','gift.receive','gift.handoff','gift.exception','audit.read','contact.read']),
  partner_staff: Object.freeze(['claim.read','gift.accept','gift.deliver','gift.exception','audit.read']),
  system: Object.freeze(['claim.expire'])
});
const transitions = Object.freeze({
  claimed: { gift_received:'gift.receive', cancelled:'claim.cancel', expired:'claim.expire', exception:'gift.exception' },
  gift_received: { handed_over:'gift.handoff', exception:'gift.exception' },
  handed_over: { delivered:'gift.deliver', exception:'gift.exception' },
  delivered: { exception:'gift.exception' }
});
export function hasPermission(principal, permission, campaignId) {
  return Boolean(principal?.verified && principal.campaignIds?.includes(campaignId) &&
    principal.roles?.some(role => ROLE_PERMISSIONS[role]?.includes(permission)));
}
export function authorizeTransition({ from, to, principal, campaignId, reason, now, expiresAt, exceptionFrom, receiptId, handoffId, deliveryId }) {
  const permission = from==='exception' && to===exceptionFrom ? 'gift.exception' : transitions[from]?.[to];
  if (!permission || !hasPermission(principal,permission,campaignId)) throw new Error('TRANSITION_FORBIDDEN');
  const stage=from==='exception'?exceptionFrom:from;
  if (principal.roles.every(role=>role==='partner_staff') && !['handed_over','delivered'].includes(stage)) throw new Error('TRANSITION_FORBIDDEN');
  if (to==='delivered' && !hasPermission(principal,'gift.deliver',campaignId)) throw new Error('TRANSITION_FORBIDDEN');
  if (!reason?.trim() || reason.length>80) throw new Error('REASON_REQUIRED');
  if (to==='expired' && (!Number.isInteger(now) || !Number.isInteger(expiresAt) || now<expiresAt)) throw new Error('NOT_EXPIRED');
  if (to==='gift_received' && !receiptId) throw new Error('RECEIPT_REQUIRED');
  if (to==='handed_over' && !handoffId) throw new Error('HANDOFF_REQUIRED');
  if (to==='delivered' && !deliveryId) throw new Error('DELIVERY_REQUIRED');
  return { from, to, reason, permission };
}
// Explicit allow-list: never serialize DB rows directly to public responses.
export function publicWish(row = {}) {
  return Object.fromEntries(['public_code','age_band','title','description','gift_name','category','reference_amount','specifications','status']
    .filter(key=>row[key]!==undefined).map(key=>[key,row[key]]));
}
