const EXCLUDED_SERIES = new Set([
  "NASCAR ROAD COURSE SERIES",
  "BIKERNIEKI CUP",
  "FORMULA STUDENT SERIES",
  "VOLGA HISTORIC SERIES",
  "VETTE SERIES",
  "TWS PRE-SEASON TESTING",
  "LLL DAILY GT3 SERIES",
  "TWS PRE-SEASON TESTING SPRINT",
  "TWS OPEN",
  "LLL COMMUNITY RACE",
  "TATUUS WORLD SERIES SEASON 3 SPRINT",
  "GT WORLD TOUR",
  "TATUUS WORLD SERIES SEASON 4 SPRINT",
  "TATUUS WORLD SERIES SEASON 4 PRE-QUALIFYING",
  "FREC CHALLENGE"
]);

const ITEMS_PER_ARCHIVE_PAGE = 9;
let filteredStandingsEvents = [];
let currentArchivePage = 1;

function normalizeSeriesTitle(name) {
  return String(name || "").toUpperCase().replace(/\s+/g, " ").trim();
}

function escapeHTML(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderFlagMarkup(driver) {
  const cc = String(driver.countryCode || "").toLowerCase().trim();
  if (/^[a-z]{2}$/.test(cc)) {
    return `<img class="driver-flag-img" src="https://flagcdn.com/w40/${cc}.png" alt="${cc.toUpperCase()}" loading="lazy" onerror="this.style.display='none'">`;
  }
  return driver.flag ? `<span class="driver-flag-emoji">${escapeHTML(driver.flag)}</span>` : "";
}

function buildSeriesCardHTML(ev) {
  const title = escapeHTML(ev.name || ev.series || "UNTITLED SERIES");
  const thumb = ev.thumbnail
    ? `<div class="series-thumb" style="background-image: url('${escapeHTML(ev.thumbnail)}')"></div>`
    : `<div class="series-thumb series-thumb-empty">AMKRO</div>`;

  const podiumRows = (ev.top3 || []).slice(0, 3).map((d, idx) => {
    const pos = d.position || idx + 1;
    const pts = d.points !== null && d.points !== undefined ? `${escapeHTML(d.points)} PTS` : "";
    return `
      <div class="podium-row podium-p${pos}">
        <span class="podium-pos">P${pos}</span>
        ${renderFlagMarkup(d)}
        <span class="podium-name">${escapeHTML(d.name || "Driver")}</span>
        <span class="podium-pts">${pts}</span>
      </div>
    `;
  }).join("");

  const standingsLink = escapeHTML(ev.standingsUrl || ev.url || "#");

  return `
    <article class="standings-card">
      ${thumb}
      <div class="standings-card-body">
        <div class="standings-card-header">
          <h3 class="standings-series-title">${title}</h3>
          ${ev.date ? `<span class="standings-date">${escapeHTML(ev.date)}</span>` : ""}
        </div>
        <div class="podium-list">
          ${podiumRows || '<div class="podium-empty">NO STANDINGS DATA</div>'}
        </div>
        <a class="standings-link-btn" href="${standingsLink}" target="_blank" rel="noopener noreferrer">
          FULL STANDINGS ↗
        </a>
      </div>
    </article>
  `;
}

function renderArchivePage(page) {
  const totalPages = Math.max(1, Math.ceil(filteredStandingsEvents.length / ITEMS_PER_ARCHIVE_PAGE));
  currentArchivePage = Math.min(Math.max(1, page), totalPages);

  const start = (currentArchivePage - 1) * ITEMS_PER_ARCHIVE_PAGE;
  const pageItems = filteredStandingsEvents.slice(start, start + ITEMS_PER_ARCHIVE_PAGE);

  const gridEl = document.getElementById("standings-archive-grid");
  const pagEl = document.getElementById("standings-archive-pagination");
  if (!gridEl || !pagEl) return;

  gridEl.innerHTML = pageItems.map(buildSeriesCardHTML).join("");

  let buttonsHTML = `
    <button class="page-btn" ${currentArchivePage === 1 ? "disabled" : ""} data-page="${currentArchivePage - 1}">‹</button>
  `;
  for (let p = 1; p <= totalPages; p++) {
    buttonsHTML += `
      <button class="page-btn ${p === currentArchivePage ? "active" : ""}" data-page="${p}">${p}</button>
    `;
  }
  buttonsHTML += `
    <button class="page-btn" ${currentArchivePage === totalPages ? "disabled" : ""} data-page="${currentArchivePage + 1}">›</button>
  `;

  pagEl.innerHTML = buttonsHTML;
  pagEl.querySelectorAll(".page-btn:not([disabled])").forEach(btn => {
    btn.addEventListener("click", () => {
      renderArchivePage(Number(btn.dataset.page));
      const modal = document.getElementById("standings-archive-modal");
      if (modal) modal.scrollTop = 0;
    });
  });
}

function openStandingsArchive() {
  let modal = document.getElementById("standings-archive-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "standings-archive-modal";
    modal.className = "standings-archive-modal";
    modal.innerHTML = `
      <div class="standings-archive-inner">
        <div class="standings-archive-topbar">
          <h2>ALL FINISHED SERIES (${filteredStandingsEvents.length})</h2>
          <button id="close-standings-archive" class="archive-close-btn">CLOSE ✕</button>
        </div>
        <div id="standings-archive-grid" class="standings-archive-grid"></div>
        <div id="standings-archive-pagination" class="standings-archive-pagination"></div>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById("close-standings-archive").addEventListener("click", closeStandingsArchive);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeStandingsArchive();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal.classList.contains("open")) closeStandingsArchive();
    });
  } else {
    const heading = modal.querySelector(".standings-archive-topbar h2");
    if (heading) heading.textContent = `ALL FINISHED SERIES (${filteredStandingsEvents.length})`;
  }

  renderArchivePage(1);
  modal.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeStandingsArchive() {
  const modal = document.getElementById("standings-archive-modal");
  if (modal) modal.classList.remove("open");
  document.body.style.overflow = "";
}

async function initStandings() {
  const container = document.getElementById("standings-grid") || document.querySelector(".standings-grid");
  if (!container) return;

  try {
    const res = await fetch(`data/standings.json?t=${Date.now()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const rawEvents = Array.isArray(data.events) ? data.events : [];

    filteredStandingsEvents = rawEvents.filter(
      ev => !EXCLUDED_SERIES.has(normalizeSeriesTitle(ev.name || ev.series))
    );

    const latestThree = filteredStandingsEvents.slice(0, 3);
    container.innerHTML = latestThree.length
      ? latestThree.map(buildSeriesCardHTML).join("")
      : '<div class="standings-empty">NO FINISHED SERIES AVAILABLE</div>';

    let showAllWrap = document.getElementById("standings-show-all-wrap");
    if (!showAllWrap) {
      showAllWrap = document.createElement("div");
      showAllWrap.id = "standings-show-all-wrap";
      showAllWrap.className = "standings-show-all-wrap";
      container.insertAdjacentElement("afterend", showAllWrap);
    }

    if (filteredStandingsEvents.length > 3) {
      showAllWrap.innerHTML = `<button id="standings-show-all-btn" class="standings-show-all-btn">SHOW ALL</button>`;
      document.getElementById("standings-show-all-btn").addEventListener("click", openStandingsArchive);
    } else {
      showAllWrap.innerHTML = "";
    }
  } catch (err) {
    console.error("Failed to load standings:", err);
  }
}

async function initVideos() {
  const videoContainer = document.getElementById("videos-grid") || document.querySelector(".videos-grid");
  if (!videoContainer) return;

  try {
    const res = await fetch(`data/videos.json?t=${Date.now()}`);
    if (!res.ok) return;
    const data = await res.json();
    const videos = Array.isArray(data.videos) ? data.videos.slice(0, 3) : [];
    if (!videos.length) return;

    videoContainer.innerHTML = videos.map(v => `
      <a class="video-card" href="${escapeHTML(v.url)}" target="_blank" rel="noopener noreferrer">
        <div class="video-thumb" style="background-image: url('${escapeHTML(v.thumbnail)}')"></div>
        <div class="video-card-body">
          <h3 class="video-title">${escapeHTML(v.title)}</h3>
          ${v.published ? `<span class="video-date">${escapeHTML(v.published)}</span>` : ""}
        </div>
      </a>
    `).join("");
  } catch (err) {
    console.error("Failed to load videos:", err);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initStandings();
  initVideos();
});
