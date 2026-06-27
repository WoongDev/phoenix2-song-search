const DATA_URL = "./phoenix2_songs.json";

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
const $stepType = document.querySelector("#stepType");
const $level = document.querySelector("#levelSelect");
const $count = document.querySelector("#countText");
const $results = document.querySelector("#results");

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

function numericPart(value) {
  const match = String(value ?? "").match(/\d+/);
  return match ? Number(match[0]) : Number.MAX_SAFE_INTEGER;
}

function titleForSort(song) {
  return String(song.titleKo || song.titleEn || "");
}

function valuesForType(song, type) {
  if (type === "single") return song.single || [];
  if (type === "double") return song.double || [];
  if (type === "coop") return song.coop || [];
  return [];
}

function normalizeLevelValue(value) {
  return String(value ?? "").trim();
}

function displayLevelValue(type, value) {
  if (type === "coop") return `${value}인`;
  return String(value);
}

function buildLevelOptions() {
  const type = $stepType.value;
  const levels = new Set();

  for (const song of songs) {
    for (const value of valuesForType(song, type)) {
      levels.add(normalizeLevelValue(value));
    }
  }

  const sorted = Array.from(levels).sort((a, b) => numericPart(a) - numericPart(b) || String(a).localeCompare(String(b), "ko-KR"));
  const typeHint = type === "coop" ? "인원수 선택" : "레벨 선택";

  $level.innerHTML = `<option value="">${typeHint}</option>` + sorted
    .map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(displayLevelValue(type, value))}</option>`)
    .join("");
}

function levelChips(values, selectedValue = null) {
  if (!values || values.length === 0) {
    return '<span class="level-chip empty-chip">-</span>';
  }
  return values.map((v) => {
    const selected = selectedValue !== null && normalizeLevelValue(v) === normalizeLevelValue(selectedValue);
    const cls = selected ? "level-chip selected" : "level-chip";
    return `<span class="${cls}">${escapeHtml(v)}</span>`;
  }).join("");
}

function coopChips(values, selectedValue = null) {
  if (!values || values.length === 0) {
    return '<span class="level-chip empty-chip">-</span>';
  }
  return values.map((v) => {
    const selected = selectedValue !== null && normalizeLevelValue(v) === normalizeLevelValue(selectedValue);
    const cls = selected ? "level-chip selected" : "level-chip";
    return `<span class="${cls}">${escapeHtml(v)}인</span>`;
  }).join("");
}

function cardTemplate(song, selectedType, selectedLevel) {
  const channelName = CHANNEL_NAMES[song.channel] ?? "Unknown";
  const singleSelected = selectedType === "single" ? selectedLevel : null;
  const doubleSelected = selectedType === "double" ? selectedLevel : null;
  const coopSelected = selectedType === "coop" ? selectedLevel : null;

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
        <div class="level-list">${levelChips(song.single, singleSelected)}</div>
      </div>
      <div class="level-block">
        <div class="level-label">Double</div>
        <div class="level-list">${levelChips(song.double, doubleSelected)}</div>
      </div>
      <div class="level-block">
        <div class="level-label">Co-op</div>
        <div class="level-list">${coopChips(song.coop, coopSelected)}</div>
      </div>
    </article>
  `;
}

function matchesSelectedLevel(song, type, level) {
  return valuesForType(song, type).some((value) => normalizeLevelValue(value) === normalizeLevelValue(level));
}

function render() {
  const type = $stepType.value;
  const level = $level.value;

  if (!level) {
    $count.textContent = `총 ${songs.length.toLocaleString("ko-KR")}곡`;
    $results.innerHTML = '<div class="empty">스텝 타입과 레벨을 선택하면 결과가 표시됩니다. 예: 싱글 S17, 더블 D22, 코옵 2인</div>';
    return;
  }

  const result = songs
    .filter((song) => matchesSelectedLevel(song, type, level))
    .sort((a, b) =>
      titleForSort(a).localeCompare(titleForSort(b), "ko-KR", { sensitivity: "base" }) ||
      a.channel - b.channel ||
      String(a.id).localeCompare(String(b.id))
    );

  const label = `${STEP_LABELS[type]} ${displayLevelValue(type, level)}`;
  $count.textContent = `${label} · ${result.length.toLocaleString("ko-KR")}개 결과`;

  if (!result.length) {
    $results.innerHTML = '<div class="empty">해당 조건의 곡이 없습니다.</div>';
    return;
  }

  $results.innerHTML = result.map((song) => cardTemplate(song, type, level)).join("");
}

async function init() {
  try {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    songs = await response.json();
    buildLevelOptions();
    render();
  } catch (error) {
    console.error(error);
    $count.textContent = "데이터 로드 실패";
    $results.innerHTML = '<div class="error">phoenix2_songs.json 파일을 불러오지 못했습니다. GitHub Pages로 접속했는지, 파일명이 정확한지 확인해주세요.</div>';
  }
}

$stepType.addEventListener("change", () => {
  buildLevelOptions();
  render();
});

$level.addEventListener("change", render);

init();
