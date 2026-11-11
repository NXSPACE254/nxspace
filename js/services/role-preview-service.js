import { roleIdLabels } from "../data/label-registry.js";

const KEY="nxspace.beta.v1.1.role-preview";
export class RolePreviewService {
  constructor({storage=sessionStorage}={}){this.storage=storage}
  get(){try{return JSON.parse(this.storage.getItem(KEY)||"null")}catch{return null}}
  isSuperAdmin(session){return Boolean(session?.user?.roleIds?.includes("role-super-admin"))}
  enterRole(session,role){if(!this.isSuperAdmin(session))throw new Error("只有總管理可使用角色預覽。");const preview={type:"role",id:role.id,label:roleIdLabels[role.id]||role.name,roleIds:[role.id],startedAt:new Date().toISOString()};this.storage.setItem(KEY,JSON.stringify(preview));return preview}
  enterUser(session,user){if(!this.isSuperAdmin(session))throw new Error("只有總管理可使用角色預覽。");const preview={type:"user",id:user.id,label:user.displayName||user.username,roleIds:user.roleIds,startedAt:new Date().toISOString()};this.storage.setItem(KEY,JSON.stringify(preview));return preview}
  exit(){this.storage.removeItem(KEY)}
  apply(session){const preview=this.get();if(!preview)return session;return{...session,preview,displayName:`預覽：${preview.label}`,user:{...session.user,id:preview.type==="user"?preview.id:`preview-${preview.id}`,roleIds:preview.roleIds},readOnlyPreview:true}}
}
let instance;export function getRolePreviewService(){instance||=new RolePreviewService();return instance}
