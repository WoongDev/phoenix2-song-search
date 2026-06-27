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

const STEP_PREFIX = {
  single: "S",
  double: "D",
};

const LEVEL_NUMBERS = Array.from({ length: 28 }, (_, index) => index + 1);
const BONUS_LEVEL = "??";
const COOP_VALUES = [2, 3, 4, 5];

let songs = [];
let selectedType = "single";
let selectedLevel = "S1";

const $stepButtons = Array.from(document.querySelectorAll(".step-type-button"));
const $levelButtons = document.querySelector("#levelButtons");
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
  return String(value ?? "").trim().toUpperCase();
}

function isInvalidLevelValue(value) {
  const normalized = normalizeLevelValue(value);
  return normalized === "S0" || normalized === "D0" || normalized === "0";
}

function isInvalidCoopValue(value) {
  return Number(value) === 8 || Number(value) <= 0;
}

function displaySelectedLabel(type, value) {
  if (type === "coop") return `${value}인`;
  return String(value);
}

function buildLevelValue(type, numberOrBonus) {
  if (type === "coop") return String(numberOrBonus);
  return `${STEP_PREFIX[type]}${numberOrBonus}`;
}

function defaultLevelForType(type) {
  if (type === "single") return "S1";
  if (type === "double") return "D1";
  return "2";
}

function renderStepButtons() {
  $stepButtons.forEach((button) => {
    const active = button.dataset.type === selectedType;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function renderLevelButtons() {
  const items = selectedType === "coop" ? COOP_VALUES : [...LEVEL_NUMBERS, BONUS_LEVEL];

  $levelButtons.classList.toggle("coop-mode", selectedType === "coop");
  $levelButtons.innerHTML = items.map((item) => {
    const value = buildLevelValue(selectedType, item);
    const label = selectedType === "coop" ? `${item}인` : String(item);
    const active = normalizeLevelValue(value) === normalizeLevelValue(selectedLevel);
    return `
      <button class="level-select-button${active ? " active" : ""}" type="button" data-level="${escapeHtml(value)}" aria-pressed="${active}">
        ${escapeHtml(label)}
      </button>
    `;
  }).join("");
}

function levelChips(values, selectedValue = null) {
  const validValues = (values || []).filter((value) => !isInvalidLevelValue(value));
  if (!validValues.length) {
    return '<span class="level-chip empty-chip">-</span>';
  }
  return validValues.map((v) => {
    const selected = selectedValue !== null && normalizeLevelValue(v) === normalizeLevelValue(selectedValue);
    const cls = selected ? "level-chip selected" : "level-chip";
    return `<span class="${cls}">${escapeHtml(v)}</span>`;
  }).join("");
}

function coopChips(values, selectedValue = null) {
  const validValues = (values || []).filter((value) => !isInvalidCoopValue(value));
  if (!validValues.length) {
    return '<span class="level-chip empty-chip">-</span>';
  }
  return validValues.map((v) => {
    const selected = selectedValue !== null && normalizeLevelValue(v) === normalizeLevelValue(selectedValue);
    const cls = selected ? "level-chip selected" : "level-chip";
    return `<span class="${cls}">${escapeHtml(v)}인</span>`;
  }).join("");
}

function cardTemplate(song) {
  const channelName = CHANNEL_NAMES[song.channel] ?? "Unknown";
  const koTitle = song.titleKo || song.titleEn || "제목 없음";
  const enTitle = song.titleEn && song.titleEn !== koTitle ? song.titleEn : "";

  return `
    <article class="level-card">
      <div class="level-card-top">
        <span class="channel mini-channel">${channelCode(song.channel)} ${escapeHtml(channelName)}</span>
        <span class="mini-seq">순번 ${escapeHtml(sequenceNumber(song.id))}</span>
      </div>

      <div class="level-card-title-block">
        <h2 class="mini-title-ko">${escapeHtml(koTitle)}</h2>
        ${enTitle ? `<p class="mini-title-en">${escapeHtml(enTitle)}</p>` : ""}
      </div>

      <div class="mini-info">
        <span>Artist: ${escapeHtml(song.artist || "-")}</span>
        <span>BPM: ${escapeHtml(song.bpm || "-")}</span>
      </div>
    </article>
  `;
}

function matchesSelectedLevel(song, type, level) {
  return valuesForType(song, type).some((value) => {
    if (type === "coop" && isInvalidCoopValue(value)) return false;
    if (type !== "coop" && isInvalidLevelValue(value)) return false;
    return normalizeLevelValue(value) === normalizeLevelValue(level);
  });
}

function render() {
  renderStepButtons();
  renderLevelButtons();

  const result = songs
    .filter((song) => matchesSelectedLevel(song, selectedType, selectedLevel))
    .sort((a, b) =>
      titleForSort(a).localeCompare(titleForSort(b), "ko-KR", { sensitivity: "base" }) ||
      a.channel - b.channel ||
      String(a.id).localeCompare(String(b.id))
    );

  const label = `${STEP_LABELS[selectedType]} ${displaySelectedLabel(selectedType, selectedLevel)}`;
  $count.textContent = `${label} · ${result.length.toLocaleString("ko-KR")}개 결과`;

  if (!result.length) {
    $results.innerHTML = '<div class="empty">해당 조건의 곡이 없습니다.</div>';
    return;
  }

  $results.innerHTML = result.map((song) => cardTemplate(song, selectedType, selectedLevel)).join("");
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

$stepButtons.forEach((button) => {
  button.addEventListener("click", () => {
    selectedType = button.dataset.type;
    selectedLevel = defaultLevelForType(selectedType);
    render();
  });
});

$levelButtons.addEventListener("click", (event) => {
  const button = event.target.closest(".level-select-button");
  if (!button) return;
  selectedLevel = button.dataset.level;
  render();
});

init();
