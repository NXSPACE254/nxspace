import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
test('Workerd: PIN hash uses a portable cost and returns a generic unknown-account failure', {timeout:60000},async()=>{
 const {Miniflare,convertV4MiniflareOptions}=createRequire(import.meta.url)(process.env.NXSPACE_MINIFLARE_MODULE),root=fileURLToPath(new URL('../src/',import.meta.url));
 const entry=`import {directLogin} from './direct-claims.mjs';import {createCrypto} from './crypto.mjs';export default {async fetch(req,env){const crypt=await createCrypto({encryptionKey:crypto.getRandomValues(new Uint8Array(32)),requestKey:crypto.getRandomValues(new Uint8Array(32)),keyVersion:'test'});try{await directLogin({core:{statement:(s,...a)=>env.DB.prepare(s).bind(...a),crypto:crypt}},'campaign1',{email:'synthetic@example.invalid',pin:'0012'});}catch(e){return Response.json({code:e.code||e.name});}}};`;
 const options={modulesRoot:root,modules:[{type:'ESModule',path:join(root,'__virtual_direct_pin.mjs'),contents:entry},...['direct-claims.mjs','crypto.mjs','validation.mjs','contact-rules.mjs','postal-areas.mjs'].map(name=>({type:'ESModule',path:join(root,name),contents:readFileSync(join(root,name),'utf8')}))],cf:false,host:'127.0.0.1',port:0,outboundService:()=>new Response(null,{status:403}),compatibilityDate:'2026-07-30',d1Databases:['DB']};
 const runtime=new Miniflare(convertV4MiniflareOptions?.(options)??options);
 try{
  const db=await runtime.getD1Database('DB');for(const sql of ['CREATE TABLE PinAttemptWindows(campaign_id TEXT,bucket_hash TEXT,seconds INTEGER,window_start INTEGER,attempts INTEGER,PRIMARY KEY(campaign_id,bucket_hash,seconds))','CREATE TABLE DonorPortals(id TEXT,campaign_id TEXT,email_hash TEXT,key_version TEXT)','CREATE TABLE PlatformAudit(id TEXT,campaign_id TEXT,actor_id TEXT,actor_name TEXT,unit_id TEXT,action TEXT,resource_id TEXT,result TEXT)'])await db.prepare(sql).run();
  const response=await runtime.dispatchFetch('http://127.0.0.1/pin-test');assert.deepEqual(await response.json(),{code:'PIN_AUTH_FAILED'});assert.equal((await db.prepare('SELECT count(*) n FROM PlatformAudit').first()).n,1);
 }finally{await runtime.dispose();}
});
