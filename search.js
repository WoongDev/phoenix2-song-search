const DATA_URL = "./phoenix2_songs.json";
const MAX_RESULTS = 60;

const CHANNEL_NAMES = {
  1: "K-Pop",
  2: "Original",
  3: "World Music",
  4: "Cross Channel",
  5: "숏컷",
  6: "리믹스",
  7: "풀송",
};

let songs = [];
const $input = document.querySelector("#searchInput");
const $clear = document.querySelector("#clearButton");
const $count = document.querySelector("#countText");
const $results = document.querySelector("#results");

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[’'`]/g, "")
    .replace(/[\s\.\-_:;!?,()[\]{}<>/\\|+*=~"“”·・]/g, "")
    .trim();
}

function compactRaw(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .trim();
}

function channelCode(channel) {
  return String(channel).padStart(2, "0");
}

function sequenceNumber(id) {
  const digits = String(id ?? "").replace(/\D/g, "");
  return digits || "-";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const curr = Array(b.length + 1).fill(0);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + cost
      );
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

function similarity(a, b) {
  const maxLen = Math.max(a.length, b.length);
  if (!maxLen) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

function scoreSong(song, query) {
  const qNorm = normalizeText(query);
  const qRaw = compactRaw(query);

  if (!qNorm) return 0;

  const candidates = [song.titleKo, song.titleEn]
    .filter(Boolean)
    .map((value) => ({ raw: compactRaw(value), norm: normalizeText(value) }));

  let best = 0;

  for (const c of candidates) {
    if (!c.norm) continue;

    if (c.norm === qNorm || c.raw === qRaw) best = Math.max(best, 100);
    else if (c.norm.startsWith(qNorm)) best = Math.max(best, 92);
    else if (c.norm.includes(qNorm)) best = Math.max(best, 84);
    else if (qNorm.includes(c.norm)) best = Math.max(best, 78);
    else {
      const sim = similarity(qNorm, c.norm);
      const threshold = qNorm.length <= 2 ? 0.82 : qNorm.length <= 4 ? 0.62 : 0.48;
      if (sim >= threshold) best = Math.max(best, Math.round(sim * 70));
    }
  }

  return best;
}

function levelChips(values) {
  if (!values || values.length === 0) {
    return '<span class="level-chip empty-chip">-</span>';
  }
  return values.map((v) => `<span class="level-chip">${escapeHtml(v)}</span>`).join("");
}

function coopChips(values) {
  if (!values || values.length === 0) {
    return '<span class="level-chip empty-chip">-</span>';
  }
  return values.map((v) => `<span class="level-chip">${escapeHtml(v)}인</span>`).join("");
}

function cardTemplate(song) {
  const channelName = CHANNEL_NAMES[song.channel] ?? "Unknown";
  return `
    <article class="card">
      <div class="card-head">
        <div>
          <h2 class="title-ko">${escapeHtml(song.titleKo || song.titleEn || "제목 없음")}</h2>
          ${song.titleEn ? `<p class="title-en">${escapeHtml(song.titleEn)}</p>` : ""}
        </div>
        <div class="channel">${channelCode(song.channel)} ${escapeHtml(channelName)}</div>
      </div>

      <div class="info">
        <span>Artist: ${escapeHtml(song.artist || "-")}</span>
        <span>BPM: ${escapeHtml(song.bpm || "-")}</span>
        <span>순번: ${escapeHtml(sequenceNumber(song.id))}</span>
      </div>

      <div class="level-block">
        <div class="level-label">Single</div>
        <div class="level-list">${levelChips(song.single)}</div>
      </div>
      <div class="level-block">
        <div class="level-label">Double</div>
        <div class="level-list">${levelChips(song.double)}</div>
      </div>
      <div class="level-block">
        <div class="level-label">Co-op</div>
        <div class="level-list">${coopChips(song.coop)}</div>
      </div>
    </article>
  `;
}

function render() {
  const query = $input.value;
  const base = songs;

  if (!normalizeText(query)) {
    $count.textContent = `총 ${songs.length.toLocaleString("ko-KR")}곡`;
    $results.innerHTML = '<div class="empty">검색어를 입력하면 결과가 표시됩니다. 예: 고민중독, T.B.H, tbh</div>';
    return;
  }

  const deduped = new Map();
  for (const song of base) {
    const score = scoreSong(song, query);
    if (score <= 0) continue;

    const prev = deduped.get(song.id);
    if (!prev || score > prev.score) deduped.set(song.id, { song, score });
  }

  const result = Array.from(deduped.values())
    .sort((a, b) => b.score - a.score || a.song.channel - b.song.channel || a.song.id.localeCompare(b.song.id))
    .slice(0, MAX_RESULTS)
    .map((item) => item.song);

  $count.textContent = `${result.length.toLocaleString("ko-KR")}개 결과`;

  if (!result.length) {
    $results.innerHTML = '<div class="empty">검색 결과가 없습니다. 띄어쓰기나 일부 기호를 빼고 다시 입력해보세요.</div>';
    return;
  }

  $results.innerHTML = result.map(cardTemplate).join("");
}

async function init() {
  try {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    songs = await response.json();
    render();
  } catch (error) {
    console.error(error);
    $count.textContent = "데이터 로드 실패";
    $results.innerHTML = '<div class="error">phoenix2_songs.json 파일을 불러오지 못했습니다. GitHub Pages로 접속했는지, 파일명이 정확한지 확인해주세요.</div>';
  }
}

$input.addEventListener("input", render);
$clear.addEventListener("click", () => {
  $input.value = "";
  $input.focus();
  render();
});

init();
