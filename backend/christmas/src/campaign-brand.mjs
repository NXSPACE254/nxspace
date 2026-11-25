import {ApiError} from './validation.mjs';
import {brandImageFields,brandMediaId,organizationImageFields} from './campaign-brand-media.mjs';

export const initialBrand = {
  title:'台東的聖誕願望樹',
  subtitle:'親手準備一份禮物，陪孩子迎接溫暖的節日。',
  tagline:'讓美好，在台東發生。',
  slogan:'在台東，開啟品牌的無限可能。',
  storyTitle:'在台東，把心意送到孩子手中',
  story:'馜享 NX SPACE 與孩子的書屋共同主辦。孩子許下心願，在地據點協助收件，再由書屋將禮物送到孩子手中。',
  organizations:[
    {name:'馜享 NX SPACE',category:'organizer',website:'https://nxspace.tw/',description:'從台東出發，透過空間經營、品牌合作與生活提案，創造人與人之間更多美好的連結。',role:'活動企劃、公益平台建置及合作據點協調。'},
    {name:'孩子的書屋',category:'organizer',description:'深耕台東，透過教育、生活陪伴及支持，陪伴孩子成長，為孩子創造更多未來的可能。',role:'心願募集、禮物轉交及捐贈文件相關作業。'},
    {name:'CAMA CAFE 台東鐵花村店',category:'co-organizer',description:'以咖啡串聯日常生活，讓美好的相遇從一杯咖啡開始。',role:'公益禮物收件。'},
    {name:'大樹 AVEDA Salon',category:'co-organizer',description:'以美髮專業與生活關懷為出發點，共同參與在地公益活動。',role:'公益禮物收件。'},
    {name:'米勒 AVEDA Salon SPA',category:'co-organizer',description:'將美好生活與在地關懷結合，共同參與本次聖誕公益活動。',role:'公益禮物收件。'},
    {name:'鼎邑空間規劃企業社',category:'partner',description:'透過空間規劃與設計專業，為生活場景創造更多美好的可能。'},
    {name:'黑孩子黑咖啡',category:'partner',description:'從台東出發，以咖啡與在地生活建立連結。'}
  ].map(organization=>({...organization,enabled:true}))
};

const categories = ['organizer','co-organizer','partner'];
const copyFields = ['title','subtitle','tagline','slogan','storyTitle','story'];
const organizationFields = ['name','category','enabled','description','role','website','social','phone','email','contact',...organizationImageFields];
const text = (value, length) => typeof value === 'string' && value.length <= length;
const object = (value, fields) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).every(key=>fields.includes(key));
const validImage = image => image===undefined||image===null||(
  object(image,['id','width','height','alt']) && typeof image.id==='string' && brandMediaId.test(image.id) &&
  [image.width,image.height].every(n=>Number.isSafeInteger(n)&&n>=1&&n<=2048) && text(image.alt,240)
);

function secureLink(value) {
  if (!text(value, 500)) return false;
  if (!value) return true;
  try {
    const url = new URL(value);
    return /^https?:\/\//i.test(value) && !!url.hostname && !url.username && !url.password &&
      !/[\s\\]/.test(value);
  } catch {
    return false;
  }
}

export function validateCampaignBrand(brand) {
  const valid = object(brand, [...copyFields,...brandImageFields,'organizations']) &&
    copyFields.every(key=>text(brand[key],key==='story'?4000:240)) && !!brand.title.trim() &&
    brandImageFields.every(key=>validImage(brand[key])) &&
    Array.isArray(brand.organizations) && brand.organizations.length <= 24 &&
    brand.organizations.every(org=>object(org,organizationFields) &&
      text(org.name,120) && !!org.name.trim() && categories.includes(org.category) &&
      typeof org.enabled === 'boolean' &&
      organizationImageFields.every(key=>validImage(org[key])) &&
      ['description','role','contact'].every(key=>text(org[key]??'',1200)) &&
      ['website','social'].every(key=>secureLink(org[key]??'')) &&
      text(org.phone??'',60) && text(org.email??'',160) &&
      (!org.email || /^[^\s@:?&#]+@[^\s@:?&#]+\.[^\s@:?&#]+$/.test(org.email)));
  if(!valid) throw new ApiError('INVALID_CAMPAIGN_BRAND');
}

export function publicCampaignBrand(brand = initialBrand) {
  return {...brand,organizations:brand.organizations.filter(organization=>organization.enabled)};
}
