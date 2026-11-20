'use strict';

const CONFIG = {
  nextRace: nextThursdayAt(20, 0),
  raceDurationHours: 3,
  youtubeChannelUrl: 'https://www.youtube.com/@AMKRacingOrganisation',
  youtubeChannelId: 'UC-6zSmuerT4LvwzCy7MLNFA',
};

const TIMELINE = [
  ['JAN 2023','Team founded','A few friends, one Discord server, one league.'],
  ['APR 2023','First league win','Our first podium on the road to the title.'],
  ['SEP 2023','Endurance debut','First 6-hour race. Survived.'],
  ['FEB 2024','New liveries','The burgundy, black and white colours arrive.'],
  ['JUL 2024','24-hour finish','Completed a full 24 hours with the whole squad.'],
  ['JAN 2025','Roster expands','More drivers, more cars, more chaos.'],
  ['OCT 2025','Season champions','Team championship secured.'],
  ['NOV 2026','This website','You are looking at it.'],
];

const FAQ = [
  ['Who is AMKRO?','AMK Racing Organization — a sim racing organization and team.'],
  ['What do you race?','League nights and endurance events across Assetto Corsa and WSS.'],
  ['How do I join?','Open the Discord, introduce yourself and join a practice night.'],
  ['Do I need a wheel?','A wheel and pedals help, but a controller is fine to start.'],
  ['When are race nights?','Check the Upcoming Races schedule above for all live and scheduled events.'],
  ['What is a rejuicer?','Nothing here. We call it a pit stop.'],
];

/* ====== helpers ====== */
const $ = s => document.querySelector(s);
const pad = n => String(n).padStart(2,'0');
function nextThursdayAt(h,m){
  const d = new Date(); d.setHours(h,m,0,0);
  const add = (4 - d.getDay() + 7) % 7;
  d.setDate(d.getDate()+add);
  return d.toISOString();
}
function el(tag, cls, text){
  const e=document.createElement(tag);
  if(cls) e.className=cls;
  if(text!==undefined) e.textContent=text;
  return e;
}

/* ====== event countdowns ====== */
let LIST = [];
const evDur = e => (e.durationHours||CONFIG.raceDurationHours)*3600e3;

function fmtCd(ms){
  const d=Math.floor(ms/864e5); ms-=d*864e5;
  const h=Math.floor(ms/36e5); ms-=h*36e5;
  const m=Math.floor(ms/6e4); ms-=m*6e4;
  return `${pad(d)} days : ${pad(h)} hrs : ${pad(m)} min : ${pad(Math.floor(ms/1e3))} sec`;
}

function tickEvents(){
  const now=Date.now();
  document.querySelectorAll('.event').forEach((card,i)=>{
    const e=LIST[i]; if(!e) return;
    const start=new Date(e.start).getTime(), end=start+evDur(e);
    const label=card.querySelector('.ev-label'), cd=card.querySelector('.ev-cd');
    if(!label || !cd) return;
    if(now>end){label.textContent='Result'; cd.textContent='Race finished';}
    else if(now>=start){label.textContent='Racing right now, ends in'; cd.textContent=fmtCd(end-now);}
    else {label.textContent='Starts in'; cd.textContent=fmtCd(start-now);}
  });
}

function renderEvents(){
  const box=$('#eventList');
  if(!box) return;
  box.textContent='';
  LIST.forEach((e,i)=>{
    const past=Date.now()>new Date(e.start).getTime()+evDur(e);
    const art=el('article','event');
    const thumb=el('a','event-thumb'); thumb.href=e.url; thumb.target='_blank'; thumb.rel='noopener'; thumb.setAttribute('aria-label','Open race page');
    if(e.thumbnail) thumb.style.backgroundImage=`url("${e.thumbnail}")`;
    const body=el('div','event-body');
    body.append(el('span','tag'+(i?' off':''), past?'Most recent race':(i===0?'Next race':'Upcoming')));
    body.append(el('h3',null,e.name));
    body.append(el('p','muted',new Date(e.start).toLocaleString(undefined,{dateStyle:'full',timeStyle:'short'})));
    if(e.description) body.append(el('p','muted',e.description));
    const c=el('div','countdown'); c.append(el('span','label ev-label'), el('span','ev-cd'));
    const cta=el('div','cta'); const go=el('a','btn primary','Go to the race →'); go.href=e.url; go.target='_blank'; go.rel='noopener'; cta.append(go);
    body.append(c,cta);
    art.append(thumb,body); box.append(art);
  });
}

async function loadEvents(){
  const box = $('#eventList');
  try{
    const res = await fetch('data/events.json',{cache:'no-store'});
    const data = await res.json();
    const all = (data.events||[]).slice().sort((a,b)=>new Date(a.start)-new Date(b.start));
    const now = Date.now();
    const upcoming = all.filter(e=>new Date(e.start).getTime()+evDur(e)>=now);
    LIST = upcoming.length ? upcoming : all.slice(-1);
    if(!LIST.length){ if(box) box.textContent='No races scheduled yet. Check the Paddock.'; return; }
    renderEvents();
    tickEvents();
  }catch(e){
    if(box) box.textContent='Open the Paddock for the latest races.';
  }
}

/* ====== Instagram (Normal Embeds) ====== */
async function loadInstagram(){
  const grid=$('#igGrid');
  if(!grid) return;

  const handles = ['amkracingorganization', 'teamamkro'];
  grid.textContent='';

  handles.forEach(handle=>{
    const wrap = el('div','ig-embed-wrap');
    const frame = el('iframe');
    frame.src = 'https://www.instagram.com/' + handle + '/embed/';
    frame.title = '@' + handle + ' Instagram feed';
    frame.loading = 'lazy';
    frame.setAttribute('scrolling','no');
    frame.setAttribute('allowtransparency','true');
    wrap.append(frame);
    grid.append(wrap);
  });
}

/* ====== YouTube (3-Card Grid) ====== */
function extractYtId(v){
  if(!v) return '';
  if(typeof v === 'string'){
    if(/^[\w-]{11}$/.test(v)) return v;
    const m = /(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/.exec(v);
    return m ? m[1] : '';
  }
  const raw = v.id || v.videoId || v.url || v.link || '';
  if(/^[\w-]{11}$/.test(raw)) return raw;
  const m = /(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/.exec(raw);
  return m ? m[1] : '';
}

function parseYouTubeXml(xmlText){
  const xml = new DOMParser().parseFromString(xmlText, 'text/xml');
  const entries = Array.from(xml.querySelectorAll('entry')).slice(0,3);
  return entries.map(entry => {
    const vidNode = entry.getElementsByTagName('yt:videoId')[0] || entry.getElementsByTagName('videoId')[0];
    const titleNode = entry.querySelector('title');
    const pubNode = entry.querySelector('published');
    return {
      id: vidNode ? vidNode.textContent.trim() : '',
      title: titleNode ? titleNode.textContent.trim() : '',
      published: pubNode ? pubNode.textContent.trim() : ''
    };
  }).filter(v => extractYtId(v));
}

async function fetchLiveYouTubeFeed(channelId){
  if(!channelId || !channelId.startsWith('UC')) return [];
  const feedUrl = 'https://www.youtube.com/feeds/videos.xml?channel_id=' + encodeURIComponent(channelId);
  const endpoints = [
    async () => {
      const r = await fetch('https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(feedUrl));
      const list = parseYouTubeXml(await r.text());
      if(!list.length) throw new Error('empty');
      return list;
    },
    async () => {
      const r = await fetch('https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(feedUrl));
      const d = await r.json();
      if(!d || !Array.isArray(d.items) || !d.items.length) throw new Error('empty');
      return d.items.slice(0,3).map(it => ({
        id: extractYtId(it.link || it.guid),
        title: it.title,
        published: it.pubDate
      })).filter(v => v.id);
    }
  ];
  for(const fn of endpoints){
    try{
      const res = await fn();
      if(res && res.length) return res;
    }catch(e){}
  }
  return [];
}

function renderYouTubeCards(vids, grid){
  grid.textContent='';
  vids.slice(0,3).forEach(v=>{
    const vid = extractYtId(v);
    if(!vid) return;
    const item=el('div','yt-item');
    const wrap=el('div','yt');
    const f=el('iframe');
    f.title=v.title||'YouTube video';
    f.loading='lazy';
    f.allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
    f.allowFullscreen=true;
    f.src='https://www.youtube-nocookie.com/embed/'+vid;
    wrap.append(f);
    const t=el('a','yt-title',v.title||'Watch on YouTube');
    t.href='https://www.youtube.com/watch?v='+vid;
    t.target='_blank';
    t.rel='noopener';
    item.append(wrap,t);
    const pub = v.published || v.pubDate || v.date;
    if(pub) item.append(el('small','muted',new Date(pub).toLocaleDateString(undefined,{dateStyle:'medium'})));
    grid.append(item);
  });
}

async function loadYouTube(){
  const grid=$('#ytGrid');
  const subBtn=$('#ytSubBtn');
  if(!grid) return;

  let vids = [];
  let channelUrl = CONFIG.youtubeChannelUrl;
  let channelId = CONFIG.youtubeChannelId;

  try{
    const data = await (await fetch('data/youtube.json',{cache:'no-store'})).json();
    if(data.channelUrl) channelUrl = data.channelUrl;
    if(data.channelId && data.channelId.startsWith('UC')) channelId = data.channelId;
    const list = Array.isArray(data) ? data : (data.videos || data.items || []);
    vids = list.filter(v => extractYtId(v));
  }catch(e){}

  if(subBtn && channelUrl){
    subBtn.href = channelUrl.includes('?') ? channelUrl : channelUrl + '?sub_confirmation=1';
  }

  const liveVids = await fetchLiveYouTubeFeed(channelId);
  if(liveVids.length) vids = liveVids;

  if(vids.length){
    renderYouTubeCards(vids, grid);
  } else {
    grid.textContent='';
    grid.append(el('p','muted','Visit the AMK Racing Organisation YouTube channel to watch the latest uploads.'));
  }
}

/* ====== timeline & faq ====== */
if($('#timeline')) TIMELINE.forEach(([d,t,p])=>{
  const li=document.createElement('li');
  const a=document.createElement('div');a.className='date';a.textContent=d;
  const h=document.createElement('h3');h.textContent=t;
  const pp=document.createElement('p');pp.textContent=p;
  li.append(a,h,pp);$('#timeline').append(li);
});

if($('#faqList')) FAQ.forEach(([q,a])=>{
  const d=document.createElement('details');
  const s=document.createElement('summary');s.textContent=q;
  const p=document.createElement('p');p.textContent=a;
  d.append(s,p);$('#faqList').append(d);
});

/* ====== chrome ====== */
if($('#year')) $('#year').textContent=new Date().getFullYear();
if($('#menuBtn')) $('#menuBtn').onclick=e=>{const o=$('#nav').classList.toggle('open');e.currentTarget.setAttribute('aria-expanded',o);};
document.querySelectorAll('#nav a').forEach(a=>a.addEventListener('click',()=>$('#nav').classList.remove('open')));
const toTop=$('#toTop');
if(toTop){
  addEventListener('scroll',()=>toTop.classList.toggle('show',scrollY>600),{passive:true});
  toTop.onclick=()=>scrollTo({top:0});
}

/* ====== Series Standings (Finished Events + Thumbnails + Top 3 + Flags + N. Surname + Full Standings Link) ====== */
let ST = [], stQuery = '';

function formatDriverShort(raw){
  const clean = String(raw || '').trim().replace(/\s+/g, ' ');
  if(!clean) return 'Unknown Driver';
  const parts = clean.split(' ');
  if(parts.length === 1) return parts[0];
  return parts[0][0].toUpperCase() + '. ' + parts.slice(1).join(' ');
}

function countryCodeToFlag(code){
  const c = String(code || '').replace(/[^A-Za-z]/g, '').toUpperCase();
  if(c.length !== 2) return '';
  return String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65, 0x1F1E6 + c.charCodeAt(1) - 65);
}

function getEventTop3(e){
  if(Array.isArray(e.top3) && e.top3.length){
    return e.top3.slice(0, 3).map((d, idx) => ({
      pos: d.position || (idx + 1),
      flag: d.flag || countryCodeToFlag(d.countryCode || d.country),
      name: d.name ? (d.name.includes('.') ? d.name : formatDriverShort(d.name)) : formatDriverShort(d.fullName),
      points: d.points
    }));
  }
  // Fallback if older tables format exists in standings.json
  if(Array.isArray(e.tables) && e.tables.length && Array.isArray(e.tables[0].rows)){
    const rows = e.tables[0].rows.slice(1, 4);
    return rows.map((r, idx) => ({
      pos: idx + 1,
      flag: '',
      name: formatDriverShort(r[1] || r[0] || ''),
      points: r[r.length - 1] || ''
    }));
  }
  return [];
}

function renderStandings(){
  const box = $('#stList');
  if(!box) return;
  box.textContent = '';

  const finished = ST.filter(e => !e.status || e.status === 'finished');
  const list = finished.filter(e =>
    (e.name + ' ' + (e.series || '') + ' ' + (e.top3 || []).map(d => d.name).join(' '))
      .toLowerCase()
      .includes(stQuery)
  );

  if(!list.length){
    box.textContent = finished.length ? 'No finished series match your search.' : 'No finished events loaded yet.';
    return;
  }

  list.forEach(e => {
    const card = el('article', 'st-card');

    const thumbLink = el('a', 'st-card-thumb');
    const standingsHref = e.standingsUrl || (e.id ? `https://paddock.worldsimseries.com/events/${e.id}/standings#/` : e.url);
    thumbLink.href = standingsHref;
    thumbLink.target = '_blank';
    thumbLink.rel = 'noopener';
    thumbLink.setAttribute('aria-label', 'Open full standings for ' + e.name);
    if(e.thumbnail) thumbLink.style.backgroundImage = `url("${e.thumbnail}")`;

    const body = el('div', 'st-card-body');

    const head = el('div', 'st-card-head');
    const titleWrap = el('div', 'st-card-title');
    if(e.series) titleWrap.append(el('span', 'st-series', e.series));
    titleWrap.append(el('h3', null, e.name));
    if(e.date) titleWrap.append(el('small', 'muted', e.date));
    head.append(titleWrap);
    body.append(head);

    const top3 = getEventTop3(e);
    const podium = el('ol', 'st-podium');
    if(top3.length){
      top3.forEach((d, idx) => {
        const li = el('li', 'podium-row p' + (idx + 1));
        const pos = el('span', 'podium-pos', 'P' + (idx + 1));
        const flag = el('span', 'podium-flag', d.flag || '🏁');
        const driver = el('span', 'podium-driver', d.name);
        li.append(pos, flag, driver);
        if(d.points !== undefined && d.points !== null && d.points !== ''){
          li.append(el('span', 'podium-pts', String(d.points) + ' pts'));
        }
        podium.append(li);
      });
    } else {
      const empty = el('li', 'podium-row');
      empty.append(el('span', 'muted', 'Podium results available on full standings page.'));
      podium.append(empty);
    }
    body.append(podium);

    const actions = el('div', 'cta');
    const fullBtn = el('a', 'btn primary', 'Full standings →');
    fullBtn.href = standingsHref;
    fullBtn.target = '_blank';
    fullBtn.rel = 'noopener';
    actions.append(fullBtn);
    body.append(actions);

    card.append(thumbLink, body);
    box.append(card);
  });
}

if($('#stSearch')){
  $('#stSearch').addEventListener('input', e => {
    stQuery = e.target.value.trim().toLowerCase();
    renderStandings();
  });
}

async function loadStandings(){
  const chips = $('#stChips');
  if(chips) chips.style.display = 'none';
  try{
    const data = await (await fetch('data/standings.json', {cache: 'no-store'})).json();
    ST = data.events || [];
    if(data.updated && $('#stUpdated')){
      $('#stUpdated').textContent = 'Updated ' + new Date(data.updated).toLocaleString(undefined, {dateStyle: 'medium', timeStyle: 'short'}) + '.';
    }
  }catch(e){
    ST = [];
  }
  renderStandings();
}

/* ====== Initialize feeds ====== */
loadEvents();
loadInstagram();
loadYouTube();
loadStandings();
setInterval(tickEvents, 1000);
tickEvents();
