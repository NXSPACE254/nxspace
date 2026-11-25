import { readFile } from 'node:fs/promises';
import { migrationStatements } from './migration-loader.mjs';
import { fulfillmentFixture } from './fulfillment-fixture.mjs';
import { ChristmasManagement } from '../src/management.mjs';
import { CampaignExperience } from '../src/campaign-experience.mjs';
import { digest } from '../src/crypto.mjs';
import { ApiError } from '../src/validation.mjs';

export const admin={verified:true,issuer:'urn:synthetic',subject:'synthetic-admin'};
export function syntheticRecovery(){
  const challenges=new Map(),codes=new Map();
  return {
    codes,
    async requestChallenge({campaign,phone,wishCode}){if(phone!=='0900000000')throw new ApiError('SYNTHETIC_ONLY',403);const challengeId=crypto.randomUUID(),code=String(crypto.getRandomValues(new Uint32Array(1))[0]%1000000).padStart(6,'0');challenges.set(challengeId,{campaign,phone,wishCode,hash:await digest(code),expiresAt:Math.floor(Date.now()/1000)+120,attempts:0});codes.set(challengeId,code);return {challengeId};},
    async verifyChallenge({campaign,challengeId,code}){const row=challenges.get(challengeId);if(!row||row.campaign!==campaign||row.expiresAt<=Math.floor(Date.now()/1000)||++row.attempts>5||row.hash!==await digest(code))throw new ApiError('OTP_INVALID',403);challenges.delete(challengeId);codes.delete(challengeId);return {verified:true,campaign:row.campaign,phone:row.phone,wishCode:row.wishCode,expiresAt:row.expiresAt};}
  };
}
export async function extendExperience(f,{recovery=syntheticRecovery()}={}){
  const sql=await readFile(new URL('../migrations/0005_campaign_experience.sql',import.meta.url),'utf8');
  if(f.db.db?.exec)f.db.db.exec(sql);else await f.db.batch(migrationStatements(sql).map(statement=>f.db.prepare(statement).bind()));
  await f.db.batch([f.db.prepare("INSERT INTO AdminUsers(id,issuer,subject) VALUES('admin001','urn:synthetic','synthetic-admin')").bind(),f.db.prepare("INSERT INTO UserRoles VALUES('admin001','nx_admin','campaign1')").bind(),f.db.prepare("UPDATE Wishes SET public_nickname='小星',gift_name='冬日閱讀禮物',description='合成心願：希望有一本適齡故事書，陪伴冬日閱讀。'").bind()]);
  const management=new ChristmasManagement(f.core),experience=new CampaignExperience({core:f.core,management,store:{...f.store,get:async key=>f.objects.get(key)},scan:async()=> 'clean',recovery});
  return {...f,management,experience,recovery};
}
export async function experienceFixture(engine='SQLite',number=3,options={}){const f=await fulfillmentFixture(engine,number,false,options.publicCodes?'NX-':'SYNTH-');try{return await extendExperience(f,options);}catch(error){await f.close();throw error;}}
