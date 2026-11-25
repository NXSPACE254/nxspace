import {postalAreas} from './postal-areas.mjs';
// Keep the supplied representation encrypted; use a normalized base for restricted lookup.
export function normalizeContactPhone(value){
 if(typeof value!=='string'||value.length>60||/[\u0000-\u001f]/.test(value))return null;
 const text=value.trim(),match=text.match(/^(\+?[\d\s().-]+?)(?:\s*(?:分機|ext\.?|x|#)\s*(\d{1,6}))?$/i);
 if(!match)return null;const base=match[1].replace(/[^\d+]/g,'');
 if(!/^\+?\d{7,15}$/.test(base)||/^\+?(\d)\1+$/.test(base))return null;
 return {display:text,base,extension:match[2]||''};
}
export function validMailing(value){
 return Boolean(value&&typeof value.recipientName==='string'&&value.recipientName.trim().length>0&&value.recipientName.length<=80&&postalAreas.some(a=>a.city===value.postalCity&&a.district===value.postalDistrict&&a.zip===value.postalCode)&&typeof value.postalStreet==='string'&&value.postalStreet.trim().length>=3&&value.postalStreet.length<=240&&!/[\u0000-\u001f<>]/.test(value.postalStreet));
}
export function mailingFromContact(contact){return {recipientName:contact.parties?.recipient||'',postalCity:contact.postalCity||'',postalDistrict:contact.postalDistrict||'',postalCode:contact.postalCode||'',postalStreet:contact.postalStreet||'',postalAddress:contact.postalAddress||''};}
