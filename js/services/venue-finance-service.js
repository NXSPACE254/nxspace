import { getVenueActivityRepository, venues, TAX_RATE } from "./venue-activity-service.js";

const MONTHLY_KEY = "nxspace.beta.v1.1.food-truck-monthly-billing";
const CHECKLIST_KEY = "nxspace.beta.v1.1.field-checklists";
const read = (storage, key, fallback = []) => { try { return JSON.parse(storage.getItem(key) || "null") ?? fallback; } catch { return fallback; } };
const write = (storage, key, value) => storage.setItem(key, JSON.stringify(value));
const now = () => new Date().toISOString();
const number = (value) => Number(value) || 0;
const clean = (value = "") => String(value).trim();

export class VenueFinanceService {
  constructor({ venueRepository = getVenueActivityRepository(), storage = localStorage } = {}) {
    this.venue = venueRepository; this.storage = storage;
    if (!storage.getItem(MONTHLY_KEY)) write(storage, MONTHLY_KEY, this.seedMonthly());
    if (!storage.getItem(CHECKLIST_KEY)) write(storage, CHECKLIST_KEY, []);
  }
  listBilling(context = {}) { return this.venue.listActivitiesFor({ roles: context.roles, merchantIds: context.organizerIds }).filter((item) => item.enableRentalBilling); }
  billingState(activity) {
    const originalAmountDue = number(activity.originalAmountDue ?? activity.totalAmount);
    const finalAmountDue = number(activity.finalAmountDue ?? activity.totalAmount);
    return { ...activity, originalAmountDue, finalAmountDue, outstandingAmount: Math.max(0, finalAmountDue - number(activity.amountReceived)), retainedCredit: number(activity.retainedCredit), refundAmount: number(activity.refundAmount) };
  }
  saveBilling(activityId, input, context = {}) {
    const receives = input.amountReceived !== undefined;
    assertPermission(context, receives ? "venue-finance.receive" : "venue-finance.update");
    const current = this.venue.getActivity(activityId); if (!current) throw new Error("找不到場地活動。"); assertScope(context, current.organizerId);
    const originalAmountDue = number(current.originalAmountDue ?? current.totalAmount), adjustment = number(input.feeAdjustment ?? current.feeAdjustment);
    if (adjustment !== number(current.feeAdjustment) && !clean(input.adjustmentReason)) throw new Error("修改費用調整必須填寫差額原因。");
    const finalAmountDue = input.finalAmountDue === undefined ? originalAmountDue + adjustment : number(input.finalAmountDue);
    if (finalAmountDue !== number(current.finalAmountDue ?? current.totalAmount) && !clean(input.adjustmentReason)) throw new Error("修改最終應收必須填寫原因。");
    const received = number(input.amountReceived ?? current.amountReceived), taxAmount = input.invoiceRequired ? Math.round(finalAmountDue * number(input.taxRate ?? current.taxRate ?? TAX_RATE)) : 0;
    const paymentStatus = received <= 0 ? "unpaid" : received < finalAmountDue ? "partial" : "paid";
    const changes = { originalAmountDue, finalAmountDue, totalAmount: finalAmountDue, feeAdjustment: adjustment, adjustmentReason: clean(input.adjustmentReason || current.adjustmentReason), amountReceived: received, outstandingAmount: Math.max(0, finalAmountDue - received), paymentMethod: input.paymentMethod || current.paymentMethod, paymentReceivedAt: input.paymentReceivedAt || current.paymentReceivedAt, transferLastFive: clean(input.transferLastFive || current.transferLastFive), invoiceRequired: input.invoiceRequired === true || input.invoiceRequired === "true" || input.invoiceRequired === "on", taxRate: number(input.taxRate ?? current.taxRate ?? TAX_RATE), taxAmount, invoiceNumber: clean(input.invoiceNumber || current.invoiceNumber), invoiceDate: input.invoiceDate || current.invoiceDate, refundAmount: number(input.refundAmount ?? current.refundAmount), retainedCredit: number(input.retainedCredit ?? current.retainedCredit), paymentStatus, openPayment: input.openPayment === true || input.openPayment === "true" || input.openPayment === "on", paymentPublicNote: clean(input.paymentPublicNote || current.paymentPublicNote) };
    const saved = this.venue.saveBilling(activityId, changes, { actor: context.actor, can: () => true });
    this.venue.audit(receives ? "venue-payment.received" : "venue-billing.refined", activityId, context.actor, { originalAmountDue, finalAmountDue, amountReceived: received, outstandingAmount: changes.outstandingAmount, adjustmentReason: changes.adjustmentReason, invoiceNumber: changes.invoiceNumber ? "configured" : "" });
    return this.billingState(saved);
  }
  applyActivityChange(activityId, input, context = {}) {
    assertPermission(context, input.activityStatus === "cancelled" ? "venue-finance.cancel" : "venue-finance.postpone");
    const current = this.venue.getActivity(activityId); if (!current) throw new Error("找不到活動。"); assertScope(context, current.organizerId);
    if (!["no_refund", "refund_50", "full_refund", "free_postpone", "credit", "other"].includes(input.changeResolutionStatus)) throw new Error("請選擇延期或取消處理方式。");
    const paid = number(current.amountReceived), refund = input.changeResolutionStatus === "refund_50" ? paid * .5 : input.changeResolutionStatus === "full_refund" ? paid : number(input.refundAmount);
    const credit = input.changeResolutionStatus === "credit" ? paid - refund : number(input.retainedCredit);
    const next = this.venue.saveActivity({ ...current, activityStatus: input.activityStatus, originalStartDate: current.originalStartDate || current.startDate, originalEndDate: current.originalEndDate || current.endDate, newStartDate: input.newStartDate || current.newStartDate, newEndDate: input.newEndDate || current.newEndDate, startDate: input.activityStatus === "postponed" && input.newStartDate ? input.newStartDate : current.startDate, endDate: input.activityStatus === "postponed" && input.newEndDate ? input.newEndDate : current.endDate, changeResolutionStatus: input.changeResolutionStatus, refundAmount: refund, retainedCredit: credit, registrationResolution: input.registrationResolution || "keep", publicChangeNote: clean(input.publicChangeNote), changeInternalNotes: clean(input.internalNotes) }, { actor: context.actor, can: () => true });
    this.venue.audit(input.activityStatus === "cancelled" ? "activity.cancelled-refined" : "activity.postponed-refined", activityId, context.actor, { resolution: input.changeResolutionStatus, refundAmount: refund, retainedCredit: credit, registrationResolution: next.registrationResolution });
    return next;
  }
  listMonthly(context = {}) { return read(this.storage, MONTHLY_KEY, []).filter((item) => !Array.isArray(context.organizerIds) || context.organizerIds.includes(item.merchantId)); }
  generateMonthly(month, context = {}) {
    assertPermission(context, "venue-finance.monthly.view");
    const activities = this.venue.listActivities().filter((item) => item.activityType === "food_truck" && item.startDate.startsWith(month) && (!Array.isArray(context.organizerIds) || context.organizerIds.includes(item.organizerId)));
    const groups = new Map();
    activities.forEach((item) => {
      const record = groups.get(item.organizerId) || { merchantId: item.organizerId, merchantName: item.organizerName, month, confirmedDays: 0, cancelledDays: 0, billableDays: 0, baseFee: 0 };
      if (item.activityStatus === "confirmed") { record.confirmedDays++; record.billableDays++; record.baseFee += number(item.originalAmountDue ?? item.totalAmount); }
      if (item.activityStatus === "cancelled") { record.cancelledDays++; if (item.cancelledBillable) { record.billableDays++; record.baseFee += number(item.originalAmountDue ?? item.totalAmount); } }
      groups.set(item.organizerId, record);
    });
    return [...groups.values()].map((item) => this.monthlyState({ ...item, monthlyBillingId: `FTB-${item.merchantId}-${month}`, feeAdjustment: 0, invoiceRequired: false, amountReceived: 0, paymentDueDate: `${nextMonth(month)}-07`, notes: "" }));
  }
  saveMonthly(input, context = {}) {
    assertPermission(context, "venue-finance.monthly.update"); assertScope(context, input.merchantId);
    const records = this.listMonthly(), current = records.find((item) => item.monthlyBillingId === input.monthlyBillingId);
    if (number(input.feeAdjustment) !== number(current?.feeAdjustment) && !clean(input.adjustmentReason)) throw new Error("修改月度應收必須填寫原因。");
    const record = this.monthlyState({ ...current, ...input, monthlyBillingId: current?.monthlyBillingId || `FTB-${input.merchantId}-${input.month}`, updatedAt: now(), updatedBy: context.actor });
    write(this.storage, MONTHLY_KEY, current ? records.map((item) => item.monthlyBillingId === record.monthlyBillingId ? record : item) : [record, ...records]);
    this.venue.audit("food-truck-monthly-billing.updated", input.activityId || "", context.actor, { merchantId: record.merchantId, month: record.month, totalDue: record.totalDue, amountReceived: record.amountReceived, adjustmentReason: clean(input.adjustmentReason) });
    return record;
  }
  monthlyState(item) { const subtotal = number(item.baseFee) + number(item.feeAdjustment), taxAmount = item.invoiceRequired ? Math.round(subtotal * TAX_RATE) : 0, totalDue = inputNumber(item.finalAmountDue, subtotal + taxAmount), amountReceived = number(item.amountReceived); return { ...item, confirmedDays: number(item.confirmedDays), cancelledDays: number(item.cancelledDays), billableDays: number(item.billableDays), baseFee: number(item.baseFee), feeAdjustment: number(item.feeAdjustment), taxAmount, totalDue, amountReceived, paymentStatus: amountReceived <= 0 ? "unpaid" : amountReceived < totalDue ? "partial" : "paid" }; }
  checklist(activityId) {
    const activity = this.venue.getActivity(activityId); if (!activity) return null;
    const saved = read(this.storage, CHECKLIST_KEY, []).find((item) => item.activityId === activityId);
    const equipment = Object.fromEntries((activity.equipmentRequirements || []).map((item) => [item.name, { quantity: number(item.quantity) || 1, note: item.note || "" }]));
    return { checklistId: `CHK-${activityId}`, activityId, venue: venues.find((item) => item.id === activity.venueId)?.name, activity: activity.title, date: activity.startDate, time: `${activity.startTime}–${activity.endTime}`, expectedAttendance: number(activity.expectedAttendance), furnitureLayout: activity.furnitureLayout, equipment, camaOrderRequest: activity.camaOrderRequest, notes: activity.additionalRequests, status: saved?.status || "not_started", updatedAt: saved?.updatedAt };
  }
  saveChecklist(activityId, status, context = {}) {
    assertPermission(context, "field-checklists.update"); const activity = this.venue.getActivity(activityId); assertScope(context, activity?.organizerId);
    if (!["not_started", "preparing", "completed"].includes(status)) throw new Error("無效的準備狀態。");
    const records = read(this.storage, CHECKLIST_KEY, []), current = records.find((item) => item.activityId === activityId), record = { checklistId: current?.checklistId || `CHK-${activityId}`, activityId, status, updatedAt: now(), updatedBy: context.actor };
    write(this.storage, CHECKLIST_KEY, current ? records.map((item) => item.activityId === activityId ? record : item) : [record, ...records]);
    this.venue.audit("field-checklist.updated", activityId, context.actor, { status }); return this.checklist(activityId);
  }
  dashboard(context = {}) {
    const today = new Date().toISOString().slice(0, 10), month = today.slice(0, 7), activities = this.venue.listActivitiesFor({ roles: context.roles, merchantIds: context.organizerIds });
    const bills = this.listBilling(context).map((item) => this.billingState(item));
    return { todayActivities: activities.filter((item) => item.startDate === today), pendingPayments: bills.filter((item) => item.outstandingAmount > 0).length, overduePayments: bills.filter((item) => item.outstandingAmount > 0 && item.paymentDueDate && item.paymentDueDate < today).length, monthlyFoodTruckDue: this.listMonthly(context).filter((item) => item.month === month).reduce((sum, item) => sum + item.totalDue - item.amountReceived, 0), changedActivities: activities.filter((item) => ["postponed", "cancelled"].includes(item.activityStatus)), equipment: activities.filter((item) => item.startDate >= today).slice(0, 10).map((item) => this.checklist(item.activityId)) };
  }
  seedMonthly() { const activity = this.venue.listActivities().find((item) => item.activityType === "food_truck"); if (!activity) return []; const month = activity.startDate.slice(0, 7); return [this.monthlyState({ monthlyBillingId: "FTB-DEMO-001", merchantId: activity.organizerId, merchantName: activity.organizerName, month, confirmedDays: 4, cancelledDays: 1, billableDays: 4, baseFee: 4000, feeAdjustment: -500, adjustmentReason: "示範調整", invoiceRequired: true, amountReceived: 0, paymentDueDate: `${nextMonth(month)}-07`, notes: "Local Demo 月度應收" })]; }
}
function inputNumber(value, fallback) { return value === undefined || value === "" ? fallback : number(value); }
function nextMonth(month) { const date = new Date(`${month}-01T00:00:00`); date.setMonth(date.getMonth() + 1); return date.toISOString().slice(0, 7); }
function assertPermission(context, key) { if (!context?.can?.(key)) throw new Error("沒有執行此操作的權限。"); }
function assertScope(context, organizerId) { if (Array.isArray(context?.organizerIds) && !context.organizerIds.includes(organizerId)) throw new Error("沒有操作此主辦單位資料的權限。"); }
let service;
export function getVenueFinanceService() { service ||= new VenueFinanceService(); return service; }
