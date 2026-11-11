export function validateOrder(values = {}) {
  const errors = {};
  if (!values.items?.length) errors.items = "請至少加入一項商品。";
  if (!String(values.customerName || "").trim()) errors.customerName = "請填寫取貨人姓名。";
  if (!/^09\d{8}$/.test(String(values.phone || "").replace(/[\s-]/g, ""))) errors.phone = "請輸入有效的台灣手機號碼。";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(values.email || ""))) errors.email = "請輸入有效的 Email。";
  if (!values.pickupDate) errors.pickupDate = "請選擇取貨日期。";
  else if (values.pickupDate < new Date().toISOString().slice(0, 10)) errors.pickupDate = "取貨日期不可早於今天。";
  if (!values.pickupTime) errors.pickupTime = "請選擇取貨時段。";
  if (!values.agreePrivacy) errors.agreePrivacy = "請同意隱私權說明。";
  if (!values.agreeTerms) errors.agreeTerms = "請同意使用條款。";
  return errors;
}
