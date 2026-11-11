import { getIdentityRepository } from "../repositories/identity-repository.js";

export class PermissionService {
  constructor(repository=getIdentityRepository()){this.repository=repository}
  resolve(user){const roles=(user?.roleIds||[]).map(id=>this.repository.getRole(id)).filter(Boolean);return new Set(roles.flatMap(role=>role.permissions||[]))}
  can(user,permission){return this.resolve(user).has(permission)}
  scope(user){const order={all:4,assigned:3,own:2,read_only:1};return (user?.roleIds||[]).map(id=>this.repository.getRole(id)?.dataScope||"read_only").sort((a,b)=>order[b]-order[a])[0]||"read_only"}
  filterNavigation(user,items){const roles=user?.roleIds||[];return items.filter(item=>this.can(user,item.permission)&&(!item.roles||item.roles.some(role=>roles.includes(role)))&&!(item.excludeRoles||[]).some(role=>roles.includes(role)))}
  filterRecords(user,records,{ownerField="ownerId",assignedField="assignedUserIds"}={}){const scope=this.scope(user);if(scope==="all"||scope==="read_only")return records;if(scope==="own")return records.filter(record=>record[ownerField]===user.id);if(scope==="assigned")return records.filter(record=>record[ownerField]===user.id||(record[assignedField]||[]).includes(user.id));return[]}
  assert(user,permission){if(!this.can(user,permission)){this.repository.audit("permission.denied",permission,user?.id||"anonymous");throw new Error("Unauthorized")}}
}
let service;export function getPermissionService(){service||=new PermissionService();return service}
