import {ApiError} from './validation.mjs';

const maxBytes=2*1024*1024;
const maxDimension=2048;
export const brandMediaId=/^[0-9a-f]{32}$/;
export const brandImageFields=['hero','mobileHero','storyImage','treeImage','brandImage'];
export const organizationImageFields=['logo','image'];
const key=(campaign,id)=>'campaigns/'+campaign+'/'+id+'.webp';
const chunk=(bytes,offset)=>String.fromCharCode(...bytes.subarray(offset,offset+4));
const capacityLimit=value=>Number(value)||5_000_000_000;

export async function brandMediaUsage(core,capacity){
  const row=await core.statement('SELECT COALESCE(SUM(bytes),0) used,COALESCE(SUM(CASE WHEN ready=0 THEN bytes ELSE 0 END),0) pending FROM CampaignBrandMedia').first();
  return {...row,limit:capacityLimit(capacity)};
}

export function inspectBrandImage(bytes){
  if(bytes.length<26||chunk(bytes,0)!=='RIFF'||chunk(bytes,8)!=='WEBP')throw new ApiError('BRAND_IMAGE_FORMAT');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if(view.getUint32(4,true)!==bytes.length-8)throw new ApiError('BRAND_IMAGE_FORMAT');
  let dimensions=null,offset=12;
  while(offset+8<=bytes.length){
    const type=chunk(bytes,offset),size=view.getUint32(offset+4,true),start=offset+8;
    offset=start+size+(size%2);
    if(offset>bytes.length||!['VP8 ','VP8L','VP8X','ALPH','ICCP'].includes(type)||
      (type==='ICCP'&&size>16384)||(type==='VP8X'&&(size!==10||(bytes[start]&0x02))))throw new ApiError('BRAND_IMAGE_FORMAT');
    if(type==='VP8 '&&size>=10&&bytes[start+3]===0x9d&&bytes[start+4]===1&&bytes[start+5]===0x2a){
      if(dimensions)throw new ApiError('BRAND_IMAGE_FORMAT');
      dimensions=[view.getUint16(start+6,true)&0x3fff,view.getUint16(start+8,true)&0x3fff];
    }
    if(type==='VP8L'&&size>=5&&bytes[start]===0x2f){
      if(dimensions)throw new ApiError('BRAND_IMAGE_FORMAT');
      const sizeBits=view.getUint32(start+1,true);
      dimensions=[(sizeBits&0x3fff)+1,((sizeBits>>>14)&0x3fff)+1];
    }
  }
  if(offset!==bytes.length||!dimensions?.every(value=>value>0&&value<=maxDimension))throw new ApiError('BRAND_IMAGE_FORMAT');
  return dimensions;
}

function brandImages(brand,publicOnly){
  const all=brandImageFields.map(field=>brand?.[field]);
  for(const org of brand?.organizations||[]){
    if(!publicOnly||org.enabled)all.push(...organizationImageFields.map(field=>org[field]));
  }
  return all.filter(Boolean);
}

export function brandImageIds(brand,{publicOnly=false}={}){
  return [...new Set(brandImages(brand,publicOnly).map(image=>image.id))];
}

export async function verifyBrandImageReferences(core,campaign,brand,bucket){
  const ids=brandImageIds(brand);
  if(!ids.length)return;
  if(!bucket)throw new ApiError('BRAND_MEDIA_UNAVAILABLE',503);
  const {results}=await core.statement(`SELECT id,width,height FROM CampaignBrandMedia WHERE campaign_id=? AND ready=1 AND id IN (${ids.map(()=>'?').join(',')})`,campaign,...ids).all();
  const records=new Map(results.map(image=>[image.id,image]));
  if(brandImages(brand,false).some(image=>records.get(image.id)?.width!==image.width||records.get(image.id)?.height!==image.height)){
    throw new ApiError('BRAND_IMAGE_NOT_FOUND',404);
  }
}

export async function uploadBrandImage(core,campaign,principal,bucket,request,capacity){
  if(!bucket)throw new ApiError('BRAND_MEDIA_UNAVAILABLE',503);
  if(request.headers.get('Content-Type')!=='image/webp')throw new ApiError('BRAND_IMAGE_FORMAT');
  if(Number(request.headers.get('Content-Length'))>maxBytes)throw new ApiError('BRAND_IMAGE_TOO_LARGE',413);
  const reader=request.body?.getReader();
  if(!reader)throw new ApiError('BRAND_IMAGE_FORMAT');
  const parts=[];
  let size=0;
  for(;;){
    const {done,value}=await reader.read();
    if(done)break;
    size+=value.length;
    if(size>maxBytes){await reader.cancel();throw new ApiError('BRAND_IMAGE_TOO_LARGE',413);}
    parts.push(value);
  }
  const bytes=new Uint8Array(size);
  let offset=0;
  for(const part of parts){bytes.set(part,offset);offset+=part.length;}
  const [width,height]=inspectBrandImage(bytes);
  const id=crypto.randomUUID().replaceAll('-','');
  const ceiling=capacityLimit(capacity);
  const reserve=await core.statement(`INSERT INTO CampaignBrandMedia(id,campaign_id,actor_id,bytes,width,height)
    SELECT ?,?,?,?,?,? WHERE (SELECT COALESCE(SUM(bytes),0) FROM CampaignBrandMedia)+?<=?
    AND (SELECT COUNT(*) FROM CampaignBrandMedia WHERE actor_id=? AND created_at>unixepoch()-3600)<30`,
    id,campaign,principal.id,size,width,height,size,ceiling,principal.id).run();
  if(!reserve.meta.changes)throw new ApiError('BRAND_MEDIA_LIMIT',429);
  try{
    await bucket.put(key(campaign,id),bytes,{httpMetadata:{contentType:'image/webp'}});
    await core.db.batch([
      core.statement('UPDATE CampaignBrandMedia SET ready=1 WHERE id=? AND campaign_id=? AND ready=0',id,campaign),
      opsUploadAudit(core,campaign,principal,id)
    ]);
  }catch{
    // An interrupted upload is hidden from both and still counts towards the quota until reconciled.
    throw new ApiError('BRAND_MEDIA_UPLOAD_UNCONFIRMED',503);
  }
  return {id,width,height};
}

function opsUploadAudit(core,campaign,principal,id){
  return core.statement(`INSERT INTO UnitActions(id,campaign_id,unit_id,actor_id,handler,action,resource_id)
    SELECT ?,?,?,?,?, 'brand.media_uploaded',? WHERE changes()=1`,crypto.randomUUID(),campaign,principal.unit_id,principal.id,principal.displayName||principal.label,id);
}

export async function readBrandImage(core,campaign,bucket,id,publicAccess){
  if(!bucket||!brandMediaId.test(id)||!await core.statement('SELECT id FROM CampaignBrandMedia WHERE id=? AND campaign_id=? AND ready=1',id,campaign).first()){
    throw new ApiError('NOT_FOUND',404);
  }
  const object=await bucket.get(key(campaign,id));
  if(!object)throw new ApiError('NOT_FOUND',404);
  return new Response(object.body,{headers:{
    'Content-Type':'image/webp',
    'Cache-Control':publicAccess?'public, max-age=300':'private, no-store',
    'X-Content-Type-Options':'nosniff',
    'Cross-Origin-Resource-Policy':'same-origin'
  }});
}
