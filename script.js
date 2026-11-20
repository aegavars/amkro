'use strict';

const CONFIG = {
  nextRace: nextThursdayAt(20, 0),
  raceDurationHours: 3,
  youtubeChannelUrl: 'https://www.youtube.com/@AMKRacingOrganisation',
  youtubeChannelId: '', // Optional: paste your UC... channel ID here for automatic live RSS fallback
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

/* ====== YouTube (3 Most Recent Uploads + Subscribe Button) ====== */
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

function renderYouTubeVideos(vids, grid){
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

  // 1. Try loading from data/youtube.json
  try{
    const data = await (await fetch('data/youtube.json',{cache:'no-store'})).json();
    if(data.channelUrl) channelUrl = data.channelUrl;
    if(data.channelId) channelId = data.channelId;
    const list = Array.isArray(data) ? data : (data.videos || data.items || []);
    vids = list.filter(v => extractYtId(v));
  }catch(e){}

  // 2. If data/youtube.json has no videos yet and a channelId is known, fetch live RSS feed
  if(!vids.length && channelId){
    try{
      const rss = encodeURIComponent('https://www.youtube.com/feeds/videos.xml?channel_id=' + channelId);
      const res = await (await fetch('https://api.rss2json.com/v1/api.json?rss_url=' + rss)).json();
      if(res && Array.isArray(res.items)){
        vids = res.items.slice(0,3).map(it => ({
          id: extractYtId(it.link || it.guid),
          title: it.title,
          published: it.pubDate
        })).filter(v => v.id);
      }
    }catch(e){}
  }

  if(subBtn && channelUrl){
    subBtn.href = channelUrl.includes('?') ? channelUrl : channelUrl + '?sub_confirmation=1';
  }

  if(vids.length){
    renderYouTubeVideos(vids, grid);
  } else {
    grid.textContent='';
    const fallback = el('p','muted','No videos loaded yet — visit the AMK Racing Organisation YouTube channel to watch the latest uploads.');
    grid.append(fallback);
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

/* ====== Series standings (data/standings.json) ====== */
let ST = [], stStatus = 'all', stQuery = '';
function renderStandings(){
  const box = $('#stList'); if(!box) return; box.textContent = '';
  const list = ST.filter(e => (stStatus==='all' || e.status===stStatus) &&
                              (e.name+' '+(e.series||'')).toLowerCase().includes(stQuery));
  if(!list.length){ box.textContent = ST.length ? 'No series match your search.' : 'No events loaded yet.'; return; }
  list.forEach(e=>{
    const d = el('details','st');
    const sum = el('summary');
    const th = el('div','st-thumb'); if(e.thumbnail) th.style.backgroundImage = `url("${e.thumbnail}")`;
    const nm = el('div','st-name', e.name); if(e.date) nm.append(el('small',null,e.date));
    const tag = el('span','tag'+(e.status==='finished'?' off':''), e.status==='finished'?'Finished':'Current');
    sum.append(th,nm,tag);
    const body = el('div','st-body');
    const links = el('div','cta');
    const a = el('a','btn primary','Results & standings →'); a.href=e.standingsUrl||e.url; a.target='_blank'; a.rel='noopener';
    const b = el('a','btn','Event page'); b.href=e.url; b.target='_blank'; b.rel='noopener';
    links.append(a,b); body.append(links);
    (e.tables||[]).forEach(t=>{
      if(t.title) body.append(el('h4',null,t.title));
      const wrap = el('div','st-scroll'); const tb = el('table');
      t.rows.forEach((r,i)=>{
        const tr = el('tr');
        r.forEach(c=>tr.append(el(i===0?'th':'td',null,c)));
        tb.append(tr);
      });
      wrap.append(tb); body.append(wrap);
    });
    if(!(e.tables||[]).length) body.append(e.text ? el('pre',null,e.text) : el('p','muted','Standings are not available yet. Use the button above.'));
    d.append(sum,body); box.append(d);
  });
}
function renderStChips(){
  const c = $('#stChips'); if(!c) return; c.textContent = '';
  [['all','All'],['current','Current'],['finished','Finished']].forEach(([k,l])=>{
    const b = el('button','chip'+(stStatus===k?' on':''),l);
    b.onclick = ()=>{stStatus=k; renderStChips(); renderStandings();}; c.append(b);
  });
}
if($('#stSearch')) $('#stSearch').addEventListener('input', e=>{stQuery = e.target.value.trim().toLowerCase(); renderStandings();});
async function loadStandings(){
  try{
    const data = await (await fetch('data/standings.json',{cache:'no-store'})).json();
    ST = data.events || [];
    if(data.updated && $('#stUpdated')) $('#stUpdated').textContent = 'Updated ' + new Date(data.updated).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'}) + '.';
  }catch(e){ ST = []; }
  renderStChips(); renderStandings();
}

/* ====== Initialize feeds ====== */
loadEvents();
loadInstagram();
loadYouTube();
loadStandings();
setInterval(tickEvents, 1000);
tickEvents();
