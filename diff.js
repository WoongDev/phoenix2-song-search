const SONGS_URL = "./phoenix2_songs.json";
const DIFF_URL = "./phoenix2_diff.json";

const CHANNEL_NAMES = {
  1: "K-Pop",
  2: "Original",
  3: "World Music",
  4: "Cross Channel",
  5: "숏컷",
  6: "리믹스",
  7: "풀송",
};

const STEP_LABELS = {
  single: "Single",
  double: "Double",
  coop: "Co-op",
};

let songs = [];
let songMap = new Map();
let diffData = { removedSongs: [], levelChangedSongs: [] };
let currentMode = "removed";
let currentChannel = "all";

const $buttons = Array.from(document.querySelectorAll(".diff-mode-button"));
const $channelFilter = document.querySelector("#channelFilter");
const $count = document.querySelector("#countText");
const $results = document.querySelector("#results");

const koCollator = new Intl.Collator("ko-KR", {
  sensitivity: "base",
  numeric: true,
});

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function channelCode(channel) {
  return String(channel).padStart(2, "0");
}

function sequenceNumber(id) {
  const digits = String(id ?? "").replace(/\D/g, "");
  return digits || "-";
}

function titleForSort(song) {
  return String(song?.titleKo || song?.titleEn || "");
}

function compareSongTitle(a, b) {
  const titleCompare = koCollator.compare(titleForSort(a), titleForSort(b));
  if (titleCompare !== 0) return titleCompare;

  const enCompare = koCollator.compare(String(a?.titleEn || ""), String(b?.titleEn || ""));
  if (enCompare !== 0) return enCompare;

  const artistCompare = koCollator.compare(String(a?.artist || ""), String(b?.artist || ""));
  if (artistCompare !== 0) return artistCompare;

  return koCollator.compare(String(a?.id || ""), String(b?.id || ""));
}

function normalizeForCompare(value, type) {
  if (type === "coop") return String(value ?? "").replace(/[^0-9?]/g, "");
  return String(value ?? "").trim().toUpperCase();
}

function levelSortKey(value, type) {
  if (type === "coop") {
    const n = Number(normalizeForCompare(value, type));
    return Number.isFinite(n) ? n : 999;
  }

  const normalized = normalizeForCompare(value, type);
  if (normalized.includes("??")) return 999;
  const n = Number(normalized.replace(/^[SD]/, ""));
  return Number.isFinite(n) ? n : 998;
}

function sortLevels(values, type) {
  return [...values].sort((a, b) => {
    const ak = levelSortKey(a, type);
    const bk = levelSortKey(b, type);
    if (ak !== bk) return ak - bk;
    return String(a).localeCompare(String(b));
  });
}

function displayLevel(value, type) {
  if (type === "coop") return `${escapeHtml(normalizeForCompare(value, type))}인`;
  return escapeHtml(value);
}

function getSongLevels(song, type) {
  if (!song) return [];
  if (type === "single") return song.single || [];
  if (type === "double") return song.double || [];
  if (type === "coop") return song.coop || [];
  return [];
}

function plainLevelChips(values, type) {
  const sorted = sortLevels(values || [], type);
  if (!sorted.length) return '<span class="level-chip empty-chip">-</span>';
  return sorted.map((value) => `<span class="level-chip">${displayLevel(value, type)}</span>`).join("");
}

function diffLevelChips(song, change, type) {
  const currentValues = getSongLevels(song, type);
  const stepChange = change?.changes?.[type] || {};
  const removed = stepChange.removed || [];
  const added = stepChange.added || [];

  const removedSet = new Set(removed.map((value) => normalizeForCompare(value, type)));
  const addedSet = new Set(added.map((value) => normalizeForCompare(value, type)));
  const unionMap = new Map();

  [...currentValues, ...removed].forEach((value) => {
    const key = normalizeForCompare(value, type);
    if (!key) return;
    if (!unionMap.has(key)) unionMap.set(key, value);
  });

  const sortedValues = sortLevels(Array.from(unionMap.values()), type);
  if (!sortedValues.length) return '<span class="level-chip empty-chip">-</span>';

  return sortedValues.map((value) => {
    const key = normalizeForCompare(value, type);
    let cls = "level-chip";
    let label = "";

    if (removedSet.has(key)) {
      cls += " level-removed";
      label = '<span class="chip-change-label">삭제</span>';
    } else if (addedSet.has(key)) {
      cls += " level-added";
      label = '<span class="chip-change-label">추가</span>';
    }

    return `<span class="${cls}">${displayLevel(value, type)}${label}</span>`;
  }).join("");
}

function renderLevelBlock(label, chipsHtml) {
  return `
    <div class="level-block">
      <div class="level-label">${escapeHtml(label)}</div>
      <div class="level-list">${chipsHtml}</div>
    </div>
  `;
}

function removedCardTemplate(song) {
  return `
    <article class="card diff-card removed-song-card">
      <div class="card-head">
        <div>
          <h2 class="title-ko">${escapeHtml(song.titleKo || song.titleEn || "제목 없음")}</h2>
          ${song.titleEn ? `<p class="title-en">${escapeHtml(song.titleEn)}</p>` : ""}
        </div>
        <div class="channel removed-channel">삭제곡</div>
      </div>

      <div class="info">
        <span>Artist: ${escapeHtml(song.artist || "-")}</span>
        <span>BPM: ${escapeHtml(song.bpm || "-")}</span>
      </div>

      ${renderLevelBlock("Single", plainLevelChips(song.single, "single"))}
      ${renderLevelBlock("Double", plainLevelChips(song.double, "double"))}
      ${renderLevelBlock("Co-op", plainLevelChips(song.coop, "coop"))}
    </article>
  `;
}

function changedCardTemplate(change) {
  const song = songMap.get(change.id);

  if (!song) {
    return `
      <article class="card diff-card missing-song-card">
        <div class="card-head">
          <div>
            <h2 class="title-ko">${escapeHtml(change.id)}</h2>
            <p class="title-en">phoenix2_songs.json에서 해당 ID를 찾지 못했습니다.</p>
          </div>
          <div class="channel">확인 필요</div>
        </div>
      </article>
    `;
  }

  const channelName = CHANNEL_NAMES[song.channel] ?? "Unknown";
  return `
    <article class="card diff-card changed-song-card">
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

      ${renderLevelBlock("Single", diffLevelChips(song, change, "single"))}
      ${renderLevelBlock("Double", diffLevelChips(song, change, "double"))}
      ${renderLevelBlock("Co-op", diffLevelChips(song, change, "coop"))}
    </article>
  `;
}

function getChangedItems() {
  return (diffData.levelChangedSongs || [])
    .map((change) => ({ change, song: songMap.get(change.id) }))
    .filter((item) => item.song);
}

function getChangedCountByChannel() {
  const counts = new Map();
  getChangedItems().forEach(({ song }) => {
    counts.set(song.channel, (counts.get(song.channel) || 0) + 1);
  });
  return counts;
}

function renderChannelFilter() {
  if (!$channelFilter) return;

  if (currentMode !== "changed") {
    currentChannel = "all";
    $channelFilter.innerHTML = `
      <button class="diff-channel-button active" type="button" data-channel="all" aria-pressed="true">전체</button>
      <span class="diff-channel-note">삭제곡은 PHOENIX 2 기준 채널 정보가 없어 전체 목록으로 표시합니다.</span>
    `;
    $channelFilter.querySelector("button")?.addEventListener("click", () => {
      currentChannel = "all";
      render();
    });
    return;
  }

  const counts = getChangedCountByChannel();
  const total = Array.from(counts.values()).reduce((sum, count) => sum + count, 0);

  const buttons = [
    { channel: "all", label: "전체", count: total },
    ...Object.entries(CHANNEL_NAMES)
      .map(([channel, name]) => ({
        channel,
        label: `${channelCode(channel)} ${name}`,
        count: counts.get(Number(channel)) || 0,
      }))
      .filter((item) => item.count > 0),
  ];

  $channelFilter.innerHTML = buttons.map((item) => {
    const active = String(currentChannel) === String(item.channel);
    return `
      <button
        class="diff-channel-button ${active ? "active" : ""}"
        type="button"
        data-channel="${escapeHtml(item.channel)}"
        aria-pressed="${active ? "true" : "false"}"
      >
        <span>${escapeHtml(item.label)}</span>
        <span class="diff-channel-count">${item.count.toLocaleString("ko-KR")}</span>
      </button>
    `;
  }).join("");

  Array.from($channelFilter.querySelectorAll(".diff-channel-button")).forEach((button) => {
    button.addEventListener("click", () => {
      currentChannel = button.dataset.channel || "all";
      render();
    });
  });
}

function setMode(mode) {
  currentMode = mode;
  currentChannel = "all";

  $buttons.forEach((button) => {
    const active = button.dataset.mode === currentMode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  render();
}

function renderRemovedSongs() {
  renderChannelFilter();

  const items = [...(diffData.removedSongs || [])].sort(compareSongTitle);

  $count.textContent = `삭제곡 · ${items.length.toLocaleString("ko-KR")}개`;
  if (!items.length) {
    $results.innerHTML = '<div class="empty">표시할 삭제곡이 없습니다.</div>';
    return;
  }

  $results.innerHTML = items.map(removedCardTemplate).join("");
}

function renderChangedSongs() {
  renderChannelFilter();

  let items = [...(diffData.levelChangedSongs || [])];

  if (currentChannel !== "all") {
    const selectedChannel = Number(currentChannel);
    items = items.filter((change) => songMap.get(change.id)?.channel === selectedChannel);
  }

  items.sort((a, b) => {
    const songA = songMap.get(a.id);
    const songB = songMap.get(b.id);

    if (songA && songB) {
      const titleCompare = compareSongTitle(songA, songB);
      if (titleCompare !== 0) return titleCompare;

      return (songA.channel - songB.channel) ||
        koCollator.compare(sequenceNumber(songA.id), sequenceNumber(songB.id));
    }

    return String(a.id).localeCompare(String(b.id));
  });

  const channelText = currentChannel === "all"
    ? "전체"
    : `${channelCode(currentChannel)} ${CHANNEL_NAMES[Number(currentChannel)] || "Unknown"}`;

  $count.textContent = `변경곡 · ${channelText} · ${items.length.toLocaleString("ko-KR")}개`;
  if (!items.length) {
    $results.innerHTML = '<div class="empty">표시할 변경곡이 없습니다.</div>';
    return;
  }

  $results.innerHTML = items.map(changedCardTemplate).join("");
}

function render() {
  if (currentMode === "changed") renderChangedSongs();
  else renderRemovedSongs();
}

async function init() {
  try {
    const [songsResponse, diffResponse] = await Promise.all([
      fetch(SONGS_URL, { cache: "no-store" }),
      fetch(DIFF_URL, { cache: "no-store" }),
    ]);

    if (!songsResponse.ok) throw new Error(`phoenix2_songs.json HTTP ${songsResponse.status}`);
    if (!diffResponse.ok) throw new Error(`phoenix2_diff.json HTTP ${diffResponse.status}`);

    songs = await songsResponse.json();
    diffData = await diffResponse.json();
    songMap = new Map(songs.map((song) => [song.id, song]));

    render();
  } catch (error) {
    console.error(error);
    $count.textContent = "데이터 로드 실패";
    $results.innerHTML = '<div class="error">phoenix2_songs.json 또는 phoenix2_diff.json 파일을 불러오지 못했습니다. 파일명이 정확한지, GitHub Pages 배포가 완료되었는지 확인해주세요.</div>';
  }
}

$buttons.forEach((button) => {
  button.addEventListener("click", () => setMode(button.dataset.mode));
});

init();
