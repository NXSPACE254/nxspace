import { ApiError } from './validation.mjs';
import { ROLE_PERMISSIONS } from './domain.mjs';

// Explicit projections only; contacts, child aliases and evidence keys are absent.
export class ChristmasManagement {
  constructor(core) { this.core=core; }
  async context(campaign,actor,permission='claim.read') {
    if(this.core.operationsEnabled)return this.core.operating.context(campaign,actor,permission);
    const id=await this.core.admin(campaign,actor,permission);
    const {results:roles}=await this.core.statement('SELECT role_id FROM UserRoles WHERE user_id=? AND campaign_id=?',id,campaign).all();
    const nx=roles.some(r=>['nx_admin','nx_staff'].includes(r.role_id));
    const {results:organisations}=await this.core.statement(`SELECT o.id,o.label FROM Organisations o WHERE o.campaign_id=? AND o.active=1 AND (?=1 OR EXISTS(SELECT 1 FROM OrganisationMembers m WHERE m.organisation_id=o.id AND m.campaign_id=o.campaign_id AND m.user_id=?))`,campaign,nx?1:0,id).all();
    return {id,nx,organisations,permissions:[...new Set(roles.flatMap(r=>ROLE_PERMISSIONS[r.role_id]||[]))]};
  }
  async read(campaign,path,actor) {
    if(this.core.operationsEnabled)return this.core.operating.read(campaign,path,actor);
    const ctx=await this.context(campaign,actor,path==='/audit'?'audit.read':'claim.read');
    if(path==='/context')return {permissions:ctx.permissions,organisations:ctx.organisations};
    const scope=`w.campaign_id=? AND (?=1 OR EXISTS(SELECT 1 FROM OrganisationMembers m JOIN Organisations o ON o.id=m.organisation_id WHERE m.user_id=? AND m.campaign_id=w.campaign_id AND m.organisation_id=w.organisation_id AND o.active=1))`;
    const args=[campaign,ctx.nx?1:0,ctx.id];
    if(path==='/wishes') return (await this.core.statement(`SELECT w.id,w.public_code,w.gift_name,w.description,w.status,w.publication_status,w.organisation_id${this.core.experienceEnabled?',w.public_nickname,w.age_band,w.title,w.specifications,w.claim_due_at,w.gift_due_at,w.version,w.created_at,w.updated_at':''} FROM Wishes w WHERE ${scope} ORDER BY w.public_code LIMIT 1000`,...args).all()).results;
    if(path==='/claims') return (await this.core.statement(`SELECT c.id,c.status,c.version,w.public_code,w.gift_name,w.organisation_id,(SELECT i.handoff_id FROM HandoffItems i WHERE i.claim_id=c.id) AS handoff_id FROM Claims c JOIN Wishes w ON w.id=c.wish_id WHERE ${scope} ORDER BY w.public_code LIMIT 1000`,...args).all()).results;
    if(path==='/batches') return (await this.core.statement(`SELECT b.id,b.status,b.version,b.organisation_id,b.planned_at FROM HandoffBatches b WHERE b.campaign_id=? AND (?=1 OR EXISTS(SELECT 1 FROM OrganisationMembers m JOIN Organisations o ON o.id=m.organisation_id WHERE m.user_id=? AND m.campaign_id=b.campaign_id AND m.organisation_id=b.organisation_id AND o.active=1)) ORDER BY b.created_at DESC LIMIT 1000`,...args).all()).results;
    if(path==='/audit') {
      if(ctx.nx)return (await this.core.statement('SELECT id,resource_type,resource_id,action,reason_code,occurred_at AS created_at FROM AuditLogs WHERE campaign_id=? ORDER BY id DESC LIMIT 200',campaign).all()).results;
      return (await this.core.statement(`SELECT f.id,f.kind,f.created_at,json_extract(f.result_json,'$.status') AS status FROM FulfillmentOperations f JOIN Claims c ON c.id=json_extract(f.payload,'$.claimId') JOIN Wishes w ON w.id=c.wish_id WHERE ${scope} ORDER BY f.created_at DESC LIMIT 200`,...args).all()).results;
    }
    throw new ApiError('NOT_FOUND',404);
  }
}
