import {normalizeContactPhone,validMailing} from './contact-rules.mjs';
export class ApiError extends Error {
  constructor(code, status=400) { super(code); this.code=code; this.status=status; }
}
function object(value, keys) {
  if (!value || Array.isArray(value) || typeof value!=='object' || Object.keys(value).some(k=>!keys.includes(k))) throw new ApiError('INVALID_FIELDS');
}
function text(value,min,max) { return typeof value==='string' && value.trim().length>=min && value.length<=max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value); }
export const isId = value => typeof value==='string' && /^[a-zA-Z0-9_-]{8,80}$/.test(value);
export const isWishCode=value=>isId(value)||(typeof value==='string'&&/^NX-(?!0+$)[0-9]{3,12}$/.test(value));
export const isRequestKey = value => typeof value==='string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
export function validateClaim(body,{operations=false,direct=false}={}) {
  object(body,['wishId','idempotencyKey','claimSecret','contact','consentVersion','verificationProof','challengeToken']);
  if (!isWishCode(body.wishId) || !isRequestKey(body.idempotencyKey) || !/^[A-Za-z0-9_-]{43}$/.test(body.claimSecret||'')) throw new ApiError('INVALID_CLAIM_CREDENTIAL');
  object(body.contact,['channel','address','displayName','phone','email','publicNickname','blessing','publicConsent','deliveryMethod','parties','documentPreferences',...(operations?['postalCode','postalAddress']:[]),...(direct?['postalCity','postalDistrict','postalStreet']:[])]);
  const contact=body.contact;
  if (!text(contact.displayName,1,80) || !['email','phone'].includes(contact.channel) || !text(contact.address,6,160)) throw new ApiError('INVALID_CONTACT');
  if (contact.channel==='email' ? !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.address) : !/^\+?[0-9]{8,15}$/.test(contact.address)) throw new ApiError('INVALID_CONTACT');
  if(direct ? !normalizeContactPhone(contact.phone) : contact.phone!==undefined&&!/^\+?[0-9]{8,15}$/.test(contact.phone))throw new ApiError('INVALID_PHONE');
  if(contact.phone!==undefined&&(!operations&&contact.channel!=='phone'||contact.channel==='phone'&&contact.phone!==contact.address))throw new ApiError('INVALID_PHONE');
  if(contact.email!==undefined&&contact.email!==''&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email))throw new ApiError('INVALID_EMAIL');
  for(const [key,max] of [['publicNickname',40],['blessing',500]])if(contact[key]!==undefined&&!text(contact[key],0,max))throw new ApiError('INVALID_CONTACT');
  if(contact.publicConsent!==undefined&&typeof contact.publicConsent!=='boolean')throw new ApiError('INVALID_CONSENT');
  if(contact.deliveryMethod!==undefined&&!['dropoff','shipping','to_be_confirmed'].includes(contact.deliveryMethod))throw new ApiError('INVALID_DELIVERY_METHOD');
  if(contact.postalCode!==undefined&&contact.postalCode!==''&&(typeof contact.postalCode!=='string'||!/^\d{3}(?:\d{2,3})?$/.test(contact.postalCode)))throw new ApiError('INVALID_POSTAL_CODE');if(contact.postalAddress!==undefined&&!text(contact.postalAddress,0,300))throw new ApiError('INVALID_ADDRESS');
  if((contact.postalAddress||contact.postalCode)&&!contact.documentPreferences?.paperThankYou&&!contact.documentPreferences?.materialProof)throw new ApiError('ADDRESS_NOT_NEEDED');
  if(contact.parties!==undefined){object(contact.parties,['donor','contact','recipient']);for(const value of Object.values(contact.parties))if(!text(value,0,80))throw new ApiError('INVALID_PARTY');}
  if(contact.documentPreferences!==undefined){object(contact.documentPreferences,['materialProof','paperThankYou','electronicThankYou','electronicProof']);if(Object.values(contact.documentPreferences).some(v=>typeof v!=='boolean'))throw new ApiError('INVALID_PREFERENCES');}
  if(direct){
    if(contact.channel!=='email'||contact.email&&contact.email!==contact.address)throw new ApiError('INVALID_CONTACT');
    const paper=contact.documentPreferences?.paperThankYou||contact.documentPreferences?.materialProof;
    if(contact.documentPreferences?.electronicThankYou||contact.documentPreferences?.electronicProof)throw new ApiError('PAPER_ONLY');
    if(paper&&!validMailing({...contact,recipientName:contact.parties?.recipient}))throw new ApiError('MAILING_DETAILS_REQUIRED');
    if(paper&&contact.postalAddress!==contact.postalCity+contact.postalDistrict+contact.postalStreet.trim())throw new ApiError('INVALID_ADDRESS');
    if(!paper&&[contact.postalCity,contact.postalDistrict,contact.postalStreet,contact.parties?.recipient].some(Boolean))throw new ApiError('ADDRESS_NOT_NEEDED');
  }
  if (!text(body.consentVersion,1,40) || !direct&&(!text(body.verificationProof,16,2048) || !text(body.challengeToken,16,2048))) throw new ApiError('VERIFICATION_REQUIRED');
  return body;
}
export function validateWish(body) {
  object(body,['publicCode','childAlias','ageBand','title','description','giftName','category','referenceAmount','specifications']);
  if (!isWishCode(body.publicCode) || !isId(body.childAlias) || !['0-5','6-9','10-12','13-15','16-18'].includes(body.ageBand)) throw new ApiError('INVALID_WISH');
  for (const key of ['title','giftName','category']) if (!text(body[key],1,100)) throw new ApiError('INVALID_WISH');
  if (!text(body.description,1,1000) || !text(body.specifications,0,1000) || !Number.isInteger(body.referenceAmount) || body.referenceAmount<0 || body.referenceAmount>100000) throw new ApiError('INVALID_WISH');
  return body;
}
export function validateBody(kind, body) {
  if (kind==='claim') return validateClaim(body);
  if (kind==='wish') return validateWish(body);
  if (kind==='import') {
    object(body,['wishes']);
    if (!Array.isArray(body.wishes) || !body.wishes.length || body.wishes.length>150) throw new ApiError('IMPORT_LIMIT');
    body.wishes.forEach(validateWish);
    if (new Set(body.wishes.map(w=>w.publicCode)).size!==body.wishes.length) throw new ApiError('DUPLICATE_CODE');
    return body;
  }
  if (kind==='lookup') {
    object(body,['idempotencyKey','claimId','claimSecret','secondFactor']);
    if ((!isRequestKey(body.idempotencyKey)&&!isId(body.claimId)) || (body.idempotencyKey!==undefined&&body.claimId!==undefined) || !/^[A-Za-z0-9_-]{43}$/.test(body.claimSecret||'')) throw new ApiError('INVALID_CLAIM_CREDENTIAL');
    return body;
  }
  object(body,['expectedVersion','reasonCode','evidenceId','locationCode','handoffId','deliveredAt']);
  if (!Number.isInteger(body.expectedVersion) || body.expectedVersion<0 || !/^[a-z][a-z0-9_]{0,79}$/.test(body.reasonCode||'')) throw new ApiError('VERSION_AND_REASON_REQUIRED');
  for (const key of ['evidenceId','locationCode','handoffId']) if (body[key]!==undefined && !isId(body[key])) throw new ApiError('INVALID_REFERENCE');
  if (body.deliveredAt!==undefined && !Number.isInteger(body.deliveredAt)) throw new ApiError('INVALID_TIME');
  if (kind==='receipt' && (!body.evidenceId || !body.locationCode)) throw new ApiError('RECEIPT_REQUIRED');
  if (kind==='handoff' && !body.handoffId) throw new ApiError('HANDOFF_REQUIRED');
  if (kind==='delivery' && (!body.evidenceId || !body.handoffId || !Number.isInteger(body.deliveredAt))) throw new ApiError('DELIVERY_REQUIRED');
  return body;
}
export async function readJson(request, maxBytes=16384) {
  if (!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')||'')) throw new ApiError('JSON_REQUIRED',415);
  if (!request.body) throw new ApiError('BODY_REQUIRED');
  const reader=request.body.getReader(); const chunks=[]; let bytes=0;
  try {
    while (true) { const {done,value}=await reader.read(); if(done) break; bytes+=value.byteLength; if(bytes>maxBytes){await reader.cancel();throw new ApiError('BODY_TOO_LARGE',413);} chunks.push(value); }
    const data=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length;}
    return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(data));
  } catch(error) { if(error instanceof ApiError)throw error;throw new ApiError('INVALID_JSON'); }
}
