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
function createRectFlag(flagOrCode) {
  const raw = String(flagOrCode || '').trim();
  if (!raw) return null;

  // Convert Regional Indicator Flag Emoji (e.g. 🇱🇻, 🇫🇷) to ISO 2-letter code
  const chars = Array.from(raw);
  let iso = '';
  if (
    chars.length === 2 &&
    chars.every(c => {
      const cp = c.codePointAt(0);
      return cp >= 0x1F1E6 && cp <= 0x1F1FF;
    })
  ) {
    iso = chars.map(c => String.fromCharCode(c.codePointAt(0) - 0x1F1E6 + 97)).join('');
  } else if (/^[a-zA-Z]{2}$/.test(raw)) {
    iso = raw.toLowerCase();
  }

  if (iso) {
    const img = document.createElement('img');
    img.className = 'rect-flag';
    img.src = `https://flagcdn.com/w40/${iso}.png`;
    img.alt = iso.toUpperCase();
    img.loading = 'lazy';
    return img;
  }

  return el('span', 'st-flag-text', raw);
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

async function loadEvents() {
  const listEl = $('#eventList');
  if (!listEl) return;

  let events = [];
  try {
    const res = await fetch('data/events.json', { cache: 'no-store' });
    const data = await res.json();
    events = Array.isArray(data) ? data : (data.events || []);
  } catch (e) {
    events = [];
  }

  const now = Date.now();
  const upcoming = events
    .filter(ev => {
      const t = new Date(ev.date || ev.start || 0).getTime();
      return !Number.isNaN(t) && t >= now - 3600 * 1000;
    })
    .sort((a, b) => new Date(a.date || a.start) - new Date(b.date || b.start));

  listEl.textContent = '';
  if (!upcoming.length) {
    listEl.append(el('p', 'muted', 'No upcoming races scheduled right now. Check World Sim Series for new rounds.'));
    return;
  }

  const countdownNodes = [];

  upcoming.forEach((ev, idx) => {
    const card = el('article', 'card');
    card.append(el('span', 'badge', idx === 0 ? 'Next race' : 'Upcoming'));
    card.append(el('h3', null, ev.title || ev.name || 'AMKRO Event'));

    const startMs = new Date(ev.date || ev.start).getTime();
    if (!Number.isNaN(startMs)) {
      const dateText = new Date(startMs).toLocaleString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
      card.append(el('p', 'muted', dateText));

      const cd = el('div', 'countdown', formatCountdown(startMs - Date.now()));
      card.append(cd);
      countdownNodes.push({ el: cd, target: startMs });
    }

    const actions = el('div', 'cta');
    const link = el('a', 'btn', 'GO TO THE RACE →');
    link.href = ev.url || 'https://paddock.worldsimseries.com/';
    link.target = '_blank';
    link.rel = 'noopener';
    actions.append(link);
    card.append(actions);

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

/* ====== Series Standings (Ongoing & Finished, 3-Card Limit + Dropdown) ====== */
let ALL_STANDINGS = [];
let stQuery = '';
let stFilter = 'ALL';
let showAllOngoing = false;
let showAllFinished = false;

function isOngoingSeries(item) {
  const status = String(item.status || item.badge || '').toUpperCase();
  if (status.includes('FINISH') || status.includes('COMPLETED') || status.includes('ENDED')) {
    return false;
  }
  return true;
}

function buildStandingCard(s) {
  const card = el('article', 'st-card');

  const banner = el('div', 'st-banner');
  if (s.banner || s.image) {
    banner.style.backgroundImage = `url("${s.banner || s.image}")`;
  }
  card.append(banner);

  const body = el('div', 'st-body');
  const badgeText = s.status || (isOngoingSeries(s) ? 'IN PROGRESS' : 'FINISHED');
  body.append(el('span', 'st-series', badgeText));
  body.append(el('h3', null, s.series || s.title || 'AMKRO Series'));

  if (s.meta || s.updated) {
    body.append(el('div', 'st-meta', s.meta || s.updated));
  }

  const podium = Array.isArray(s.podium) ? s.podium : (Array.isArray(s.top3) ? s.top3 : []);
  if (podium.length) {
    const ul = el('ul', 'st-podium');
    podium.slice(0, 3).forEach((row, idx) => {
      const li = el('li');
      li.append(el('span', 'st-pos', row.pos || `P${idx + 1}`));

      const driverWrap = el('span', 'st-driver');
      const flagNode = createRectFlag(row.flag || row.country);
      if (flagNode) driverWrap.append(flagNode);
      driverWrap.append(el('span', null, row.driver || row.name || 'TBD'));
      li.append(driverWrap);

      const ptsVal = row.points !== undefined ? `${row.points} pts` : (row.pts || '');
      li.append(el('span', 'st-pts', ptsVal));
      ul.append(li);
    });
    body.append(ul);
  } else {
    body.append(el('p', 'muted', 'Standings update after Round 1.'));
  }

  const actions = el('div', 'cta');
  const btn = el('a', 'btn', 'FULL STANDINGS →');
  btn.href = s.url || 'https://paddock.worldsimseries.com/';
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

    const podiumText = (item.podium || item.top3 || [])
      .map(p => `${p.driver || ''} ${p.name || ''}`)
      .join(' ');
    const hay = `${item.series || ''} ${item.title || ''} ${item.status || ''} ${podiumText}`.toLowerCase();
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
    const res = await fetch('data/standings.json', { cache: 'no-store' });
    const data = await res.json();
    ALL_STANDINGS = Array.isArray(data) ? data : (data.standings || data.series || []);

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

/* ====== Socials Page: YouTube & Instagram ====== */
async function loadSocials() {
  const ytGrid = $('#ytGrid');
  if (ytGrid) {
    try {
      const data = await (await fetch('data/youtube.json', { cache: 'no-store' })).json();
      const videos = Array.isArray(data) ? data : (data.videos || data.items || []);
      ytGrid.textContent = '';
      if (!videos.length) {
        ytGrid.append(el('p', 'muted', 'Visit our YouTube channel for live race broadcasts and highlights.'));
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
    } catch (e) {
      ytGrid.textContent = '';
      ytGrid.append(el('p', 'muted', 'Watch live race streams and replays on @AMKRacingOrganisation.'));
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
