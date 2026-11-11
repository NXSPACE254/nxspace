import { createPageHeader } from "./catalog-page.js";

export function createAboutPage() {
  return `
    <article class="public-page">
      ${createPageHeader({
        eyebrow: "ABOUT",
        title: "關於 NXSPACE",
        description: "一個連結地方品牌、活動與城市生活的共享場域。"
      })}
      <div class="page-container editorial-grid">
        <section class="prose-card">
          <h2>讓相遇自然發生</h2>
          <p>NXSPACE 從台東出發，整理正在發生的活動、值得認識的品牌，以及能承接不同想法的空間。</p>
          <p>我們相信好的平台不是堆滿資訊，而是讓人更快理解、選擇並採取下一步。</p>
        </section>
        <section class="prose-card">
          <h2>我們關注的事</h2>
          <ul class="feature-list">
            <li>地方品牌與長期合作</li>
            <li>清楚、友善的活動資訊</li>
            <li>具彈性的場地與共創可能</li>
            <li>從線上探索走向真實體驗</li>
          </ul>
          <a class="text-link" href="#contact" data-route-link>與 NXSPACE 聯絡 →</a>
        </section>
      </div>
    </article>
  `.trim();
}

export function createPolicyPage({ type = "privacy" } = {}) {
  const isPrivacy = type === "privacy";

  return `
    <article class="public-page">
      ${createPageHeader({
        eyebrow: "LEGAL",
        title: isPrivacy ? "隱私權說明" : "使用條款",
        description: "Beta V1 公開網站基礎說明。"
      })}
      <div class="page-container prose-card legal-content">
        ${isPrivacy ? `
          <h2>資料使用原則</h2>
          <p>租借與聯絡表單資料僅用於回覆詢問、確認檔期、提供申請查詢與後續聯絡。Beta V1 不收集帳號密碼、付款資料或政府證件。</p>
          <h2>本機保存</h2>
          <p>目前表單使用瀏覽器 LocalStorage 的 Local Mock Repository，資料只保存在送出時使用的瀏覽器。清除網站資料後將無法在該裝置查詢。</p>
          <h2>公開查詢與遮罩</h2>
          <p>公開查詢須使用申請編號搭配完整 Email 或電話末四碼，結果只顯示遮罩後姓名、電話與 Email。</p>
          <h2>正式上線前</h2>
          <p>Production 必須改用具備身分驗證、授權、傳輸加密與保存政策的後端 Adapter；不得將 Secret 或可寫入憑證放入公開前端。</p>
        ` : `
          <h2>網站使用原則</h2>
          <p>網站內容供 NXSPACE Beta V1 資訊探索與本機流程展示使用；活動、商品、價格與場地資訊以最終聯絡確認為準。</p>
          <h2>租借詢問</h2>
          <p>送出表單與取得申請編號不代表正式預訂完成。NXSPACE 仍需確認檔期、活動內容、設備、費用與使用規則。</p>
          <h2>使用者責任</h2>
          <p>請提供正確聯絡與活動資訊，不得利用表單提交違法、侵害他人或與服務無關的內容。</p>
        `}
        <p>如需更正或詢問資料用途，請透過聯絡頁與 NXSPACE 聯繫。</p>
        <a class="btn btn-secondary" href="#contact" data-route-link>前往聯絡頁</a>
      </div>
    </article>
  `.trim();
}
