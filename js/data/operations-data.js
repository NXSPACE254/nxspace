export const orderStatuses = Object.freeze({
  pending: "待確認", confirmed: "已確認", preparing: "準備中", ready: "可取貨", completed: "已完成", cancelled: "已取消"
});
export const paymentStatuses = Object.freeze({ unpaid: "未付款", paid_on_site: "現場付款", refunded: "已退款", not_required: "不需付款" });
export const fulfillmentStatuses = Object.freeze({ pending: "待處理", ready: "可取貨", picked_up: "已取貨", no_show: "未取貨" });
export const rentalAdminStatuses = Object.freeze({ submitted: "待處理", reviewing: "審核中", needs_information: "待補資料", approved: "已核准", rejected: "已拒絕", cancelled: "已取消", completed: "已完成" });
export const availabilityTypes = Object.freeze({ open: "可租借", blocked: "封鎖", maintenance: "維護", event: "內部活動" });
