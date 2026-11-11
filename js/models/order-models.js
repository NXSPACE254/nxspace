import { generatePublicId } from "../utils/id.js";
import { orderStatuses, paymentStatuses, fulfillmentStatuses } from "../data/operations-data.js";

const clean = (value = "") => String(value).trim();
const maskEmail = (value = "") => { const [name, domain] = value.split("@"); return name && domain ? `${name[0]}***@${domain}` : "***"; };
const maskPhone = (value = "") => { const digits = value.replace(/\D/g, ""); return digits.length >= 4 ? `******${digits.slice(-4)}` : "******"; };

export function createOrder(input = {}) {
  const items = (input.items || []).map((item) => ({ productId: item.productId, name: clean(item.name), quantity: Number(item.quantity), unitPrice: Number(item.unitPrice), subtotal: Number(item.quantity) * Number(item.unitPrice) }));
  const now = new Date().toISOString();
  return {
    id: generatePublicId("NXO"), status: "pending", statusLabel: orderStatuses.pending,
    paymentStatus: "unpaid", paymentStatusLabel: paymentStatuses.unpaid,
    fulfillmentStatus: "pending", fulfillmentStatusLabel: fulfillmentStatuses.pending,
    customerName: clean(input.customerName), phone: clean(input.phone), email: clean(input.email).toLowerCase(),
    pickupDate: clean(input.pickupDate), pickupTime: clean(input.pickupTime), notes: clean(input.notes), internalNote: "", publicNote: "訂單已收到，NXSPACE 將依訂單狀態準備商品。",
    items, total: items.reduce((sum, item) => sum + item.subtotal, 0), createdAt: now, updatedAt: now,
    fingerprint: [input.phone, input.email, input.pickupDate, ...items.map((item) => `${item.productId}:${item.quantity}`)].map(clean).join("|").toLowerCase()
  };
}

export function toPublicOrder(order) {
  if (!order) return null;
  const customerName=order.customer?.name||order.customerName||"";
  const phone=order.customer?.phone||order.phone||"";
  const email=order.customer?.email||order.email||"";
  return { id: order.id, merchantName: order.merchantNameSnapshot||"NXSPACE", status: order.status, statusLabel: orderStatuses[order.status] || order.statusLabel, paymentStatusLabel: paymentStatuses[order.paymentStatus], fulfillmentStatusLabel: fulfillmentStatuses[order.fulfillmentStatus], customerName: customerName ? `${customerName[0]}＊＊` : "＊＊", phone: maskPhone(phone), email: maskEmail(email), pickupDate: order.pickupDate, pickupTime: order.pickupTime, items: order.items.map((item) => ({ name:item.name||item.nameSnapshot, quantity:item.quantity, unitPrice:item.unitPrice, subtotal:item.subtotal, customizations:(item.customizationSnapshot||[]).map(x=>`${x.groupName}：${x.optionName||x.value}`) })), total: order.total, publicNote: order.publicNote, estimatedReadyTime:order.estimatedReadyTime, statusHistory:order.statusHistory||[], createdAt: order.createdAt };
}
