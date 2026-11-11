import { getCommerceRepository } from "./commerce-service.js";
import { NotificationRepository } from "./notification-service.js";
import { generatePublicId } from "../utils/id.js";

const KEYS = Object.freeze({
  orders: "nxspace.beta.v1.orders",
  supplies: "nxspace.beta.v1.1.daily-supplies",
  slots: "nxspace.beta.v1.1.slot-capacities",
  cart: "nxspace.beta.v1.1.cart",
  audit: "nxspace.beta.v1.1.commerce-audit"
});
export const unifiedOrderStatusLabels = Object.freeze({
  pending_merchant_confirmation: "等待店家確認", accepted: "已接單", rejected: "店家拒絕",
  preparing: "備餐中", ready: "可取餐", completed: "已完成",
  customer_cancelled: "顧客取消", merchant_cancelled: "店家取消", no_show: "未取餐"
});
export const sourceTypeLabels = Object.freeze({ online: "線上預訂", "walk-in": "現場點單", admin: "管理員代建", other: "其他" });
export const paymentMethodLabels = Object.freeze({ cash: "現金", transfer: "轉帳", unpaid: "尚未付款", other: "其他" });
const transitions = Object.freeze({
  pending_merchant_confirmation: ["accepted", "rejected", "customer_cancelled", "merchant_cancelled"],
  accepted: ["preparing", "merchant_cancelled"], preparing: ["ready", "merchant_cancelled"],
  ready: ["completed", "no_show", "merchant_cancelled"], rejected: [], completed: [],
  customer_cancelled: [], merchant_cancelled: [], no_show: []
});
const read = (key, fallback = []) => {
  try { const value = JSON.parse(localStorage.getItem(key) || "null"); return value ?? fallback; }
  catch { return fallback; }
};
const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
const clean = (value = "") => String(value).trim();
const now = () => new Date().toISOString();
const number = (value) => Number(value) || 0;
const phoneDigits = (value = "") => String(value).replace(/\D/g, "").replace(/^886/, "0");

export class OrderOperationsService {
  constructor({ commerceRepository = getCommerceRepository(), notifications = new NotificationRepository() } = {}) {
    this.commerce = commerceRepository;
    this.notifications = notifications;
    if (!localStorage.getItem(KEYS.orders)) write(KEYS.orders, safeSeedOrders(this.commerce));
  }

  listOrders(context = {}) {
    const records = read(KEYS.orders, safeSeedOrders(this.commerce)).map(normalizeOrder);
    return Array.isArray(context.scope) ? records.filter((order) => context.scope.includes(order.merchantId)) : records;
  }

  getOrder(id, context = {}) {
    return this.listOrders(context).find((order) => order.orderId === clean(id).toUpperCase()) || null;
  }

  createOnlineOrder(input) {
    let result;
    this.transaction(() => {
      const legacyOrder = this.commerce.saveOrder(input);
      const activity = this.commerce.eligibleSalesActivities(input.merchantId).find((item) => item.startDate === input.pickupDate);
      if (!activity) { result = normalizeOrder({ ...legacyOrder, sourceType: "online" }); return; }
      const items = normalizeOrder(legacyOrder).items;
      const supplyReservations = items.map((item) => {
        const supply = this.commerce.listDailySupplies(input.merchantId).find((record) => record.activityId === activity.activityId && record.productId === item.productId);
        if (!supply || supplyRemaining(supply) < item.quantity) throw new Error(`${item.productName} 今日剩餘供應量不足。`);
        return { supplyId: supply.supplyId, productId: item.productId, quantity: item.quantity };
      });
      const units = items.reduce((sum, item) => sum + item.capacityUnits * item.quantity, 0);
      const slot = this.commerce.listSlotCapacities(input.merchantId).find((record) => record.activityId === activity.activityId && record.date === input.pickupDate && record.startTime === input.pickupTime);
      if (!slot || units > slot.reservationCapacity - slot.reservationUsed || units > slot.remainingCapacity) throw new Error("所選時段的線上預約容量不足。");
      const supplies = read(KEYS.supplies, this.commerce.listDailySupplies());
      supplyReservations.forEach((reservation) => {
        const record = supplies.find((item) => item.supplyId === reservation.supplyId);
        record.reservedQuantity = number(record.reservedQuantity) + reservation.quantity;
      });
      const slots = read(KEYS.slots, this.commerce.listSlotCapacities());
      const slotRecord = slots.find((item) => item.slotCapacityId === slot.slotCapacityId);
      slotRecord.reservationUsed = number(slotRecord.reservationUsed) + units;
      result = normalizeOrder({ ...legacyOrder, activityId: activity.activityId, sourceType: "online", supplyReservations, slotCapacityReservation: { slotCapacityId: slot.slotCapacityId, units, capacityType: "reservation" } });
      write(KEYS.supplies, supplies); write(KEYS.slots, slots);
      write(KEYS.orders, read(KEYS.orders, []).map((item) => normalizeOrder(item).orderId === result.orderId ? result : item));
    });
    return result;
  }

  createWalkInOrder(input, context = {}) {
    assertPermission(context, input.sourceType === "admin" ? "orders.admin-create" : "pos.create");
    assertScope(context, input.merchantId);
    const merchant = this.commerce.getMerchant(input.merchantId);
    if (!merchant || merchant.status !== "active" || merchant.forcedClosed || !merchant.acceptsOrders || !merchant.acceptsWalkInOrders) {
      throw new Error(merchant?.forcedClosePublicMessage || merchant?.pauseReason || "店家目前未開放現場點單。");
    }
    const activity = this.commerce.eligibleSalesActivities(input.merchantId)
      .find((item) => item.activityId === input.activityId && item.startDate === input.pickupDate);
    if (!activity) throw new Error("現場訂單必須選擇已確認且開放商品銷售的活動。");
    const items = this.createItemSnapshots(input.items, merchant.merchantId);
    const supplyReservations = items.map((item) => {
      const supply = this.commerce.listDailySupplies(merchant.merchantId)
        .find((record) => record.activityId === activity.activityId && record.productId === item.productId);
      if (!supply || !supply.available || supplyRemaining(supply) < item.quantity) throw new Error(`${item.productName} 今日剩餘供應量不足。`);
      return { supplyId: supply.supplyId, productId: item.productId, quantity: item.quantity };
    });
    const units = items.reduce((sum, item) => sum + item.capacityUnits * item.quantity, 0);
    const slot = this.commerce.listSlotCapacities(merchant.merchantId)
      .find((record) => record.activityId === activity.activityId && record.date === input.pickupDate && record.startTime === input.pickupTime);
    if (!slot) throw new Error("找不到所選取餐時段的容量設定。");
    const walkInRemaining = Math.max(0, slot.walkInReservedCapacity - slot.walkInUsed);
    const totalRemaining = Math.max(0, slot.totalCapacity - slot.reservationUsed - slot.walkInUsed);
    if (input.allowSharedCapacity) assertPermission(context, "pos.override-capacity");
    if (units > totalRemaining || (units > walkInRemaining && !input.allowSharedCapacity)) throw new Error("所選時段的現場保留容量不足。");

    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
    const adjustmentAmount = number(input.adjustmentAmount);
    const finalTotal = Math.max(0, subtotal + (input.adjustmentType === "discount" ? -adjustmentAmount : adjustmentAmount));
    const timestamp = now();
    const order = normalizeOrder({
      orderId: generatePublicId("NXO"), merchantId: merchant.merchantId, merchantNameSnapshot: merchant.name, activityId: activity.activityId,
      sourceType: input.sourceType || "walk-in", customerName: clean(input.customerName),
      customerPhone: clean(input.customerPhone), customerEmail: clean(input.customerEmail).toLowerCase(),
      pickupDate: input.pickupDate, pickupTime: input.pickupTime, items, originalSubtotal: subtotal,
      originalTotal: subtotal, adjustmentType: input.adjustmentType || "none", adjustmentAmount,
      adjustmentReason: clean(input.adjustmentReason), adjustmentNote: clean(input.adjustmentNote), finalTotal,
      paidAmount: number(input.paidAmount), paymentMethod: input.paymentMethod || "cash",
      orderStatus: "pending_merchant_confirmation", fulfillmentStatus: "pending",
      paymentStatus: number(input.paidAmount) >= finalTotal ? "paid" : number(input.paidAmount) > 0 ? "partial" : "unpaid",
      voidStatus: "active", publicNote: "訂單已建立。", privateNote: clean(input.privateNote),
      notes: clean(input.notes), supplyReservations,
      slotCapacityReservation: { slotCapacityId: slot.slotCapacityId, units, capacityType: "walk-in" },
      notificationEvents: [], statusHistory: [{ from: null, to: "pending_merchant_confirmation", actor: context.actor, reason: "建立現場訂單", at: timestamp }],
      createdAt: timestamp, createdBy: context.actor, updatedAt: timestamp, updatedBy: context.actor
    });
    this.transaction(() => {
      const supplies = read(KEYS.supplies, this.commerce.listDailySupplies());
      supplyReservations.forEach((reservation) => {
        const record = supplies.find((item) => item.supplyId === reservation.supplyId);
        record.onSiteQuantity = number(record.onSiteQuantity) + reservation.quantity;
        record.updatedAt = timestamp;
      });
      const slots = read(KEYS.slots, this.commerce.listSlotCapacities());
      const slotRecord = slots.find((item) => item.slotCapacityId === slot.slotCapacityId);
      slotRecord.walkInUsed = number(slotRecord.walkInUsed) + units;
      slotRecord.updatedAt = timestamp;
      write(KEYS.supplies, supplies); write(KEYS.slots, slots);
      write(KEYS.orders, [order, ...read(KEYS.orders, [])]);
    });
    this.recordEvent("order.walk-in-created", order, context, { units, finalTotal });
    this.notify(order, "order_created", `新現場訂單 ${order.orderId}，取餐 ${order.pickupTime}`);
    write(KEYS.orders, read(KEYS.orders, []).map((item) => normalizeOrder(item).orderId === order.orderId ? order : item));
    return order;
  }

  updateStatus(id, nextStatus, changes = {}, context = {}) {
    assertPermission(context, "orders.status");
    const order = this.getOrder(id, context);
    if (!order) throw new Error("找不到訂單。");
    if (!transitions[order.orderStatus]?.includes(nextStatus)) throw new Error("不允許此訂單狀態轉換。");
    if (nextStatus === "rejected" && !clean(changes.reason)) throw new Error("拒絕訂單必須填寫原因。");
    const timestamp = now();
    const next = normalizeOrder({
      ...order, orderStatus: nextStatus, fulfillmentStatus: fulfillmentFromStatus(nextStatus),
      rejectionReason: nextStatus === "rejected" ? clean(changes.reason) : order.rejectionReason,
      cancellationReason: ["customer_cancelled", "merchant_cancelled"].includes(nextStatus) ? clean(changes.reason) : order.cancellationReason,
      publicCancellationMessage: clean(changes.publicMessage || changes.reason),
      publicNote: clean(changes.publicNote) || order.publicNote, privateNote: clean(changes.privateNote) || order.privateNote,
      cancelledAt: ["rejected", "customer_cancelled", "merchant_cancelled"].includes(nextStatus) ? timestamp : order.cancelledAt,
      cancelledBy: ["rejected", "customer_cancelled", "merchant_cancelled"].includes(nextStatus) ? context.actor : order.cancelledBy,
      wasteRecorded: nextStatus === "no_show" ? Boolean(changes.wasteRecorded) : order.wasteRecorded,
      updatedAt: timestamp, updatedBy: context.actor,
      statusHistory: [...order.statusHistory, { from: order.orderStatus, to: nextStatus, actor: context.actor, reason: clean(changes.reason), at: timestamp }],
      lastCustomerVisibleUpdateAt: timestamp
    });
    this.transaction(() => {
      if (["rejected", "customer_cancelled", "merchant_cancelled"].includes(nextStatus)) {
        this.releaseReservations(order, clean(changes.reason) || unifiedOrderStatusLabels[nextStatus]);
        next.releasedAt = order.releasedAt; next.releaseReason = order.releaseReason;
      }
      write(KEYS.orders, read(KEYS.orders, []).map((item) => normalizeOrder(item).orderId === order.orderId ? next : item));
    });
    this.recordEvent(`order.${nextStatus}`, next, context, { reason: clean(changes.reason) });
    this.notify(next, `order_${nextStatus}`, `訂單 ${next.orderId} 已更新為${unifiedOrderStatusLabels[nextStatus]}`);
    write(KEYS.orders, read(KEYS.orders, []).map((item) => normalizeOrder(item).orderId === next.orderId ? next : item));
    return next;
  }

  adjustOrder(id, input, context = {}) {
    assertPermission(context, "orders.adjust");
    const order = this.getOrder(id, context);
    if (!order) throw new Error("找不到訂單。");
    if (!clean(input.adjustmentReason)) throw new Error("金額調整必須填寫原因。");
    const amount = number(input.adjustmentAmount);
    const finalTotal = Math.max(0, order.originalTotal + (input.adjustmentType === "discount" ? -amount : amount));
    const next = normalizeOrder({ ...order, adjustmentType: input.adjustmentType, adjustmentAmount: amount, adjustmentReason: clean(input.adjustmentReason), adjustmentNote: clean(input.adjustmentNote), finalTotal, paidAmount: number(input.paidAmount), paymentMethod: input.paymentMethod || order.paymentMethod, updatedAt: now(), updatedBy: context.actor });
    write(KEYS.orders, read(KEYS.orders, []).map((item) => normalizeOrder(item).orderId === order.orderId ? next : item));
    this.recordEvent("order.amount-adjusted", next, context, { before: order.finalTotal, after: finalTotal, reason: next.adjustmentReason });
    return next;
  }

  voidOrder(id, reason, context = {}) {
    assertPermission(context, "orders.void");
    const order = this.getOrder(id, context);
    if (!order) throw new Error("找不到訂單。");
    if (!clean(reason)) throw new Error("作廢訂單必須填寫原因。");
    const next = normalizeOrder({ ...order, voidStatus: "voided", voidReason: clean(reason), voidedAt: now(), voidedBy: context.actor, updatedAt: now(), updatedBy: context.actor });
    this.transaction(() => {
      if (!order.releasedAt && !["completed", "no_show"].includes(order.orderStatus)) {
        this.releaseReservations(order, `作廢：${clean(reason)}`);
        next.releasedAt = order.releasedAt; next.releaseReason = order.releaseReason;
      }
      write(KEYS.orders, read(KEYS.orders, []).map((item) => normalizeOrder(item).orderId === order.orderId ? next : item));
    });
    this.recordEvent("order.voided", next, context, { reason: clean(reason) });
    return next;
  }

  customerHistory(phone, context = {}) {
    assertPermission(context, "customers.history");
    const target = phoneDigits(phone);
    if (target.length < 9) throw new Error("請輸入有效手機號碼。");
    const since = Date.now() - 30 * 86400000;
    return this.listOrders(context).filter((order) => phoneDigits(order.customerPhone) === target && new Date(order.createdAt).getTime() >= since)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  summary(context = {}, date = new Date().toISOString().slice(0, 10)) {
    const orders = this.listOrders(context).filter((order) => order.pickupDate === date && order.voidStatus !== "voided");
    const count = (status) => orders.filter((order) => order.orderStatus === status).length;
    return {
      online: orders.filter((order) => order.sourceType === "online").length,
      walkIn: orders.filter((order) => order.sourceType === "walk-in").length,
      pending: count("pending_merchant_confirmation"), preparing: count("preparing"), ready: count("ready"),
      revenue: orders.filter((order) => order.paymentStatus === "paid").reduce((sum, order) => sum + order.paidAmount, 0)
    };
  }

  exportOrders(format, context = {}) {
    assertPermission(context, "orders.export");
    const orders = this.listOrders(context);
    if (format === "json") return { mime: "application/json", extension: "json", content: JSON.stringify(orders, null, 2) };
    const rows = [["訂單編號", "店家", "來源", "取餐日期", "取餐時間", "狀態", "原始金額", "最終金額", "實收金額", "付款方式"],
      ...orders.map((order) => [order.orderId, order.merchantId, sourceTypeLabels[order.sourceType], order.pickupDate, order.pickupTime, unifiedOrderStatusLabels[order.orderStatus], order.originalTotal, order.finalTotal, order.paidAmount, paymentMethodLabels[order.paymentMethod]])];
    return { mime: "text/csv;charset=utf-8", extension: "csv", content: rows.map((row) => row.map(csvCell).join(",")).join("\r\n") };
  }

  createItemSnapshots(items = [], merchantId) {
    const selectedItems = Array.isArray(items) ? items.filter((item) => number(item.quantity) > 0) : [];
    if (!selectedItems.length) throw new Error("請至少選擇一項商品。");
    return selectedItems.map((item) => {
      const product = this.commerce.getProduct(item.productId);
      if (!product || product.merchantId !== merchantId || product.status !== "active" || product.salesStatus !== "available") throw new Error("商品目前無法販售。");
      const quantity = number(item.quantity);
      if (quantity < 1 || quantity > product.maxQuantity) throw new Error(`${product.name} 數量超過限制。`);
      const customizations = Array.isArray(item.customizations) ? item.customizations : [];
      const adjustment = customizations.reduce((sum, option) => sum + number(option.priceAdjustment), 0);
      const unitPrice = number(product.price) + adjustment;
      return { productId: product.id, productName: product.name, sku: product.sku, unitPrice, quantity, customizationSnapshot: customizations, itemNote: clean(item.note), capacityUnits: number(product.capacityUnits) || 1, subtotal: unitPrice * quantity };
    });
  }

  releaseReservations(order, reason) {
    if (order.releasedAt) return;
    const supplies = read(KEYS.supplies, this.commerce.listDailySupplies());
    order.supplyReservations.forEach((reservation) => {
      const supply = supplies.find((item) => item.supplyId === reservation.supplyId);
      if (!supply) return;
      supply.cancelledReleasedQuantity = number(supply.cancelledReleasedQuantity) + reservation.quantity;
    });
    const slots = read(KEYS.slots, this.commerce.listSlotCapacities());
    const slot = slots.find((item) => item.slotCapacityId === order.slotCapacityReservation?.slotCapacityId);
    if (slot) {
      const field = order.slotCapacityReservation.capacityType === "reservation" ? "reservationUsed" : "walkInUsed";
      slot[field] = Math.max(0, number(slot[field]) - number(order.slotCapacityReservation.units));
    }
    order.releasedAt = now(); order.releaseReason = reason;
    write(KEYS.supplies, supplies); write(KEYS.slots, slots);
  }

  transaction(operation) {
    const snapshot = Object.fromEntries([KEYS.orders, KEYS.supplies, KEYS.slots, KEYS.cart].map((key) => [key, localStorage.getItem(key)]));
    try { return operation(); }
    catch (error) {
      Object.entries(snapshot).forEach(([key, value]) => value === null ? localStorage.removeItem(key) : localStorage.setItem(key, value));
      throw error;
    }
  }

  recordEvent(action, order, context, details = {}) {
    const records = read(KEYS.audit, []);
    records.unshift({ id: crypto.randomUUID(), action, entityId: order.orderId, actor: context.actor, details: { merchantId: order.merchantId, sourceType: order.sourceType, ...details }, createdAt: now() });
    write(KEYS.audit, records.slice(0, 300));
  }

  notify(order, type, preview) {
    const event = { eventId: crypto.randomUUID(), type, merchantId: order.merchantId, orderId: order.orderId, createdAt: now(), status: "local_only", attempts: 0, errorCode: "line_not_configured", errorMessageSafe: "LINE 通知尚未設定", preview };
    this.notifications.save(event);
    order.notificationEvents = [...order.notificationEvents, event.eventId];
    return event;
  }
}

export function normalizeOrder(input = {}) {
  const orderId = clean(input.orderId || input.id).toUpperCase();
  const orderStatus = input.orderStatus || input.status || "pending_merchant_confirmation";
  const customerName = clean(input.customerName || input.customer?.name);
  const customerPhone = clean(input.customerPhone || input.customer?.phone || input.phone);
  const customerEmail = clean(input.customerEmail || input.customer?.email || input.email).toLowerCase();
  const items = (input.items || []).map((item) => ({
    productId: item.productId, productName: item.productName || item.nameSnapshot || item.name || "商品",
    name: item.productName || item.nameSnapshot || item.name || "商品",
    sku: item.sku || "", unitPrice: number(item.unitPrice || item.basePriceSnapshot), quantity: number(item.quantity) || 1,
    customizationSnapshot: item.customizationSnapshot || item.customizations || [], itemNote: item.itemNote || item.note || "",
    capacityUnits: number(item.capacityUnits) || 1, subtotal: number(item.subtotal) || number(item.unitPrice || item.basePriceSnapshot) * (number(item.quantity) || 1)
  }));
  const originalSubtotal = number(input.originalSubtotal ?? input.total) || items.reduce((sum, item) => sum + item.subtotal, 0);
  const finalTotal = number(input.finalTotal ?? input.total) || originalSubtotal;
  return {
    ...input, id: orderId, orderId, merchantId: input.merchantId || "", activityId: input.activityId || "",
    sourceType: input.sourceType || (input.channel === "pos" ? "walk-in" : "online"),
    customerName, customerPhone, customerEmail, customer: { name: customerName, phone: customerPhone, email: customerEmail },
    pickupDate: input.pickupDate || "", pickupTime: input.pickupTime || "", items,
    originalSubtotal, originalTotal: number(input.originalTotal) || originalSubtotal,
    adjustmentType: input.adjustmentType || "none", adjustmentAmount: number(input.adjustmentAmount),
    adjustmentReason: input.adjustmentReason || "", adjustmentNote: input.adjustmentNote || "", finalTotal,
    total: finalTotal, paidAmount: number(input.paidAmount), paymentMethod: input.paymentMethod || "unpaid",
    orderStatus, status: orderStatus, statusLabel: unifiedOrderStatusLabels[orderStatus] || orderStatus,
    fulfillmentStatus: input.fulfillmentStatus || fulfillmentFromStatus(orderStatus),
    paymentStatus: input.paymentStatus || (number(input.paidAmount) >= finalTotal && finalTotal > 0 ? "paid" : number(input.paidAmount) > 0 ? "partial" : "unpaid"),
    voidStatus: input.voidStatus || "active", rejectionReason: input.rejectionReason || "",
    cancellationReason: input.cancellationReason || "", publicCancellationMessage: input.publicCancellationMessage || "",
    cancelledAt: input.cancelledAt || null, cancelledBy: input.cancelledBy || null, wasteRecorded: Boolean(input.wasteRecorded),
    refundRequired: Boolean(input.refundRequired), refundAmount: number(input.refundAmount),
    supplyReservations: input.supplyReservations || [], slotCapacityReservation: input.slotCapacityReservation || null,
    releasedAt: input.releasedAt || null, releaseReason: input.releaseReason || "",
    notificationEvents: input.notificationEvents || [], lastCustomerVisibleUpdateAt: input.lastCustomerVisibleUpdateAt || input.updatedAt || input.createdAt,
    publicNote: input.publicNote || "", privateNote: input.privateNote || "", notes: input.notes || "",
    statusHistory: input.statusHistory || [], createdAt: input.createdAt || now(), createdBy: input.createdBy || "migration",
    updatedAt: input.updatedAt || input.createdAt || now(), updatedBy: input.updatedBy || "migration"
  };
}

function assertPermission(context, permission) { if (!context?.can?.(permission)) throw new Error("沒有執行此操作的權限。"); }
function assertScope(context, merchantId) { if (Array.isArray(context?.scope) && !context.scope.includes(merchantId)) throw new Error("沒有操作此店家的權限。"); }
function fulfillmentFromStatus(status) { return ({ pending_merchant_confirmation: "pending", accepted: "accepted", preparing: "preparing", ready: "ready", completed: "fulfilled", no_show: "no_show" })[status] || "cancelled"; }
function supplyRemaining(record) { return Math.max(0, number(record.dailyLimit) - number(record.reservedQuantity) - number(record.onSiteQuantity) - number(record.completedQuantity) + number(record.cancelledReleasedQuantity) - number(record.wasteQuantity)); }
function csvCell(value) { const text = String(value ?? ""); return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }
function seedOrders(commerce) {
  const merchant = commerce.listMerchants().find((item) => item.status === "active");
  const product = merchant && commerce.listProducts(merchant.merchantId).find((item) => item.status === "active");
  if (!merchant || !product) return [];
  const date = new Date().toISOString().slice(0, 10);
  const statuses = ["pending_merchant_confirmation", "accepted", "preparing", "ready", "completed", "rejected", "merchant_cancelled", "no_show"];
  return statuses.map((status, index) => normalizeOrder({
    orderId: `NXO-DEMO-${String(index + 1).padStart(3, "0")}`, merchantId: merchant.merchantId,
    sourceType: index % 2 ? "walk-in" : "online", customerName: index < 5 ? "王小明" : `示範顧客 ${index + 1}`,
    customerPhone: index < 5 ? "0912-345-678" : `09120000${index}`, pickupDate: date,
    pickupTime: ["17:30", "18:00", "18:30"][index % 3],
    items: [{ productId: product.id, productName: product.name, unitPrice: product.price, quantity: 1, capacityUnits: product.capacityUnits, subtotal: product.price }],
    originalTotal: product.price, finalTotal: product.price, paidAmount: status === "completed" ? product.price : 0,
    paymentMethod: status === "completed" ? "cash" : "unpaid", orderStatus: status,
    voidStatus: index === 7 ? "voided" : "active", createdAt: new Date(Date.now() - index * 3600000).toISOString(), createdBy: "demo-seed"
  }));
}

function safeSeedOrders(commerce) {
  try {
    return seedOrders(commerce);
  } catch (error) {
    console.warn("訂單示範資料初始化失敗，已略過非必要 Seed。", error);
    return [];
  }
}

let service;
export function getOrderOperationsService() { service ||= new OrderOperationsService(); return service; }
