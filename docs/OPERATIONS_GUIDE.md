# Operations Guide

## Daily

- Review Dashboard KPIs, new orders/rentals and Audit events.
- Process status transitions and publish only validated content.
- Use public notes for customer-visible information; keep internal notes private.

## Backup and recovery

- Settings exports a privacy-safe operational backup and validates imports with Dry Run.
- Acceptance Center exports a complete Local Demo backup before reset; treat it as sensitive because it includes Local identity records.
- Restore only trusted JSON with the documented schema. Keep an active Super Admin and test login after recovery.

## Incident response

Stop writes, export available data, record time/symptoms, preserve Audit, switch integrations to Local fallback and notify the Production owner. Static Demo data can be cleared by the browser and has no remote recovery.

## Demo reset

Open `/admin/#acceptance`, preview the affected collections, export the full backup, then confirm. The flow refuses to proceed without an active Super Admin and preserves the current Super Admin and system roles.
# Beta V1.1 店家接單

登入後從「店家接單」處理被指派商店的訂單。狀態需依序接受、備餐、可取餐、完成。拒絕原因必填；取消、拒絕與所有狀態更新均保存狀態歷程及 Audit。Local Notification Log 不代表 LINE 發送成功。

Super Admin 可用角色預覽執行唯讀驗收。容量僅計入系統設定指定的有效狀態；拒絕、顧客取消及店家取消立即釋放時段容量。
