/* ==========================================================================
   AMKRO — AMK Racing Organization
   Shared Multi-Page Script (Home, Standings, Blog, Socials, About Us)
   ========================================================================== */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

/* ====== Mobile Nav & Footer Year & Back-to-Top ====== */
const menuBtn = $('#menuBtn');
const nav = $('#nav');
if (menuBtn && nav) {
  menuBtn.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    menuBtn.setAttribute('aria-expanded', String(open));
  });
}

if ($('#year')) {
  $('#year').textContent = new Date().getFullYear();
}

const toTop = $('#toTop');
if (toTop) {
  window.addEventListener('scroll', () => {
    toTop.classList.toggle('show', window.scrollY > 360);
  });
  toTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

/* ====== Flat Rectangular Country Flag Helper ====== */
function createRectFlag(countryCode, fallbackEmoji) {
  const raw = String(countryCode || '').trim();
  let iso = '';

  if (/^[a-zA-Z]{2}$/.test(raw)) {
    iso = raw.toLowerCase();
  } else if (fallbackEmoji) {
    const chars = Array.from(String(fallbackEmoji).trim());
    if (
      chars.length === 2 &&
      chars.every(c => {
        const cp = c.codePointAt(0);
        return cp >= 0x1F1E6 && cp <= 0x1F1FF;
      })
    ) {
      iso = chars.map(c => String.fromCharCode(c.codePointAt(0) - 0x1F1E6 + 97)).join('');
    }
  }

  if (iso) {
    const img = document.createElement('img');
    img.className = 'rect-flag';
    img.src = `https://flagcdn.com/w40/${iso}.png`;
    img.alt = iso.toUpperCase();
    img.loading = 'lazy';
    return img;
  }

  return fallbackEmoji ? el('span', 'st-flag-text', fallbackEmoji) : null;
}

/* ====== Shared Standings Cache (Also Supplies Thumbnails to Upcoming Races) ====== */
let STANDINGS_CACHE = null;

async function fetchStandingsData() {
  if (STANDINGS_CACHE) return STANDINGS_CACHE;
  try {
    const res = await fetch('data/standings.json', { cache: 'no-store' });
    STANDINGS_CACHE = await res.json();
  } catch (e) {
    STANDINGS_CACHE = { events: [] };
  }
  return STANDINGS_CACHE;
}

function findMatchingSeriesBanner(eventTitle, standingsList) {
  const norm = String(eventTitle || '')
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .split('-')[0]
    .replace(/^amkro\s+/i, '')
    .trim();
  if (!norm) return '';

  const match = standingsList.find(s => {
    const sName = String(s.series || s.name || '').toLowerCase();
    return sName.includes(norm) || norm.includes(sName.replace(/^amkro\s+/i, '').trim());
  });
  return match ? (match.thumbnail || match.banner || match.image || '') : '';
}

/* ====== Home Page: Upcoming Races & Live Countdowns ====== */
function formatCountdown(ms) {
  if (ms <= 0) return 'LIVE / STARTED';
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = n => String(n).padStart(2, '0');
  return `Starts in ${pad(d)} days : ${pad(h)} hrs : ${pad(m)} min : ${pad(s)} sec`;
}

function parseEventDate(ev) {
  const raw = ev.date || ev.start || ev.startTime || ev.start_date || ev.datetime || ev.timestamp;
  if (!raw) return NaN;
  if (typeof raw === 'number') return raw < 1e12 ? raw * 1000 : raw;
  return new Date(raw).getTime();
}

async function loadEvents() {
  const listEl = $('#eventList');
  if (!listEl) return;

  let events = [];
  let standingsList = [];

  try {
    const [evRes, stData] = await Promise.all([
      fetch('data/events.json', { cache: 'no-store' }),
      fetchStandingsData()
    ]);
    const evData = await evRes.json();
    events = Array.isArray(evData)
      ? evData
      : (evData.events || evData.races || Object.values(evData).find(v => Array.isArray(v)) || []);
    standingsList = Array.isArray(stData) ? stData : (stData.events || stData.standings || []);
  } catch (e) {
    events = [];
  }

  const now = Date.now();
  const upcoming = events
    .filter(ev => {
      const t = parseEventDate(ev);
      return Number.isNaN(t) || t >= now - 3600 * 1000;
    })
    .sort((a, b) => (parseEventDate(a) || 0) - (parseEventDate(b) || 0));

  listEl.textContent = '';
  if (!upcoming.length) {
    listEl.append(el('p', 'muted', 'No upcoming races scheduled right now. Check World Sim Series for new rounds.'));
    return;
  }

  const countdownNodes = [];

  upcoming.forEach((ev, idx) => {
    const card = el('article', 'card event-card');

    // Add series banner image at top of card
    const imgUrl = ev.thumbnail || ev.image || ev.banner || findMatchingSeriesBanner(ev.title || ev.name, standingsList);
    const banner = el('div', 'st-banner');
    if (imgUrl) {
      banner.style.backgroundImage = `url("${imgUrl}")`;
    }
    card.append(banner);

    const body = el('div', 'card-body');
    body.append(el('span', 'badge', idx === 0 ? 'Next race' : 'Upcoming'));
    body.append(el('h3', null, ev.title || ev.name || ev.series || 'AMKRO Event'));

    const startMs = parseEventDate(ev);
    if (!Number.isNaN(startMs)) {
      const dateText = new Date(startMs).toLocaleString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
      body.append(el('p', 'muted', dateText));

      const cd = el('div', 'countdown', formatCountdown(startMs - Date.now()));
      body.append(cd);
      countdownNodes.push({ el: cd, target: startMs });
    } else if (ev.dateText || ev.when) {
      body.append(el('p', 'muted', ev.dateText || ev.when));
    }

    const actions = el('div', 'cta');
    const link = el('a', 'btn', 'GO TO THE RACE →');
    link.href = ev.url || ev.link || 'https://paddock.worldsimseries.com/';
    link.target = '_blank';
    link.rel = 'noopener';
    actions.append(link);
    body.append(actions);

    card.append(body);
    listEl.append(card);
  });

  if (countdownNodes.length) {
    setInterval(() => {
      const t = Date.now();
      countdownNodes.forEach(item => {
        item.el.textContent = formatCountdown(item.target - t);
      });
    }, 1000);
  }
}

/* ====== Series Standings + Interactive Calendar & Round Results Modal ====== */
let ALL_STANDINGS = [];
let UPCOMING_EVENTS_CACHE = [];
let stQuery = '';
let stFilter = 'ALL';
let showAllOngoing = false;
let showAllFinished = false;

function isOngoingSeries(item) {
  const status = String(item.status || item.progress || '').toLowerCase();
  return status !== 'finished' && !status.startsWith('finished');
}

function buildRoundsForSeries(s) {
  // 1. If standings.json already provides a rounds/schedule array, use it directly
  if (Array.isArray(s.rounds) && s.rounds.length) {
    return s.rounds;
  }

  // 2. Otherwise construct round list from progress "(completed/total)" + matching upcoming events
  const match = String(s.progress || '').match(/\((\d+)\s*\/\s*(\d+)\)/);
  const completedCount = match ? parseInt(match[1], 10) : 0;
  const totalCount = match ? parseInt(match[2], 10) : (isOngoingSeries(s) ? 1 : 4);
  const isFinishedSeries = !isOngoingSeries(s);

  const baseName = String(s.series || s.name || '').toLowerCase().replace(/^amkro\s+/i, '').trim();
  const matchingUpcoming = UPCOMING_EVENTS_CACHE.filter(ev => {
    const t = String(ev.title || ev.name || '').toLowerCase();
    return baseName && t.includes(baseName);
  });

  const rounds = [];
  for (let r = 1; r <= totalCount; r++) {
    const roundRegex = new RegExp(`\\(${r}\\s*/\\s*${totalCount}\\)`);
    const matchedEv = matchingUpcoming.find(ev => roundRegex.test(String(ev.title || ev.name || '')));
    const done = isFinishedSeries || r < completedCount || (r === completedCount && isFinishedSeries);
    const isNext = !done && (r === completedCount || Boolean(matchedEv));

    rounds.push({
      round: r,
      name: matchedEv ? (matchedEv.title || matchedEv.name) : `${s.series || s.name} — Round ${r}`,
      track: matchedEv?.track || '',
      date: matchedEv
        ? new Date(parseEventDate(matchedEv)).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
        : (done ? 'Completed' : 'Scheduled'),
      status: done ? 'COMPLETED' : (isNext ? 'NEXT / ACTIVE' : 'UPCOMING'),
      url: matchedEv?.url || s.url || `https://paddock.worldsimseries.com/events/${s.id || ''}#/`,
      qualifying: [],
      race: []
    });
  }
  return rounds;
}

function renderSessionTable(rows, emptyMsg) {
  if (!Array.isArray(rows) || !rows.length) {
    return el('p', 'muted', emptyMsg);
  }
  const table = el('table', 'results-table');
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  ['POS', 'DRIVER', 'CAR / TEAM', 'TIME / GAP', 'PTS'].forEach(h => {
    headRow.append(el('th', null, h));
  });
  thead.append(headRow);
  table.append(thead);

  const tbody = document.createElement('tbody');
  rows.forEach((r, idx) => {
    const tr = document.createElement('tr');
    tr.append(el('td', 'st-pos', `P${r.position || r.pos || idx + 1}`));

    const tdDriver = document.createElement('td', 'st-driver');
    const flag = createRectFlag(r.countryCode, r.flag);
    if (flag) tdDriver.append(flag);
    tdDriver.append(el('span', null, r.name || r.fullName || r.driver || 'Driver'));
    tr.append(tdDriver);

    tr.append(el('td', 'muted', r.car || r.team || '—'));
    tr.append(el('td', 'muted', r.time || r.gap || r.bestLap || '—'));
    tr.append(el('td', 'st-pts', r.points !== undefined ? `${r.points}` : '—'));
    tbody.append(tr);
  });
  table.append(tbody);
  return table;
}

function openSeriesOverviewModal(s, initialRoundIndex = null) {
  let modal = $('#seriesModal');
  if (!modal) {
    modal = el('div', 'blog-modal');
    modal.id = 'seriesModal';

    const inner = el('article', 'blog-modal-inner series-modal-inner');
    const topbar = el('div', 'blog-modal-topbar');
    const tag = el('span', 'st-series');
    tag.id = 'seriesModalTag';
    const closeBtn = el('button', 'btn', 'CLOSE ✕');
    closeBtn.type = 'button';
    closeBtn.onclick = closeSeriesModal;
    topbar.append(tag, closeBtn);

    const cover = el('div', 'blog-modal-cover');
    cover.id = 'seriesModalCover';

    const title = el('h2', 'blog-modal-title');
    title.id = 'seriesModalTitle';

    const meta = el('p', 'muted blog-modal-meta');
    meta.id = 'seriesModalMeta';

    const content = el('div', 'series-modal-content');
    content.id = 'seriesModalContent';

    inner.append(topbar, cover, title, meta, content);
    modal.append(inner);
    document.body.append(modal);

    modal.addEventListener('click', e => {
      if (e.target === modal) closeSeriesModal();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && modal.classList.contains('open')) closeSeriesModal();
    });
  }

  const rounds = buildRoundsForSeries(s);
  const content = $('#seriesModalContent');

  function showSeriesHome() {
    $('#seriesModalTag').textContent = (s.progress || (isOngoingSeries(s) ? 'IN PROGRESS' : 'FINISHED')).toUpperCase();
    $('#seriesModalTitle').textContent = s.series || s.name || 'AMKRO Series';
    $('#seriesModalMeta').textContent = s.date ? `Season Start: ${s.date}` : '';

    const coverEl = $('#seriesModalCover');
    const imgUrl = s.thumbnail || s.banner || s.image;
    if (imgUrl) {
      coverEl.style.display = 'block';
      coverEl.style.backgroundImage = `url("${imgUrl}")`;
    } else {
      coverEl.style.display = 'none';
    }

    content.textContent = '';

    // Section 1: Championship Standings
    const stSection = el('div', 'modal-section');
    stSection.append(el('h3', 'modal-subheading', 'CHAMPIONSHIP STANDINGS'));

    const drivers = Array.isArray(s.standings) && s.standings.length
      ? s.standings
      : (Array.isArray(s.top3) ? s.top3 : []);

    if (drivers.length) {
      const ul = el('ul', 'st-podium modal-podium');
      drivers.forEach((row, idx) => {
        const li = el('li');
        li.append(el('span', 'st-pos', `P${row.position || idx + 1}`));
        const dWrap = el('span', 'st-driver');
        const flagNode = createRectFlag(row.countryCode, row.flag);
        if (flagNode) dWrap.append(flagNode);
        dWrap.append(el('span', null, row.fullName || row.name || row.driver || 'TBD'));
        li.append(dWrap);
        li.append(el('span', 'st-pts', row.points !== undefined ? `${row.points} pts` : ''));
        ul.append(li);
      });
      stSection.append(ul);
    } else {
      stSection.append(el('p', 'muted', 'Championship points will appear after Round 1 concludes.'));
    }

    const wssActions = el('div', 'cta');
    const wssStBtn = el('a', 'btn', 'OPEN FULL WSS STANDINGS TABLE →');
    wssStBtn.href = s.standingsUrl || s.url || 'https://paddock.worldsimseries.com/';
    wssStBtn.target = '_blank';
    wssStBtn.rel = 'noopener';
    wssActions.append(wssStBtn);
    stSection.append(wssActions);
    content.append(stSection);

    // Section 2: Series Calendar & Clickable Rounds
    const calSection = el('div', 'modal-section');
    calSection.append(el('h3', 'modal-subheading', 'SERIES CALENDAR & ROUNDS (CLICK A ROUND FOR RESULTS)'));

    const roundList = el('div', 'round-list');
    rounds.forEach((r, idx) => {
      const rowBtn = el('button', 'round-row');
      rowBtn.type = 'button';
      rowBtn.onclick = () => showRoundDetail(idx);

      const left = el('div', 'round-row-left');
      left.append(el('span', 'st-pos', `R${r.round || idx + 1}`));
      const titleBox = el('div', 'round-row-info');
      titleBox.append(el('strong', null, r.name || `Round ${idx + 1}`));
      titleBox.append(el('small', 'muted', [r.track, r.date].filter(Boolean).join(' • ')));
      left.append(titleBox);

      const right = el('div', 'round-row-right');
      right.append(el('span', 'st-series', r.status || 'ROUND'));
      right.append(el('span', 'round-arrow', 'RESULTS →'));

      rowBtn.append(left, right);
      roundList.append(rowBtn);
    });

    calSection.append(roundList);
    content.append(calSection);
  }

  function showRoundDetail(idx) {
    const r = rounds[idx];
    if (!r) return showSeriesHome();

    content.textContent = '';

    const backRow = el('div', 'round-detail-nav');
    const backBtn = el('button', 'btn', '← BACK TO SERIES CALENDAR');
    backBtn.type = 'button';
    backBtn.onclick = showSeriesHome;
    backRow.append(backBtn);
    content.append(backRow);

    const header = el('div', 'modal-section');
    header.append(el('span', 'st-series', `ROUND ${r.round || idx + 1} • ${r.status || ''}`));
    header.append(el('h3', 'modal-subheading', r.name || `Round ${idx + 1}`));
    if (r.track || r.date) {
      header.append(el('p', 'muted', [r.track, r.date].filter(Boolean).join(' • ')));
    }
    content.append(header);

    // Qualifying Results
    const qualSection = el('div', 'modal-section');
    qualSection.append(el('h3', 'modal-subheading', 'QUALIFYING RESULTS'));
    qualSection.append(
      renderSessionTable(
        r.qualifying,
        r.status === 'UPCOMING'
          ? 'Qualifying has not taken place yet.'
          : 'Detailed qualifying classification is hosted on World Sim Series.'
      )
    );
    content.append(qualSection);

    // Race Results
    const raceSection = el('div', 'modal-section');
    raceSection.append(el('h3', 'modal-subheading', 'RACE RESULTS'));
    raceSection.append(
      renderSessionTable(
        r.race,
        r.status === 'UPCOMING'
          ? 'Race session has not taken place yet.'
          : 'Detailed race classification & lap times are hosted on World Sim Series.'
      )
    );

    const extWrap = el('div', 'cta');
    const extBtn = el('a', 'btn primary', 'VIEW OFFICIAL WSS SESSION RESULTS & LAPS →');
    extBtn.href = r.resultsUrl || r.url || s.url || 'https://paddock.worldsimseries.com/';
    extBtn.target = '_blank';
    extBtn.rel = 'noopener';
    extWrap.append(extBtn);
    raceSection.append(extWrap);

    content.append(raceSection);
  }

  if (initialRoundIndex !== null && rounds[initialRoundIndex]) {
    showRoundDetail(initialRoundIndex);
  } else {
    showSeriesHome();
  }

  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeSeriesModal() {
  const modal = $('#seriesModal');
  if (modal) modal.classList.remove('open');
  document.body.style.overflow = '';
}

function buildStandingCard(s) {
  const card = el('article', 'st-card st-card-clickable');
  card.setAttribute('role', 'button');
  card.setAttribute('tabindex', '0');
  card.onclick = e => {
    if (e.target.closest('a')) return;
    openSeriesOverviewModal(s);
  };
  card.onkeydown = e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openSeriesOverviewModal(s);
    }
  };

  const banner = el('div', 'st-banner');
  const imgUrl = s.thumbnail || s.banner || s.image;
  if (imgUrl) {
    banner.style.backgroundImage = `url("${imgUrl}")`;
  }
  card.append(banner);

  const body = el('div', 'st-body');
  const badgeText = s.progress || (isOngoingSeries(s) ? 'IN PROGRESS' : 'FINISHED');
  body.append(el('span', 'st-series', badgeText));
  body.append(el('h3', null, s.series || s.name || 'AMKRO Series'));

  if (s.date) {
    body.append(el('div', 'st-meta', s.date));
  }

  const podium = Array.isArray(s.top3) ? s.top3 : (Array.isArray(s.podium) ? s.podium : []);
  if (podium.length) {
    const ul = el('ul', 'st-podium');
    podium.slice(0, 3).forEach((row, idx) => {
      const li = el('li');
      const posLabel = row.position ? `P${row.position}` : (row.pos || `P${idx + 1}`);
      li.append(el('span', 'st-pos', posLabel));

      const driverWrap = el('span', 'st-driver');
      const flagNode = createRectFlag(row.countryCode, row.flag);
      if (flagNode) driverWrap.append(flagNode);
      driverWrap.append(el('span', null, row.name || row.fullName || row.driver || 'TBD'));
      li.append(driverWrap);

      const rawPts = row.points !== undefined ? row.points : row.pts;
      const ptsVal = rawPts !== undefined && rawPts !== ''
        ? (String(rawPts).includes('pt') ? String(rawPts) : `${rawPts} pts`)
        : '';
      li.append(el('span', 'st-pts', ptsVal));
      ul.append(li);
    });
    body.append(ul);
  } else {
    body.append(el('p', 'muted', 'Standings update after Round 1.'));
  }

  const actions = el('div', 'cta');
  const calBtn = el('button', 'btn primary', 'CALENDAR & RESULTS →');
  calBtn.type = 'button';
  calBtn.onclick = e => {
    e.stopPropagation();
    openSeriesOverviewModal(s);
  };
  actions.append(calBtn);
  body.append(actions);

  card.append(body);
  return card;
}

function renderStandings() {
  const container = $('#stList');
  if (!container) return;
  container.textContent = '';

  const filtered = ALL_STANDINGS.filter(item => {
    if (stFilter === 'ONGOING' && !isOngoingSeries(item)) return false;
    if (stFilter === 'FINISHED' && isOngoingSeries(item)) return false;
    if (!stQuery) return true;

    const podiumList = item.top3 || item.podium || [];
    const podiumText = podiumList
      .map(p => `${p.name || ''} ${p.fullName || ''} ${p.driver || ''}`)
      .join(' ');
    const hay = `${item.series || ''} ${item.name || ''} ${item.progress || ''} ${podiumText}`.toLowerCase();
    return hay.includes(stQuery);
  });

  if (!filtered.length) {
    container.append(el('p', 'muted', 'No matching series or drivers found.'));
    return;
  }

  const ongoing = filtered.filter(isOngoingSeries);
  const finished = filtered.filter(s => !isOngoingSeries(s));

  function appendGroup(title, items, expanded, onToggle) {
    if (!items.length) return;
    const section = el('div', 'st-group');

    const header = el('div', 'st-group-header');
    header.append(el('h3', 'st-group-title', title));
    header.append(el('span', 'st-count', `${items.length} SERIES`));
    section.append(header);

    const grid = el('div', 'cards');
    const visible = (stQuery || expanded) ? items : items.slice(0, 3);
    visible.forEach(item => grid.append(buildStandingCard(item)));
    section.append(grid);

    if (!stQuery && items.length > 3) {
      const wrap = el('div', 'st-dropdown-wrap');
      const btn = el(
        'button',
        'btn st-dropdown-btn',
        expanded ? 'SHOW LESS ▲' : `SHOW ALL ${items.length} SERIES ▼`
      );
      btn.type = 'button';
      btn.onclick = onToggle;
      wrap.append(btn);
      section.append(wrap);
    }

    container.append(section);
  }

  appendGroup('ONGOING SERIES', ongoing, showAllOngoing, () => {
    showAllOngoing = !showAllOngoing;
    renderStandings();
  });

  appendGroup('FINISHED SERIES', finished, showAllFinished, () => {
    showAllFinished = !showAllFinished;
    renderStandings();
  });
}

async function loadStandings() {
  const container = $('#stList');
  if (!container) return;

  try {
    const [data, evRes] = await Promise.all([
      fetchStandingsData(),
      fetch('data/events.json', { cache: 'no-store' }).catch(() => null)
    ]);
    ALL_STANDINGS = Array.isArray(data) ? data : (data.events || data.standings || data.series || []);

    if (evRes && evRes.ok) {
      const evJson = await evRes.json();
      UPCOMING_EVENTS_CACHE = Array.isArray(evJson) ? evJson : (evJson.events || []);
    }

    if ($('#stUpdated') && data.updated) {
      const d = new Date(data.updated);
      if (!Number.isNaN(d.getTime())) {
        $('#stUpdated').textContent = `Updated ${d.toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit'
        })}.`;
      }
    }
  } catch (e) {
    ALL_STANDINGS = [];
  }

  const chipsWrap = $('#stChips');
  if (chipsWrap) {
    chipsWrap.textContent = '';
    [
      { id: 'ALL', label: 'ALL SERIES' },
      { id: 'ONGOING', label: 'ONGOING' },
      { id: 'FINISHED', label: 'FINISHED' }
    ].forEach(c => {
      const chip = el('button', `chip${stFilter === c.id ? ' active' : ''}`, c.label);
      chip.type = 'button';
      chip.onclick = () => {
        stFilter = c.id;
        $$('.chip', chipsWrap).forEach(b => b.classList.remove('active'));
        chip.classList.add('active');
        renderStandings();
      };
      chipsWrap.append(chip);
    });
  }

  if ($('#stSearch')) {
    $('#stSearch').addEventListener('input', e => {
      stQuery = e.target.value.trim().toLowerCase();
      renderStandings();
    });
  }

  renderStandings();
}

/* ====== Blog / Newsroom (Powered by Pages CMS -> data/blog.json) ====== */
let BLOG_POSTS = [];
let blogQuery = '';
let blogExpanded = false;

function openBlogReader(post) {
  let modal = $('#blogModal');
  if (!modal) {
    modal = el('div', 'blog-modal');
    modal.id = 'blogModal';

    const inner = el('article', 'blog-modal-inner');
    const topbar = el('div', 'blog-modal-topbar');
    const tag = el('span', 'st-series');
    tag.id = 'blogModalTag';
    const closeBtn = el('button', 'btn', 'CLOSE ✕');
    closeBtn.type = 'button';
    closeBtn.onclick = closeBlogReader;
    topbar.append(tag, closeBtn);

    const cover = el('div', 'blog-modal-cover');
    cover.id = 'blogModalCover';

    const title = el('h2', 'blog-modal-title');
    title.id = 'blogModalTitle';

    const meta = el('p', 'muted blog-modal-meta');
    meta.id = 'blogModalMeta';

    const content = el('div', 'blog-modal-body');
    content.id = 'blogModalBody';

    inner.append(topbar, cover, title, meta, content);
    modal.append(inner);
    document.body.append(modal);

    modal.addEventListener('click', e => {
      if (e.target === modal) closeBlogReader();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && modal.classList.contains('open')) closeBlogReader();
    });
  }

  $('#blogModalTag').textContent = (post.category || 'ARTICLE').toUpperCase();
  $('#blogModalTitle').textContent = post.title || 'Untitled Post';

  const dateStr = post.date
    ? new Date(post.date).toLocaleDateString(undefined, { dateStyle: 'long' })
    : '';
  const byline = [dateStr, post.author ? 'By ' + post.author : ''].filter(Boolean).join(' • ');
  $('#blogModalMeta').textContent = byline;

  const coverEl = $('#blogModalCover');
  if (post.image) {
    coverEl.style.display = 'block';
    coverEl.style.backgroundImage = `url("${post.image}")`;
  } else {
    coverEl.style.display = 'none';
  }

  const bodyEl = $('#blogModalBody');
  const raw = String(post.body || '');
  if (/<[a-z][\s\S]*>/i.test(raw)) {
    bodyEl.innerHTML = raw;
  } else {
    bodyEl.textContent = '';
    raw.split(/\n{2,}/).forEach(para => {
      if (para.trim()) bodyEl.append(el('p', null, para.trim()));
    });
  }

  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeBlogReader() {
  const modal = $('#blogModal');
  if (modal) modal.classList.remove('open');
  document.body.style.overflow = '';
}

function renderBlog() {
  const grid = $('#blogGrid');
  if (!grid) return;
  grid.textContent = '';

  const filtered = blogQuery
    ? BLOG_POSTS.filter(p =>
        `${p.title || ''} ${p.category || ''} ${p.author || ''} ${p.excerpt || ''}`
          .toLowerCase()
          .includes(blogQuery)
      )
    : BLOG_POSTS;

  if (!filtered.length) {
    grid.append(el('p', 'muted', BLOG_POSTS.length ? 'No articles match your search.' : 'No articles published yet.'));
    return;
  }

  const visible = (blogQuery || blogExpanded) ? filtered : filtered.slice(0, 6);
  visible.forEach(post => {
    const card = el('article', 'blog-card');

    const thumb = el('div', 'blog-card-thumb');
    if (post.image) thumb.style.backgroundImage = `url("${post.image}")`;
    thumb.onclick = () => openBlogReader(post);

    const body = el('div', 'blog-card-body');
    const metaRow = el('div', 'blog-card-meta');
    metaRow.append(el('span', 'st-series', (post.category || 'NEWS').toUpperCase()));
    if (post.date) {
      metaRow.append(el('small', 'muted', new Date(post.date).toLocaleDateString(undefined, { dateStyle: 'medium' })));
    }

    const title = el('h3', null, post.title || 'Untitled');
    title.onclick = () => openBlogReader(post);

    const excerpt = el('p', 'muted', post.excerpt || '');

    const actions = el('div', 'cta');
    const readBtn = el('button', 'btn primary', 'READ ARTICLE →');
    readBtn.type = 'button';
    readBtn.onclick = () => openBlogReader(post);
    actions.append(readBtn);

    body.append(metaRow, title, excerpt, actions);
    card.append(thumb, body);
    grid.append(card);
  });

  let wrap = $('#blogToggleWrap');
  if (!wrap) {
    wrap = el('div', 'st-dropdown-wrap');
    wrap.id = 'blogToggleWrap';
    grid.insertAdjacentElement('afterend', wrap);
  }
  wrap.textContent = '';

  if (!blogQuery && filtered.length > 6) {
    const btn = el(
      'button',
      'btn st-dropdown-btn',
      blogExpanded ? 'SHOW LESS ▲' : `SHOW ALL ${filtered.length} ARTICLES ▼`
    );
    btn.type = 'button';
    btn.onclick = () => {
      blogExpanded = !blogExpanded;
      renderBlog();
    };
    wrap.append(btn);
  }
}

async function loadBlog() {
  const grid = $('#blogGrid');
  if (!grid) return;

  try {
    const data = await (await fetch('data/blog.json', { cache: 'no-store' })).json();
    const list = Array.isArray(data) ? data : (data.posts || []);
    BLOG_POSTS = list.slice().sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  } catch (e) {
    BLOG_POSTS = [];
  }

  if ($('#blogSearch')) {
    $('#blogSearch').addEventListener('input', e => {
      blogQuery = e.target.value.trim().toLowerCase();
      renderBlog();
    });
  }

  renderBlog();
}

/* ====== Socials Page: Live YouTube Feed & Instagram ====== */
async function resolveYouTubeChannelId() {
  try {
    const res = await fetch('https://api.allorigins.win/get?url=' + encodeURIComponent('https://www.youtube.com/@AMKRacingOrganisation'));
    const data = await res.json();
    const html = data?.contents || '';
    const match = html.match(/"channelId":"(UC[\w-]{22})"/);
    if (match) return match[1];
  } catch (e) {}
  return '';
}

async function loadSocials() {
  const ytGrid = $('#ytGrid');
  if (ytGrid) {
    let videos = [];

    // 1. Check local data/youtube.json first
    try {
      const localRes = await fetch('data/youtube.json', { cache: 'no-store' });
      if (localRes.ok) {
        const d = await localRes.json();
        videos = Array.isArray(d) ? d : (d.videos || d.items || []);
      }
    } catch (e) {
      videos = [];
    }

    // 2. Otherwise resolve @AMKRacingOrganisation channel ID & fetch its RSS feed
    if (!videos.length) {
      const explicitId = (ytGrid.dataset.channelId || ytGrid.dataset.playlistId || '').trim();
      const channelId = explicitId || (await resolveYouTubeChannelId());

      if (channelId) {
        const feedParam = channelId.startsWith('UU') || channelId.startsWith('PL')
          ? `playlist_id=${channelId}`
          : `channel_id=${channelId}`;
        const rawRss = `https://www.youtube.com/feeds/videos.xml?${feedParam}`;

        try {
          const apiRes = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rawRss)}`);
          const apiData = await apiRes.json();
          if (apiData && Array.isArray(apiData.items) && apiData.items.length) {
            videos = apiData.items.map(item => ({
              title: item.title,
              url: item.link,
              thumbnail: item.thumbnail,
              published: item.pubDate
            }));
          }
        } catch (e) {}

        if (!videos.length) {
          try {
            const proxyRes = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(rawRss)}`);
            const proxyData = await proxyRes.json();
            if (proxyData?.contents) {
              const xml = new DOMParser().parseFromString(proxyData.contents, 'text/xml');
              videos = Array.from(xml.querySelectorAll('entry')).map(entry => {
                const vidId = entry.querySelector('videoId')?.textContent || '';
                return {
                  id: vidId,
                  title: entry.querySelector('title')?.textContent || 'AMKRO Broadcast',
                  url: entry.querySelector('link')?.getAttribute('href') || `https://www.youtube.com/watch?v=${vidId}`,
                  thumbnail: vidId ? `https://i.ytimg.com/vi/${vidId}/hqdefault.jpg` : '',
                  published: entry.querySelector('published')?.textContent || ''
                };
              });
            }
          } catch (e) {}
        }
      }
    }

    ytGrid.textContent = '';
    if (!videos.length) {
      const fallback = el('a', 'yt-card');
      fallback.href = 'https://www.youtube.com/@AMKRacingOrganisation';
      fallback.target = '_blank';
      fallback.rel = 'noopener';
      const info = el('div', 'yt-info');
      info.append(el('span', 'st-series', 'YOUTUBE'));
      info.append(el('h3', null, '@AMKRACINGORGANISATION'));
      info.append(el('p', 'muted', 'Watch live race broadcasts, championship highlights, and onboard replays on our official YouTube channel.'));
      fallback.append(info);
      ytGrid.append(fallback);
    } else {
      videos.slice(0, 6).forEach(v => {
        const card = el('a', 'yt-card');
        card.href = v.url || (v.id ? `https://www.youtube.com/watch?v=${v.id}` : 'https://www.youtube.com/@AMKRacingOrganisation');
        card.target = '_blank';
        card.rel = 'noopener';

        if (v.thumbnail || v.id) {
          const img = el('img', 'yt-thumb');
          img.src = v.thumbnail || `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`;
          img.alt = v.title || 'YouTube Video';
          img.loading = 'lazy';
          card.append(img);
        }

        const info = el('div', 'yt-info');
        info.append(el('h3', null, v.title || 'AMKRO Broadcast'));
        if (v.published || v.date) {
          info.append(el('small', 'muted', new Date(v.published || v.date).toLocaleDateString(undefined, { dateStyle: 'medium' })));
        }
        card.append(info);
        ytGrid.append(card);
      });
    }
  }

  const igGrid = $('#igGrid');
  if (igGrid) {
    const accounts = [
      {
        handle: '@amkracingorganization',
        role: 'OFFICIAL LEAGUE & CHAMPIONSHIP UPDATES',
        desc: 'Race calendars, championship standings, stewarding announcements, and event posters.',
        url: 'https://www.instagram.com/amkracingorganization/'
      },
      {
        handle: '@teamamkro',
        role: 'AMKRO ESPORTS & ENDURANCE TEAM',
        desc: 'Team liveries, endurance driver lineups, onboard highlights, and behind-the-scenes updates.',
        url: 'https://www.instagram.com/teamamkro/'
      }
    ];
    igGrid.textContent = '';
    accounts.forEach(acc => {
      const card = el('a', 'ig-card');
      card.href = acc.url;
      card.target = '_blank';
      card.rel = 'noopener';

      const info = el('div', 'ig-info');
      info.append(el('span', 'st-series', 'INSTAGRAM'));
      info.append(el('h3', null, acc.handle));
      info.append(el('p', 'muted', acc.role));
      info.append(el('p', null, acc.desc));
      card.append(info);
      igGrid.append(card);
    });
  }
}

/* ====== About Us Page: Team History & FAQ ====== */
function loadAbout() {
  const timeline = $('#timeline');
  if (timeline) {
    const milestones = [
      {
        title: 'FOUNDATION OF AMK RACING ORGANIZATION',
        text: 'Established to bring structured, clean, and competitive sim racing championships to Assetto Corsa on World Sim Series.'
      },
      {
        title: 'MULTI-CLASS & ENDURANCE EXPANSION',
        text: 'Launched flagship endurance and multi-class championships featuring live broadcast coverage and custom stewarding.'
      },
      {
        title: 'TEAM AMKRO & INTERNATIONAL GRID',
        text: 'Grew into an international community of drivers competing across touring cars, GT endurance, historic DTM, and formula series.'
      }
    ];
    timeline.textContent = '';
    milestones.forEach(m => {
      const li = el('li');
      li.append(el('h3', null, m.title));
      li.append(el('p', 'muted', m.text));
      timeline.append(li);
    });
  }

  const faqList = $('#faqList');
  if (faqList) {
    const faqs = [
      {
        q: 'HOW DO I JOIN AN AMKRO CHAMPIONSHIP OR RACE?',
        a: 'Create a free account on World Sim Series (paddock.worldsimseries.com), open any upcoming AMKRO event from our Home or Standings page, and register with your required car and skin.'
      },
      {
        q: 'WHAT SIMULATOR DO YOU RACE ON?',
        a: 'All AMKRO championships are hosted on Assetto Corsa via World Sim Series with automated server entry, live timing, and official championship standings.'
      },
      {
        q: 'WHERE CAN I WATCH LIVE RACES AND HIGHLIGHTS?',
        a: 'Select rounds and endurance events are streamed live on our official YouTube channel (@AMKRacingOrganisation), with updates posted on Instagram.'
      },
      {
        q: 'ARE BEGINNERS WELCOME TO COMPETE?',
        a: 'Yes. We welcome drivers of all experience levels as long as you race cleanly, respect blue flags, and follow the event briefing rules.'
      }
    ];
    faqList.textContent = '';
    faqs.forEach(item => {
      const details = el('details');
      details.append(el('summary', null, item.q));
      details.append(el('p', null, item.a));
      faqList.append(details);
    });
  }
}

/* ====== Initialize Active Page Modules ====== */
loadEvents();
loadStandings();
loadBlog();
loadSocials();
loadAbout();
