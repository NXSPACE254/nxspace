import {collectionSites,bulkWishes} from './operational-policy.mjs';
import {directRoute,ownerCookie,directPostalData,getPrivacy,mailingCorrection,resetPin} from './direct-claims.mjs';
import {recordRequest,listPlatformAudit,purgeExpiredAudit,recordPlatformEvent} from './platform-audit.mjs';
import {workspaceCases,caseDetail,supportEvent,phoneSearch,adminReset,contentEditor,campaignSettings,paperDocuments,campaignProgress,exportMailingList,setExportAccess} from './case-workspace.mjs';
import {setDonorPassword,loginDonorPassword} from './donor-password.mjs';
import { ApiError, readJson, validateBody } from './validation.mjs';

// Separate entry point, NEVER imported by worker.mjs or deployment configuration.
// Auth/abuse adapters are mandatory; no test password or header-role fallback.
export function createLocalApi({ repository, fulfillment = null, management = null, experience = null, authenticate, verifyIntent, rateLimit, origin = 'http://127.0.0.1:8787' }) {
  return { async fetch(request) {
    let auditContext=null,setCookie=null;
    const response = async (data, status = 200) => {
      if(auditContext){try{const {ops,campaign,actor,path,method,body}=auditContext;
       if(method==='POST'&&actor)await recordRequest(ops,campaign,actor,path,status<400?'success':'failure',data?.error?.code||'');
       if(method==='POST'&&['/owner/password/login','/owner/logout'].includes(path)){
        const access=data?.accessId||body?.credentials?.accessId,owner=access?await ops.core.statement('SELECT portal_id FROM OwnerAccess WHERE id=?',access).first():null;
        const id=owner?.portal_id||(body?.email?'unverified_'+await ops.core.crypto.fingerprint({email:String(body.email).trim().toLowerCase()}):'unidentified');
        await recordPlatformEvent(ops.core,campaign,{id,label:owner?'認領者':'未登入帳號',unit_id:'public'},{action:path.includes('logout')?'auth.logout':'auth.login',result:status<400?'success':'failure',details:{code:data?.error?.code||''}});
       }
      }catch{return new Response(JSON.stringify({error:{code:'AUDIT_UNAVAILABLE',retryable:true}}),{status:503,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}}
      return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',...(setCookie?{'Set-Cookie':setCookie}:{}) } });
    };
    try {
      const url = new URL(request.url);
      if (url.hostname !== '127.0.0.1' || url.origin !== origin || request.headers.get('Origin') !== origin) throw new ApiError('LOCAL_ONLY', 403);
      if (!rateLimit || !await rateLimit(request)) throw new ApiError('RATE_LIMITED_OR_UNCONFIGURED', 503);
      const parts = url.pathname.match(/^\/(public|admin)\/campaigns\/([a-zA-Z0-9_-]{8,80})(.*)$/);
      if (!parts) throw new ApiError('NOT_FOUND', 404);
      const [, area, campaign, path] = parts;
      const method = request.method;
      const body = method === 'POST' ? await readJson(request, ['/wishes/import','/handoff-batches','/media'].includes(path) ? 262144 : ['/ops/content','/workspace/content'].includes(path)?131072:16384) : null;
      const actor = area === 'admin' ? await authenticate?.(request) : null;
      if (area === 'admin' && !actor?.verified){
        if(repository.operating?.caseMode&&await repository.statement('SELECT id FROM Campaigns WHERE id=?',campaign).first())await recordPlatformEvent(repository,campaign,{id:'unverified',label:'未通過驗證',unit_id:'unassigned'},{action:'auth.denied',result:'failure',details:{code:'UNAUTHORIZED'}});
        throw new ApiError('UNAUTHORIZED', 401);
      }
      const ops=repository.operationsEnabled?repository.operating:null;
      if(ops){
        if(ops.caseMode)auditContext={ops,campaign,actor,path,method,body};
        if(ops.acceptanceMode&&area==='admin'&&(path==='/audit'||path.endsWith('/fulfillment-history')))await ops.context(campaign,actor,'staff.manage');
        if(ops.acceptanceMode&&area==='admin'&&path==='/workspace/sites'&&['GET','POST'].includes(method))return response(await collectionSites(ops,campaign,actor,body));
        if(ops.acceptanceMode&&area==='admin'&&path==='/workspace/bulk'&&method==='POST')return response(await bulkWishes(ops,campaign,body,actor,request.headers.get('Idempotency-Key')));
        if(ops.directMode){
          if(area==='public'){
            if(method==='GET'&&path==='/postal-areas')return response(directPostalData());
            if(method==='GET'&&path==='/privacy')return response(await getPrivacy(ops,campaign));
            if(method==='POST'&&['/direct/adopt','/direct/login','/direct/claims','/direct/logout','/direct/cancel'].includes(path)){const out=await directRoute(ops,campaign,path,body,request);if(Object.hasOwn(out,'session'))setCookie=ownerCookie(request,out.session,{scoped:Boolean(ops.acceptanceMode)});return response(out.data);}
            if(method==='POST')throw new ApiError('DIRECT_CLAIM_REQUIRED',403);
          }
          if(area==='admin'&&['/workspace/password-reset','/ops/reminder-preview','/ops/profile/save'].includes(path))throw new ApiError('USE_DIRECT_WORKSPACE',403);
        }
        if(ops.caseMode){
          auditContext={ops,campaign,actor,path,method,body};
          if(area==='public'&&method==='GET'&&path==='/progress'){const {total,claimed,remaining,percentage}=await campaignProgress(ops,campaign);return response({total,claimed,remaining,percentage});}
          if(area==='admin'&&method==='GET'&&path==='/platform-audit')return response(await listPlatformAudit(ops,campaign,actor));
          if(area==='admin'&&method==='POST'&&(['/wishes','/wishes/import','/ops/content','/ops/settings'].includes(path)||/^\/claims\/[^/]+\/cancel$/.test(path)))throw new ApiError('USE_CASE_WORKSPACE',403);
          if(['/owner/profile/save','/ops/profile/save'].includes(path)&&(body?.profile?.documentPreferences?.electronicThankYou||body?.profile?.documentPreferences?.electronicProof))throw new ApiError('PAPER_ONLY');
          if(area==='admin'&&path==='/ops/assist')throw new ApiError('ASSISTED_CLAIM_DISABLED',403);
          if(area==='public'&&['/owner/login'].includes(path))throw new ApiError('CONTACT_NXSPACE_FOR_RESET',403);
          if(area==='public'&&path==='/email/challenge'&&body?.purpose!=='adopt')throw new ApiError('CONTACT_NXSPACE_FOR_RESET',403);
          if(area==='public'&&['/email/challenge','/email/adopt'].includes(path)&&body?.claim?.contact?.documentPreferences&&(body.claim.contact.documentPreferences.electronicThankYou||body.claim.contact.documentPreferences.electronicProof))throw new ApiError('PAPER_ONLY');
          if(area==='admin'){
            if(method==='GET'&&path==='/workspace/cases')return response(await workspaceCases(ops,campaign,actor));
            if(path==='/workspace/settings'&&['GET','POST'].includes(method))return response(await campaignSettings(ops,campaign,body,actor));if(path==='/workspace/content'&&['GET','POST'].includes(method))return response(await contentEditor(ops,campaign,body,actor));
            if(method==='POST'){const key=request.headers.get('Idempotency-Key');const routes={...(ops.directMode?{'/workspace/pin-reset':()=>resetPin(ops,campaign,body,actor,key),'/workspace/mailing':()=>mailingCorrection(ops,campaign,body,actor,key)}:{}),'/workspace/export-access':()=>setExportAccess(ops,campaign,body,actor),'/workspace/export':()=>exportMailingList(ops,campaign,body,actor),'/platform-audit/page':()=>listPlatformAudit(ops,campaign,actor,body),'/platform-audit/cleanup':()=>purgeExpiredAudit(ops,campaign,actor),'/workspace/documents':()=>paperDocuments(ops,campaign,body,actor,key),'/workspace/case':()=>caseDetail(ops,campaign,body,actor),'/workspace/support':()=>supportEvent(ops,campaign,body,actor,key),'/workspace/phone':()=>phoneSearch(ops,campaign,body,actor),'/workspace/password-reset':()=>adminReset(ops,campaign,body,actor)};if(routes[path])return response(await routes[path]());}
          }
        }
        if(area==='public'&&method==='GET'&&path==='/content')return response(await ops.publicContent(campaign));
        if(area==='admin'&&path==='/ops/content'&&['GET','POST'].includes(method))return response(await ops.publicContent(campaign,body,actor));
        if(ops.manualMode&&(/media/.test(path)))throw new ApiError("ATTACHMENTS_DISABLED",503);
        if(area==='public'&&['/claims','/recovery/request','/recovery/complete'].includes(path))throw new ApiError('EMAIL_OR_ASSISTED_VERIFICATION_REQUIRED',403);
        if(method==='POST'&&area==='public'){
          const routes={
            '/email/challenge':()=>ops.emailChallenge(campaign,body),
            '/email/adopt':()=>ops.online(campaign,body),
            '/owner/recovery/request':()=>ops.requestOwnerLink(campaign,body),
            '/owner/recovery/complete':()=>ops.redeemOwnerLink(campaign,body),
            '/owner/login':()=>ops.loginOwner(campaign,body),
            '/owner/password':()=>setDonorPassword(ops,campaign,body),
            '/owner/password/login':()=>loginDonorPassword(ops,campaign,body),
            '/owner/claims':()=>ops.ownerClaims(campaign,body.credentials),
            '/owner/profile':()=>ops.contactProfile(campaign,body),
            '/owner/media':()=>ops.ownerMedia(campaign,body),
            '/owner/profile/save':()=>ops.contactProfile(campaign,body,null,true),
            '/owner/cancel':()=>ops.ownerCancel(campaign,body),
            '/cancel-request':()=>ops.requestCancel(campaign,body),
            '/owner/logout':async()=>{const s=await ops.owner(campaign,body.credentials,true);await repository.statement('UPDATE OwnerAccess SET revoked_at=unixepoch() WHERE id=?',s.id).run();return {revoked:true};}
          };
          if(routes[path])return response(await routes[path]());
        }
        if(area==='admin'){
          if(method==='GET'&&path==='/ops/dashboard')return response(await ops.dashboard(campaign,actor));
          if(method==='GET'&&path==='/ops/settings')return response(await ops.settings(campaign,null,actor));
          const reads={'/ops/proposals':'proposals','/ops/cancellations':'cancellations','/ops/overdue':'overdue','/ops/accounts':'accounts'};
          if(method==='GET'&&reads[path])return response(await ops[reads[path]](campaign,actor));
          if(method==='POST'){
            const key=request.headers.get('Idempotency-Key');
            const routes={
              '/ops/deadline':()=>ops.extendDeadline(campaign,body,actor,key),
              '/ops/reminder-preview':()=>ops.previewReminders(campaign,actor),
              '/ops/release':()=>ops.release(campaign,body,actor,key),
              '/ops/correct-location':()=>ops.correctLocation(campaign,body,actor,key),
              '/ops/search':()=>ops.search(campaign,body,actor),
              '/ops/settings':()=>ops.settings(campaign,body,actor),
              '/ops/import':()=>ops.importWishes(campaign,body,actor,key),
              '/ops/assist':()=>ops.assist(campaign,body,actor),
              '/ops/assisted-lookup':()=>ops.assistedLookup(campaign,body,actor),
              '/ops/wish-submit':()=>ops.submitWish(campaign,body,actor,key),
              '/ops/proposal-review':()=>ops.reviewProposal(campaign,body,actor,key),
              '/ops/child':()=>ops.child(campaign,body,actor),
              '/ops/child/save':()=>ops.child(campaign,body,actor,true),
              '/ops/profile':()=>ops.contactProfile(campaign,body,actor),
              '/ops/profile/save':()=>ops.contactProfile(campaign,body,actor,true),
              '/ops/cancellation-review':()=>ops.reviewCancellation(campaign,body,actor),
              '/ops/reopen':()=>ops.reopen(campaign,body,actor),
              '/ops/case':()=>ops.caseOperation(campaign,body,actor,key),
              '/ops/revoke':()=>ops.revoke(campaign,body,actor),
              '/ops/fulfillment':()=>ops.fulfill(campaign,body,actor,key)
            };
            if(routes[path])return response(await routes[path]());
          }
        }
      }
      if(experience){
        if(area==='public'&&method==='GET'&&/^\/wishes(?:\/(?:NX-[0-9]{3,12}|[a-zA-Z0-9_-]{8,80}))?$/.test(path))return response(await experience.wishes(campaign,path.split('/')[2]||null));
        if(area==='public'&&method==='POST'&&path==='/recovery/request')return response(await experience.requestRecovery(campaign,body));
        if(area==='public'&&method==='POST'&&path==='/recovery/complete')return response(await experience.finishRecovery(campaign,body));
        if(area==='public'&&method==='POST'&&path==='/donor-media')return response(await experience.donorMedia(campaign,body));
        const media=path.match(/^\/media\/([a-zA-Z0-9_-]{8,80})(\/review|\/content)?$/);
        if(media&&area==='public'&&!media[2]&&['GET','POST'].includes(method))return response(await experience.readMedia(campaign,media[1],method==='POST'?{credentials:body}:{}));
        if(area==='admin'&&method==='POST'&&path==='/wish-editor')return response(await experience.saveWish(campaign,body,actor,request.headers.get('Idempotency-Key')));
        if(area==='admin'&&path==='/media'&&method==='GET')return response(await experience.mediaList(campaign,actor));
        if(area==='admin'&&path==='/media'&&method==='POST')return response(await experience.upload(campaign,body,actor));
        if(area==='admin'&&path==='/documents'&&method==='GET')return response(await experience.documentRequests(campaign,actor));
        if(area==='admin'&&media&&method==='POST'&&media[2]==='/review')return response(await experience.reviewMedia(campaign,media[1],body,actor));
        if(area==='admin'&&media&&method==='POST'&&media[2]==='/content')return response(await experience.readMedia(campaign,media[1],{actor}));
        const message=path.match(/^\/claims\/([a-zA-Z0-9_-]{8,80})\/public-message$/);
        if(area==='admin'&&message&&method==='POST')return response(await experience.reviewMessage(campaign,message[1],body,actor));
        const draft=path.match(/^\/claims\/([a-zA-Z0-9_-]{8,80})\/message-draft$/);
        if(area==='admin'&&draft&&method==='POST')return response(await experience.messageDraft(campaign,draft[1],actor));
      }
      if (area === 'admin' && management && method === 'GET' && ['/context','/wishes','/claims','/batches','/audit'].includes(path)) return response(await management.read(campaign,path,actor));
      if (area === 'public' && method === 'GET' && path === '') return response(await repository.campaign(campaign));
      if (area === 'public' && method === 'GET' && /^\/wishes(?:\/(?:NX-[0-9]{3,12}|[a-zA-Z0-9_-]{8,80}))?$/.test(path)) return response(await repository.wishes(campaign, path.split('/')[2] || null));
      if (area === 'public' && method === 'POST' && path === '/claims') {
        validateBody('claim', body);
        return response(await repository.claim(campaign, body, await verifyIntent?.(campaign, body)));
      }
      if (area === 'public' && method === 'POST' && path === '/claim-results') {
        const result=await (fulfillment ? fulfillment.progress(campaign, body) : repository.recover(campaign, body));
        if(ops)return response({...result,...await ops.progressRow(result)});
        if(experience&&result.status==='gift_received'){const batch=await repository.statement('SELECT batch_id FROM HandoffBatchItems WHERE claim_id=?',result.claimId).first();if(batch)result.displayStage='handoff_pending';}
        return response(result);
      }
      if (area === 'admin' && fulfillment) {
        const operation = path.match(/^\/claims\/([a-zA-Z0-9_-]{8,80})\/(receipt|delivery|exception|resolve)$/);
        if (method === 'POST' && operation) {
          if (!body || typeof body !== 'object' || Array.isArray(body) || 'claimId' in body) throw new ApiError('INVALID_FIELDS');
          return response(await fulfillment.execute(campaign, operation[2], { ...body, claimId: operation[1] }, actor, request.headers.get('Idempotency-Key')));
        }
        if (method === 'POST' && path === '/handoff-batches') return response(await fulfillment.execute(campaign, 'batch', body, actor, request.headers.get('Idempotency-Key')));
        const batch = path.match(/^\/handoff-batches\/([a-zA-Z0-9_-]{8,80})(\/acceptance)?$/);
        if (batch && method === 'GET' && !batch[2]) return response(await fulfillment.batch(campaign, batch[1], actor));
        const history = path.match(/^\/claims\/([a-zA-Z0-9_-]{8,80})\/fulfillment-history$/);
        if (history && method === 'GET') return response(await fulfillment.history(campaign, history[1], actor));
        if (batch && method === 'POST' && batch[2]) {
          if (!body || typeof body !== 'object' || Array.isArray(body) || 'batchId' in body) throw new ApiError('INVALID_FIELDS');
          return response(await fulfillment.execute(campaign, 'accept', { ...body, batchId: batch[1] }, actor, request.headers.get('Idempotency-Key')));
        }
      }
      if (area === 'admin' && method === 'POST' && ['/wishes', '/wishes/import'].includes(path)) {
        validateBody(path.endsWith('/import') ? 'import' : 'wish', body);
        return response(await repository.importWishes(campaign, path.endsWith('/import') ? body.wishes : [body], actor), 201);
      }
      const cancel = path.match(/^\/claims\/([a-zA-Z0-9_-]{8,80})\/cancel$/);
      if (area === 'admin' && method === 'POST' && cancel) return response(await repository.transition(campaign, cancel[1], 'cancelled', body, actor));
      throw new ApiError('NOT_IMPLEMENTED', 501);
    } catch (error) {
      const safe = error instanceof ApiError ? error : new ApiError('WRITE_OR_READ_UNCONFIRMED', 503);
      return response({ error: { code: safe.code, retryable: safe.status === 503 } }, safe.status);
    }
  } };
}
