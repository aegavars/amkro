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

/* ====== Scroll Reveal Animation Helper ====== */
const revealObserver = new IntersectionObserver(
  entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.08 }
);

function observeReveals(root = document) {
  $$('.card, .st-card, .blog-card, .yt-card, .ig-card, .timeline li, .faq details', root).forEach(
    (node, i) => {
      node.style.transitionDelay = `${Math.min(i * 45, 270)}ms`;
      revealObserver.observe(node);
    }
  );
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

    const imgUrl = ev.thumbnail || ev.image || ev.banner || findMatchingSeriesBanner(ev.title || ev.name, standingsList);
    if (imgUrl) {
      const banner = el('div', 'st-banner');
      banner.style.backgroundImage = `url("${imgUrl}")`;
      card.append(banner);
    }

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

    const actions = el('div', 'cta card-cta');
    const link = el('a', 'btn card-btn', 'GO TO THE RACE →');
    link.href = ev.url || ev.link || 'https://paddock.worldsimseries.com/';
    link.target = '_blank';
    link.rel = 'noopener';
    actions.append(link);
    body.append(actions);

    card.append(body);
    listEl.append(card);
  });

  observeReveals(listEl);

  if (countdownNodes.length) {
    setInterval(() => {
      const t = Date.now();
      countdownNodes.forEach(item => {
        item.el.textContent = formatCountdown(item.target - t);
      });
    }, 1000);
  }
}

/* ====== Series Standings (Ongoing & Finished, 3-Card Limit + Dropdown) ====== */
let ALL_STANDINGS = [];
let stQuery = '';
let stFilter = 'ALL';
let showAllOngoing = false;
let showAllFinished = false;

function isOngoingSeries(item) {
  const status = String(item.status || item.progress || '').toLowerCase();
  return status !== 'finished' && !status.startsWith('finished');
}

function buildStandingCard(s) {
  const card = el('article', 'st-card');

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

  const actions = el('div', 'cta card-cta');
  const btn = el('a', 'btn card-btn', 'FULL STANDINGS →');
  btn.href = s.standingsUrl || s.url || 'https://paddock.worldsimseries.com/';
  btn.target = '_blank';
  btn.rel = 'noopener';
  actions.append(btn);
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

  observeReveals(container);
}

async function loadStandings() {
  const container = $('#stList');
  if (!container) return;

  try {
    const data = await fetchStandingsData();
    ALL_STANDINGS = Array.isArray(data) ? data : (data.events || data.standings || data.series || []);

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

    const actions = el('div', 'cta card-cta');
    const readBtn = el('button', 'btn primary card-btn', 'READ ARTICLE →');
    readBtn.type = 'button';
    readBtn.onclick = () => openBlogReader(post);
    actions.append(readBtn);

    body.append(metaRow, title, excerpt, actions);
    card.append(thumb, body);
    grid.append(card);
  });

  observeReveals(grid);

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
async function fetchYouTubeVideos(explicitId) {
  const proxies = [
    url => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
    url => `https://corsproxy.io/?${encodeURIComponent(url)}`
  ];

  let channelId = explicitId;
  if (!channelId) {
    for (const makeProxy of proxies) {
      try {
        const res = await fetch(makeProxy('https://www.youtube.com/@AMKRacingOrganisation'));
        if (!res.ok) continue;
        const html = await res.text();
        const match = html.match(/"channelId":"(UC[\w-]{22})"/) || html.match(/channel_id=(UC[\w-]{22})/);
        if (match) {
          channelId = match[1];
          break;
        }
      } catch (e) {}
    }
  }

  if (!channelId) return [];

  const feedParam = channelId.startsWith('UU') || channelId.startsWith('PL')
    ? `playlist_id=${channelId}`
    : `channel_id=${channelId}`;
  const rawRss = `https://www.youtube.com/feeds/videos.xml?${feedParam}`;

  try {
    const apiRes = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rawRss)}`);
    const apiData = await apiRes.json();
    if (apiData && Array.isArray(apiData.items) && apiData.items.length) {
      return apiData.items.map(item => ({
        title: item.title,
        url: item.link,
        thumbnail: item.thumbnail,
        published: item.pubDate
      }));
    }
  } catch (e) {}

  for (const makeProxy of proxies) {
    try {
      const res = await fetch(makeProxy(rawRss));
      if (!res.ok) continue;
      const text = await res.text();
      const xml = new DOMParser().parseFromString(text, 'text/xml');
      const entries = Array.from(xml.querySelectorAll('entry'));
      if (entries.length) {
        return entries.map(entry => {
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

  return [];
}

async function loadSocials() {
  const ytGrid = $('#ytGrid');
  if (ytGrid) {
    let videos = [];

    try {
      const localRes = await fetch('data/youtube.json', { cache: 'no-store' });
      if (localRes.ok) {
        const d = await localRes.json();
        videos = Array.isArray(d) ? d : (d.videos || d.items || []);
      }
    } catch (e) {
      videos = [];
    }

    if (!videos.length) {
      const explicitId = (ytGrid.dataset.channelId || ytGrid.dataset.playlistId || '').trim();
      videos = await fetchYouTubeVideos(explicitId);
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
    observeReveals(ytGrid);
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
    observeReveals(igGrid);
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
    observeReveals(timeline);
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
    observeReveals(faqList);
  }
}

/* ====== Initialize Active Page Modules ====== */
loadEvents();
loadStandings();
loadBlog();
loadSocials();
loadAbout();
