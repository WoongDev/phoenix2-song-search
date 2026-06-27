const NOTICE_URL = "notices.json";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeNoticeDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function formatNoticeDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return escapeHtml(value);
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function getNoticeBodyHtml(notice) {
  const body = notice.body ?? notice.content ?? "";
  if (Array.isArray(body)) {
    return `<ul class="notice-body-list">${body.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>`;
  }
  return `<p class="notice-body">${escapeHtml(body)}</p>`;
}

function pickLatestNotice(notices) {
  return notices
    .filter((notice) => notice && notice.visible !== false)
    .sort((a, b) => {
      const dateDiff = normalizeNoticeDate(b.date) - normalizeNoticeDate(a.date);
      if (dateDiff) return dateDiff;
      return String(b.id ?? "").localeCompare(String(a.id ?? ""));
    })[0];
}

async function loadLatestNotice() {
  const panel = document.querySelector("[data-notice-panel]");
  if (!panel) return;

  try {
    const response = await fetch(`${NOTICE_URL}?v=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const notices = await response.json();
    const latest = pickLatestNotice(Array.isArray(notices) ? notices : []);

    if (!latest) {
      panel.hidden = true;
      return;
    }

    panel.hidden = false;
    panel.innerHTML = `
      <div class="notice-head">
        <span class="notice-label">공지사항</span>
        ${latest.date ? `<time class="notice-date" datetime="${escapeHtml(latest.date)}">${formatNoticeDate(latest.date)}</time>` : ""}
      </div>
      <strong class="notice-main-title">${escapeHtml(latest.title ?? "공지")}</strong>
      ${getNoticeBodyHtml(latest)}
    `;
  } catch (error) {
    console.warn("공지사항을 불러오지 못했습니다.", error);
    panel.hidden = true;
  }
}

loadLatestNotice();
