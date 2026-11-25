import { hasPermission } from './domain.mjs';
import { ApiError, isId, readJson, validateBody } from './validation.mjs';

// Contract registry only. No D1/R2 operation, notification or successful claim.
export const ROUTES = Object.freeze([
  ['GET','/public/campaigns/:campaignId','public'],
  ['GET','/public/campaigns/:campaignId/wishes','public'],
  ['GET','/public/campaigns/:campaignId/wishes/:wishId','public'],
  ['POST','/public/campaigns/:campaignId/claims','verified_donor','claim'],
  ['POST','/public/campaigns/:campaignId/claim-results','capability','lookup'],
  ['POST','/public/campaigns/:campaignId/claims/:claimId/cancellation-requests','capability','action'],
  ['POST','/admin/campaigns/:campaignId/wishes/import','wish.write','import'],
  ['POST','/admin/campaigns/:campaignId/wishes','wish.write','wish'],
  ['PUT','/admin/campaigns/:campaignId/wishes/:wishId','wish.write','wish'],
  ['POST','/admin/campaigns/:campaignId/wishes/:wishId/reopen','wish.reopen','action'],
  ['GET','/admin/campaigns/:campaignId/claims','claim.read'],
  ['POST','/admin/campaigns/:campaignId/claims/assisted','claim.assist','claim'],
  ['POST','/admin/campaigns/:campaignId/claims/:claimId/cancel','claim.cancel','action'],
  ['POST','/admin/campaigns/:campaignId/claims/:claimId/receipt','gift.receive','receipt'],
  ['POST','/admin/campaigns/:campaignId/claims/:claimId/handoff','gift.handoff','handoff'],
  ['POST','/admin/campaigns/:campaignId/claims/:claimId/handoff-acceptance','gift.accept','handoff'],
  ['POST','/admin/campaigns/:campaignId/claims/:claimId/delivery','gift.deliver','delivery'],
  ['POST','/admin/campaigns/:campaignId/claims/:claimId/exception','gift.exception','action'],
  ['POST','/admin/campaigns/:campaignId/claims/:claimId/resolve','gift.exception','action'],
  ['GET','/admin/campaigns/:campaignId/audit','audit.read']
].map(([method,path,permission,body])=>Object.freeze({method,path,permission,body})));

function match(method,path) {
  for (const route of ROUTES) {
    if (route.method!==method) continue;
    const keys=[];
    const pattern=route.path.replace(/:([A-Za-z]+)/g,(_,key)=>{keys.push(key);return '([^/]+)';});
    const values=path.match(new RegExp(`^${pattern}$`));
    if (!values) continue;
    const params=Object.fromEntries(keys.map((key,i)=>[key,values[i+1]]));
    if (Object.values(params).some(value=>!isId(value))) throw new ApiError('INVALID_ID');
    return {route,params};
  }
  throw new ApiError('NOT_FOUND',404);
}
function json(data,status=200,origin='') {
  const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Vary':'Origin'};
  if(origin) headers['Access-Control-Allow-Origin']=origin;
  return new Response(JSON.stringify(data),{status,headers});
}
export function createWorker({ authenticate=null, rateLimit=null }={}) {
  return {
    async fetch(request,env={}) {
      let allowedOrigin='';
      try {
        const url=new URL(request.url);
        const origin=request.headers.get('Origin');
        if (origin) {
          if (!env.ALLOWED_ORIGIN || origin!==env.ALLOWED_ORIGIN) throw new ApiError('ORIGIN_FORBIDDEN',403);
          allowedOrigin=origin;
        }
        if(url.pathname==='/health' && request.method==='GET') return json({phase:'21A',writesEnabled:false},200,allowedOrigin);
        if(request.method==='OPTIONS') {
          if(!allowedOrigin)throw new ApiError('ORIGIN_FORBIDDEN',403);
          const response=json({},200,allowedOrigin);
          // 204 must have no body.
          return new Response(null,{status:204,headers:{...Object.fromEntries(response.headers),'Access-Control-Allow-Methods':'GET,POST,PUT,OPTIONS','Access-Control-Allow-Headers':'Authorization,Content-Type,If-Match'}});
        }
        const {route,params}=match(request.method,url.pathname);
        if (request.method!=='GET' && !allowedOrigin) throw new ApiError('ORIGIN_REQUIRED',403);
        if (!rateLimit) throw new ApiError('RATE_LIMIT_NOT_CONFIGURED',503);
        if (!await rateLimit({request,route,params,phase:'edge'})) throw new ApiError('RATE_LIMITED',429);
        if (request.method==='PUT' && !/^"[0-9]+"$/.test(request.headers.get('If-Match')||'')) throw new ApiError('VERSION_REQUIRED',428);
        const body=route.body ? validateBody(route.body,await readJson(request,route.body==='import'?262144:16384)) : null;
        if (route.permission!=='public') {
          if(!authenticate)throw new ApiError('AUTH_NOT_CONFIGURED',503);
          // Only a trusted server adapter may construct this principal.
          // Never derive roles from client headers or Demo browser storage.
          const principal=await authenticate({request,route,params,body});
          if (!principal?.verified) throw new ApiError('UNAUTHORIZED',401);
          if (!await rateLimit({request,route,params,principal,phase:'principal'})) throw new ApiError('RATE_LIMITED',429);
          if (route.permission==='capability') {
            if(principal.kind!=='donor' || principal.campaignId!==params.campaignId || (params.claimId && principal.claimId!==params.claimId)) throw new ApiError('FORBIDDEN',403);
          } else if(route.permission==='verified_donor') {
            if(principal.kind!=='donor' || principal.campaignId!==params.campaignId || !principal.contactVerified) throw new ApiError('FORBIDDEN',403);
          } else if(!hasPermission(principal,route.permission,params.campaignId)) throw new ApiError('FORBIDDEN',403);
        }
        // Intentionally unconditional: no flag or binding enables 21A writes.
        return json({error:{code:'SKELETON_ONLY',retryable:false}},501,allowedOrigin);
      } catch(error) {
        const safe=error instanceof ApiError ? error : new ApiError('INTERNAL_ERROR',500);
        return json({error:{code:safe.code,retryable:safe.status===429||safe.status===503}},safe.status,allowedOrigin);
      }
    }
  };
}
export default createWorker();
