import { toPublicOrder } from "../models/order-models.js";
import { orderStatuses, paymentStatuses, fulfillmentStatuses, rentalAdminStatuses } from "../data/operations-data.js";

const ORDER_KEY = "nxspace.beta.v1.orders";
const RENTAL_KEY = "nxspace.beta.v1.rentals";
const AVAILABILITY_KEY = "nxspace.beta.v1.availability";
const AUDIT_KEY = "nxspace.beta.v1.operations.audit";
const DUPLICATE_MS = 2 * 60 * 1000;

export class OperationsRepositoryInterface { listOrders(){throw new Error("Not implemented");} saveOrder(){throw new Error("Not implemented");} listRentals(){throw new Error("Not implemented");} updateRental(){throw new Error("Not implemented");} }
export class MemoryOperationsAdapter { constructor(){this.values=new Map()} getItem(k){return this.values.get(k)||null} setItem(k,v){this.values.set(k,String(v))} removeItem(k){this.values.delete(k)} }

export class LocalOperationsRepository extends OperationsRepositoryInterface {
  constructor({ storage = localStorage } = {}) { super(); this.storage = storage; }
  read(key) { try { const value=JSON.parse(this.storage.getItem(key)||"[]"); return Array.isArray(value)?value:[]; } catch { throw new Error("本機營運資料無法讀取。"); } }
  write(key, value) { this.storage.setItem(key, JSON.stringify(value)); }
  audit(action, entityType, entityId, details = {}) { const records=this.read(AUDIT_KEY); records.unshift({id:crypto.randomUUID(),action,entityType,entityId,details,createdAt:new Date().toISOString()});this.write(AUDIT_KEY,records.slice(0,100)); }
  listAudit(limit=100){return this.read(AUDIT_KEY).slice(0,limit)}
  listOrders(){return this.read(ORDER_KEY)}
  getOrder(id){return this.listOrders().find(x=>x.id===String(id).trim().toUpperCase())||null}
  saveOrder(order){const records=this.listOrders();const duplicate=records.find(x=>x.fingerprint===order.fingerprint&&Date.now()-new Date(x.createdAt).getTime()<DUPLICATE_MS);if(duplicate)return{record:duplicate,duplicate:true};records.unshift(order);this.write(ORDER_KEY,records);this.audit("create","order",order.id);return{record:order,duplicate:false}}
  updateOrder(id, changes){const records=this.listOrders();const current=records.find(x=>x.id===id);if(!current)throw new Error("找不到訂單。");const next={...current,...changes,statusLabel:orderStatuses[changes.status||current.status],paymentStatusLabel:paymentStatuses[changes.paymentStatus||current.paymentStatus],fulfillmentStatusLabel:fulfillmentStatuses[changes.fulfillmentStatus||current.fulfillmentStatus],updatedAt:new Date().toISOString()};this.write(ORDER_KEY,records.map(x=>x.id===id?next:x));this.audit("update","order",id,changes);return next}
  deleteOrder(id){this.write(ORDER_KEY,this.listOrders().filter(x=>x.id!==id));this.audit("delete","order",id)}
  lookupOrder(id, verifier){const order=this.getOrder(id);if(!order)return null;const value=String(verifier).trim().toLowerCase();const phone=String(order.customer?.phone||order.phone||"").replace(/\D/g,"");const email=String(order.customer?.email||order.email||"").toLowerCase();return value===email||value===phone.slice(-4)?toPublicOrder(order):null}
  listRentals(){return this.read(RENTAL_KEY)}
  getRental(id){return this.listRentals().find(x=>x.id===id)||null}
  updateRental(id, changes){const records=this.listRentals();const current=records.find(x=>x.id===id);if(!current)throw new Error("找不到租借申請。");const next={...current,...changes,statusLabel:rentalAdminStatuses[changes.status||current.status]||current.statusLabel,updatedAt:new Date().toISOString()};this.assertRentalConflict(next,id);this.write(RENTAL_KEY,records.map(x=>x.id===id?next:x));this.audit("update","rental",id,changes);return next}
  deleteRental(id){this.write(RENTAL_KEY,this.listRentals().filter(x=>x.id!==id));this.audit("delete","rental",id)}
  listAvailability(){return this.read(AVAILABILITY_KEY)}
  saveAvailability(input){const records=this.listAvailability();const record={...input,id:input.id||`AVL-${crypto.randomUUID().slice(0,8)}`,createdAt:input.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};if(!record.venueId||!record.startDate||!record.endDate)throw new Error("場地與日期為必填。");if(record.endDate<record.startDate)throw new Error("結束日期不可早於開始日期。");if(records.some(x=>x.id!==record.id&&x.venueId===record.venueId&&dateOverlap(x,record)))throw new Error("此場地已有重疊的可用性設定。");this.write(AVAILABILITY_KEY,records.some(x=>x.id===record.id)?records.map(x=>x.id===record.id?record:x):[record,...records]);this.audit(input.id?"update":"create","availability",record.id);return record}
  deleteAvailability(id){this.write(AVAILABILITY_KEY,this.listAvailability().filter(x=>x.id!==id));this.audit("delete","availability",id)}
  assertRentalConflict(rental, ignoreId=""){if(rental.status!=="approved")return;const conflict=this.listRentals().find(x=>x.id!==ignoreId&&x.venueId===rental.venueId&&x.status==="approved"&&dateOverlap(x,rental)&&timeOverlap(x,rental));if(conflict)throw new Error(`與已核准申請 ${conflict.id} 衝突。`);const block=this.listAvailability().find(x=>x.venueId===rental.venueId&&x.type!=="open"&&dateOverlap(x,rental));if(block)throw new Error("所選日期已被場地可用性設定封鎖。");}
}
function dateOverlap(a,b){return a.startDate<=b.endDate&&b.startDate<=a.endDate}
function timeOverlap(a,b){return (a.startTime||"00:00")<(b.endTime||"23:59")&&(b.startTime||"00:00")<(a.endTime||"23:59")}
let instance; export function getOperationsRepository(){instance||=new LocalOperationsRepository();return instance}
