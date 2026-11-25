// Text-only templates; never accept internal notes or children's real identities.
export function christmasEmail(kind, data = {}) {
  const date = Number.isFinite(data.giftDueAt) ? new Date(data.giftDueAt * 1000).toLocaleDateString('sv-SE', {timeZone:'Asia/Taipei'}) : '請查看認領紀錄';
  const claim = data.claimId ? `認領編號：${data.claimId}\n心願編號：${data.wishCode || '請查看認領紀錄'}\n交件截止：${date}\n` : '';
  const messages = {
    verification: ['驗證您的聖誕心願 Email', `您的驗證碼：${data.code}\n有效期間2分鐘，最多嘗試5次。尚未完成認領；請回到原頁面輸入，不要將驗證碼交給他人。`],
    confirmation: ['聖誕心願認領已確認', '謝謝你準備這份心願。請自行購買符合條件的實體禮物，並於紀錄顯示的截止日期前交至合作據點。'],
    recovery: ['重設您的聖誕心願查詢密碼', '請開啟下方一次性安全驗證連結，核身後在查詢頁設定新密碼。連結10分鐘後失效；若非本人申請，請忽略本信。'],
    receipt: ['您的聖誕禮物已在據點收件', '工作人員已登記收到禮物，接下來將交接給孩子的書屋。這代表據點收件，尚不代表孩子已收到禮物。'],
    reminder: ['聖誕心願交件日期提醒', '這份心願的交件日期快到了。若禮物準備或交件遇到困難，請聯絡 NXSPACE；逾期會由授權人員確認處理，不會自動取消。'],
    cancellation: ['聖誕心願認領已取消', '授權人員已確認取消本次認領。謝謝你告知準備情況，請登入查看最新紀錄；如有疑問請聯絡 NXSPACE。'],
    delivery: ['您的聖誕禮物已交付孩子', '孩子的書屋已記錄禮物交付孩子。感謝卡與紙本證明依個別處理進度記錄，可登入查詢。'],
    exception: ['聖誕心願進度需要確認', '這份認領目前由工作人員確認處理中，請登入查看公開進度並聯絡 NXSPACE。內部處理備註不會透過本信公開。']
  };
  if (!messages[kind]) throw Error('UNKNOWN_EMAIL_KIND');
  const [subject, body] = messages[kind];
  const link = typeof data.managementRoute === 'string' && /^\/#christmas\/manage(?:\/verify\/[\w-]+)?$/.test(data.managementRoute) ? data.managementRoute : '/#christmas/manage';
  return {subject:`NXSPACE｜${subject}`, text:`馜享空間 NXSPACE｜聖誕心願\n\n${body}\n\n${claim}${['verification','recovery'].includes(kind)?'':'合作收件：米勒 AVEDA Salon SPA、大樹 AVEDA Salon、CAMA CAFE 台東鐵花村店。\nCAMA：台東市鐵花路254號。各據點聯絡方式與服務時間以活動頁公告為準。\n'}\n查詢／驗證入口：${link}\n平時請使用 Email 與自訂登入密碼查詢；忘記密碼請聯絡 NXSPACE，由工作人員核對身分後協助重設。\n實物捐贈證明不保證具稅務扣抵效力。\n如需協助，請由 NXSPACE 網站聯絡頁洽詢主辦單位。`};
}
