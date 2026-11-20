'use strict';
/* ====== EDIT ME: team content ====== */
const CONFIG = {
  // Set to an ISO date string to drive the countdown. If it is in the past the site shows "racing now" for 3 hours.
  nextRace: nextThursdayAt(20, 0),
  raceDurationHours: 3,
};

const ENTRIES = [
  ['SLIPSTREAM','Rookie','Tucking in behind another car to save fuel and gain speed on the straight.'],
  ['TRACK LIMITS','Rookie','Four wheels over the white line and the stewards will let you know about it.'],
  ['BOX BOX','Rookie','Radio call for "come into the pits this lap".'],
  ['UNDERCUT','Club','Pitting earlier than your rival to gain time on fresh tyres.'],
  ['OVERCUT','Club','Staying out longer than your rival and hoping the track stays fast.'],
  ['FORMATION LAP','Club','The slow lap before the start. Do not pass the pole sitter.'],
  ['SAFETY RATING','Club','The number that tells everyone how often you hit things.'],
  ['LATE BRAKER','Pro','Someone who dive-bombs every corner. Usually ends up in the gravel.'],
  ['FUEL SAVE','Pro','Lifting and coasting early to make the stint last.'],
  ['SETUP SHEET','Pro','A spreadsheet that took longer to make than the race.'],
  ['THE SPA INCIDENT','Elite','Nobody talks about Eau Rouge in the team Discord. Ever.'],
  ['BRAKE BIAS','Elite','Fiddled with so often that nobody remembers the default.'],
  ['24H OF THE LONG NIGHT','Legend','The endurance race that finished at sunrise with three drivers and one working headset.'],
  ['THE DISCONNECT','Legend','The server dropped at lap 2 of the final. We still bring it up.'],
  ['THE GOLDEN TROPHY','Champion','Season champions of the league. It sits on the shelf. Do not touch it.'],
];
const TIERS = ['All','Rookie','Club','Pro','Elite','Legend','Champion'];

const RADIO = [
  ['Nova','BOX BOX BOX'],['Kris','tyres are gone'],['Milo','who left the mic open?'],
  ['Ana','P3, close the gap!'],['Dex','fuel is fine, trust me'],['Rin','yellow in sector 2'],
  ['Nova','pit window opens in 2'],['Kris','he divebombed me again'],['Milo','GOLDEN LAP'],
  ['Ana','is the stream on?'],['Dex','copy copy'],['Rin','lag, sorry'],['Nova','LETS GOOOO'],
];

const SOUNDS = [
  ['BOX BOX',[880,660]],['DRS OPEN',[440,880]],['FASTEST LAP',[523,659,784]],
  ['YELLOW FLAG',[330,330]],['ENGINE CUT',[220,110]],['CHEQUERED',[784,784,988]],
];

const TIMELINE = [
  ['JAN 2023','Team founded','A few friends, one Discord server, one league.'],
  ['APR 2023','First league win','Our first podium on the road to the title.'],
  ['SEP 2023','Endurance debut','First 6-hour race. Survived.'],
  ['FEB 2024','New liveries','The red-and-white colours arrive.'],
  ['JUL 2024','24-hour finish','Completed a full 24 hours with the whole squad.'],
  ['JAN 2025','Roster expands','More drivers, more cars, more chaos.'],
  ['OCT 2025','Season champions','Team championship secured.'],
  ['NOV 2026','This website','You are looking at it.'],
];

const VAULT = ['Photo finish','Livery v2','Pit crew chaos','Spa rain','Night stint','Podium shot','Onboard clip','Setup meme','Gravel trap','Trophy day','Start grid','Last lap'];

const DRIVERS = [
  ['Driver One','Team captain, strategy and setups.','Champion'],
  ['Driver Two','Qualifying specialist.','Pro'],
  ['Driver Three','Endurance anchor, never lifts.','Elite'],
  ['Driver Four','Rookie of the year.','Rookie'],
];

const FAQ = [
  ['Who is AMKRO?','A sim racing team. Replace this with your own team story.'],
  ['What do you race?','League nights and endurance events. Put your sims and series here.'],
  ['How do I join?','Open the Discord, introduce yourself and join a practice night.'],
  ['Do I need a wheel?','A wheel and pedals help, but a controller is fine to start.'],
  ['When are race nights?','Every Thursday at 20:00 local time. See the countdown at the top.'],
  ['What is a rejuicer?','Nothing here. We call it a pit stop.'],
];

const QUOTES = [
  ['"Box box, I am not boxing."','Team driver, lap 42'],
  ['"Fuel is fine."','Famous last words'],
  ['"Who turned the lights off?"','Night stint, 3 a.m.'],
];

const CLUES = [
  ['Italian, prancing horse, V12 screaming.','ferrari'],
  ['German, Stuttgart, 911 in the name.','porsche'],
  ['Japanese, rotary engine, Le Mans 1991.','mazda'],
  ['British, McLaren F1 GTR success, Woking.','mclaren'],
  ['Italian, raging bull logo.','lamborghini'],
];

const TRACKS = ['Spa-Francorchamps','Nürburgring Nordschleife','Monza','Suzuka','Silverstone','Interlagos','Laguna Seca','Mount Panorama','Road Atlanta','Imola','Brands Hatch','Zandvoort'];

const QUIZ = [
  ['What does "box" mean on team radio?',['Pit this lap','Brake harder','Slow down'],0],
  ['Which flag means danger ahead?',['Green','Yellow','Blue'],1],
  ['What is an undercut?',['Pitting earlier','Staying out late','Changing driver'],0],
];

/* ====== helpers ====== */
const $ = s => document.querySelector(s);
const pad = n => String(n).padStart(2,'0');
function nextThursdayAt(h,m){
  const d = new Date(); d.setHours(h,m,0,0);
  const add = (4 - d.getDay() + 7) % 7;
  d.setDate(d.getDate()+add);
  if (d < new Date() && add===0) {/* today but passed */}
  return d.toISOString();
}
function parseLap(s){
  const m = /^\s*(?:(\d+):)?(\d+(?:\.\d+)?)\s*$/.exec(s||'');
  if(!m) return NaN;
  return (m[1]?+m[1]*60:0)+ +m[2];
}
function fmtLap(t){
  const m = Math.floor(t/60), s = (t-m*60).toFixed(3);
  return m+':'+(s.length<6?'0':'')+s;
}

/* ====== live status & countdown ====== */
let EVENT = null; // set by loadEvents()
function tick(){
  const start = new Date(EVENT ? EVENT.start : CONFIG.nextRace).getTime();
  const end = start + (EVENT && EVENT.durationHours ? EVENT.durationHours : CONFIG.raceDurationHours)*3600e3;
  const now = Date.now();
  const live = now>=start && now<=end;
  const pill = $('#livePill');
  pill.classList.toggle('off', !live);
  pill.textContent = live ? 'Live now' : 'Offline';
  $('#answer').textContent = live ? 'YES.' : 'NOPE.';
  $('#sub').textContent = live ? '*pit stop in progress*' : '*back in the garage*';
  $('#chatTag').textContent = live ? 'Live' : 'Offline';
  $('#chatTag').classList.toggle('off', !live);
  $('#cdLabel').textContent = live ? 'Racing right now' : 'Next race in';
  let diff = live ? end-now : Math.max(0,start-now);
  const d = Math.floor(diff/864e5); diff-=d*864e5;
  const h = Math.floor(diff/36e5); diff-=h*36e5;
  const mi = Math.floor(diff/6e4); diff-=mi*6e4;
  const s = Math.floor(diff/1e3);
  const txt = `${pad(d)} days : ${pad(h)} hrs : ${pad(mi)} min : ${pad(s)} sec`;
  $('#countdown').textContent = txt;
  tickEvents();
}

/* ====== events (data/events.json, written by scripts/update_events.py) ====== */
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
    if(now>end){label.textContent='Result'; cd.textContent='Race finished';}
    else if(now>=start){label.textContent='Racing right now, ends in'; cd.textContent=fmtCd(end-now);}
    else {label.textContent='Starts in'; cd.textContent=fmtCd(start-now);}
  });
}
function renderEvents(){
  const box=$('#eventList'); box.textContent='';
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
  try{
    const data = await (await fetch('data/events.json',{cache:'no-store'})).json();
    const all = (data.events||[]).slice().sort((a,b)=>new Date(a.start)-new Date(b.start));
    const now = Date.now();
    const upcoming = all.filter(e=>new Date(e.start).getTime()+evDur(e)>=now).slice(0,3);
    LIST = upcoming.length ? upcoming : all.slice(-1);   // nothing upcoming: show the most recent one
    EVENT = LIST[0] || null;
    if(!LIST.length){$('#eventList').textContent='No races scheduled yet. Check the Paddock.'; return;}
    renderEvents(); tick();
  }catch(e){
    $('#eventList').textContent='Open the Paddock for the latest races.';
  }
}
loadEvents();

/* ====== Instagram (data/instagram.json, dark cards: profile header + latest post) ====== */
const fmtNum = n => (n===null||n===undefined||n==='') ? '–' : Number(n).toLocaleString('en');
function el(tag, cls, text){const e=document.createElement(tag); if(cls)e.className=cls; if(text!==undefined)e.textContent=text; return e;}
async function loadInstagram(){
  const grid=$('#igGrid');
  try{
    const data=await (await fetch('data/instagram.json',{cache:'no-store'})).json();
    grid.textContent='';
    (data.accounts||[]).forEach(acc=>{
      const profileUrl='https://www.instagram.com/'+acc.handle+'/';
      const col=el('div','ig-col');

      // profile header
      const head=el('div','ig-card ig-profile');
      const av=el('div','ig-avatar');
      if(acc.avatar){const i=el('img');i.src=acc.avatar;i.alt='';av.append(i);} else av.textContent=(acc.name||acc.handle).charAt(0);
      const info=el('div','ig-info');
      const h=el('a','ig-handle','@'+acc.handle); h.href=profileUrl; h.target='_blank'; h.rel='noopener';
      const nm=el('div','ig-name',acc.name||'');
      const stats=el('div','ig-stats');
      [['posts',acc.posts],['followers',acc.followers],['following',acc.following]].forEach(([l,v])=>{
        const s=el('span'); const b=el('b',null,fmtNum(v)); s.append(b,document.createTextNode(' '+l)); stats.append(s);
      });
      info.append(h,nm,stats);
      if(acc.bio) info.append(el('p','ig-bio',acc.bio));
      const follow=el('a','btn ig-btn','Follow'); follow.href=profileUrl; follow.target='_blank'; follow.rel='noopener';
      head.append(av,info,follow);

      // latest post
      const post=el('a','ig-card ig-post');
      const L=acc.latest||{};
      post.href=L.url||profileUrl; post.target='_blank'; post.rel='noopener';
      const cap=el('div','ig-label', acc.key==='organizer' ? 'Latest announcement' : 'Latest post');
      post.append(cap);
      if(L.image){const i=el('img');i.src=L.image;i.alt=L.caption||'Latest Instagram post';i.loading='lazy';post.append(i);}
      else post.append(el('div','ig-empty','Open on Instagram'));
      if(L.caption) post.append(el('p','ig-caption',L.caption));
      if(L.date) post.append(el('small','ig-date',L.date));

      col.append(head,post); grid.append(col);
    });
  }catch(e){
    grid.textContent='';
    [['teamamkro','Team AMKRO'],['amkracingorganization','AMK Racing Organization']].forEach(([h,n])=>{
      const a=el('a','btn','@'+h+' on Instagram'); a.href='https://www.instagram.com/'+h+'/'; a.target='_blank'; a.rel='noopener'; grid.append(a);
    });
  }
}
loadInstagram();

/* ====== YouTube (data/youtube.json: latest 3 regular videos, no Shorts) ====== */
async function loadYouTube(){
  try{
    const data=await (await fetch('data/youtube.json',{cache:'no-store'})).json();
    const vids=(data.videos||[]).slice(0,3);
    if(!vids.length) return; // keep the fallback playlist embed from index.html
    const grid=$('#ytGrid'); grid.textContent='';
    vids.forEach(v=>{
      if(!/^[\w-]{11}$/.test(v.id||'')) return;
      const item=el('div','yt-item');
      const wrap=el('div','yt');
      const f=el('iframe'); f.title=v.title||'YouTube video'; f.loading='lazy'; f.allowFullscreen=true;
      f.src='https://www.youtube-nocookie.com/embed/'+v.id;
      wrap.append(f);
      const t=el('a','yt-title',v.title||''); t.href='https://www.youtube.com/watch?v='+v.id; t.target='_blank'; t.rel='noopener';
      item.append(wrap,t);
      if(v.published) item.append(el('small','muted',new Date(v.published).toLocaleDateString(undefined,{dateStyle:'medium'})));
      grid.append(item);
    });
  }catch(e){/* keep fallback embed */}
}
loadYouTube();
setInterval(tick,1000); tick();

/* ====== team radio feed ====== */
let radioIdx = 0;
function pushRadio(){
  const ul = $('#chatList');
  const [who,msg] = RADIO[radioIdx++ % RADIO.length];
  const li = document.createElement('li');
  const b = document.createElement('b'); b.textContent = who;
  li.append(b, document.createTextNode(msg));
  ul.append(li);
  while(ul.children.length>12) ul.firstChild.remove();
}
for(let i=0;i<8;i++) pushRadio();
setInterval(pushRadio,2200);

/* ====== racepedia ====== */
let tier = 'All', q = '';
function renderChips(){
  const c = $('#chips'); c.textContent='';
  TIERS.forEach(t=>{
    const b=document.createElement('button'); b.className='chip'+(t===tier?' on':''); b.textContent = t==='All'?'Depth: All':t;
    b.onclick=()=>{tier=t;renderChips();renderCards();}; c.append(b);
  });
}
function renderCards(){
  const box = $('#cards'); box.textContent='';
  ENTRIES.filter(([n,t,d])=>(tier==='All'||t===tier)&&(n+d).toLowerCase().includes(q)).forEach(([n,t,d])=>{
    const a=document.createElement('article'); a.className='card tier-'+t.toLowerCase();
    const h=document.createElement('h3'); h.textContent=n+' ';
    const sm=document.createElement('small'); sm.textContent='('+t+')'; h.append(sm);
    const p=document.createElement('p'); p.textContent=d;
    a.append(h,p); box.append(a);
  });
  if(!box.children.length) box.textContent='Nothing found. Yet.';
}
$('#search').addEventListener('input',e=>{q=e.target.value.trim().toLowerCase();renderCards();});
renderChips(); renderCards();

/* ====== tools ====== */
$('#lapBtn').onclick=()=>{
  const a=parseLap($('#lapA').value), b=parseLap($('#lapB').value);
  $('#lapOut').textContent = (isNaN(a)||isNaN(b)) ? 'Use format 1:32.450' :
    `Gap: ${(a-b>=0?'+':'-')+Math.abs(a-b).toFixed(3)}s (${fmtLap(a)} vs ${fmtLap(b)})`;
};
$('#fuelBtn').onclick=()=>{
  const mins=+$('#fRace').value, lap=parseLap($('#fLap').value), use=+$('#fUse').value;
  if(!mins||!lap||!use){$('#fuelOut').textContent='Fill in all fields';return;}
  const laps=Math.ceil(mins*60/lap)+1;
  $('#fuelOut').textContent=`${laps} laps, ${(laps*use).toFixed(1)} L`;
};
$('#spinBtn').onclick=()=>{
  let n=0; const out=$('#spinOut');
  const iv=setInterval(()=>{out.textContent=TRACKS[Math.floor(Math.random()*TRACKS.length)];if(++n>14)clearInterval(iv);},80);
};
let qi=0,score=0;
function showQ(){
  const box=$('#quiz'); box.textContent='';
  if(qi>=QUIZ.length){
    const pct=Math.round(score/QUIZ.length*100);
    $('#quizOut').textContent=pct+'% AMKRO'; qi=0; score=0; return;
  }
  const [text,opts,right]=QUIZ[qi];
  const p=document.createElement('p'); p.className='q'; p.textContent=text; box.append(p);
  opts.forEach((o,i)=>{const b=document.createElement('button');b.className='btn';b.textContent=o;
    b.onclick=()=>{if(i===right)score++;qi++;showQ();};box.append(b);});
}
$('#quizBtn').onclick=()=>{qi=0;score=0;showQ();};
let clueI=0;
function newClue(){clueI=Math.floor(Math.random()*CLUES.length);$('#clue').textContent=CLUES[clueI][0];$('#guess').value='';}
$('#guessBtn').onclick=()=>{
  const g=$('#guess').value.trim().toLowerCase();
  if(!g)return;
  const ok=g===CLUES[clueI][1];
  $('#guessOut').textContent=ok?'Correct!':'Nope, it was '+CLUES[clueI][1];
  if(ok)setTimeout(()=>{newClue();$('#guessOut').textContent='';},1200);
};
newClue();
(function(){
  const m=$('#meter'); const counts=[['LOL',92],['BOX',74],['???',55],['GG',41],['F',30]];
  counts.forEach(([n,v])=>{const li=document.createElement('li');li.textContent=n+' '+v+'%';
    const bar=document.createElement('span');bar.className='bar';bar.style.width=v+'%';li.append(bar);m.append(li);});
})();

/* ====== soundboard (WebAudio beeps) ====== */
let ctx;
function playTones(freqs){
  ctx = ctx || new (window.AudioContext||window.webkitAudioContext)();
  freqs.forEach((f,i)=>{
    const o=ctx.createOscillator(), g=ctx.createGain();
    o.type='square'; o.frequency.value=f;
    g.gain.setValueAtTime(.001,ctx.currentTime+i*.18);
    g.gain.exponentialRampToValueAtTime(.15,ctx.currentTime+i*.18+.02);
    g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+i*.18+.16);
    o.connect(g).connect(ctx.destination);
    o.start(ctx.currentTime+i*.18); o.stop(ctx.currentTime+i*.18+.17);
  });
}
SOUNDS.forEach(([name,f],i)=>{
  const b=document.createElement('button'); b.className='sound';
  const k=document.createElement('kbd'); k.textContent=i+1;
  b.append(k,document.createTextNode(name)); b.onclick=()=>playTones(f);
  $('#soundGrid').append(b);
});
document.addEventListener('keydown',e=>{
  if(/input|textarea/i.test(document.activeElement.tagName))return;
  const i=+e.key-1; if(SOUNDS[i]) playTones(SOUNDS[i][1]);
});

/* ====== timeline, vault, drivers, faq, quotes ====== */
TIMELINE.forEach(([d,t,p])=>{
  const li=document.createElement('li');
  const a=document.createElement('div');a.className='date';a.textContent=d;
  const h=document.createElement('h3');h.textContent=t;
  const pp=document.createElement('p');pp.textContent=p;
  li.append(a,h,pp);$('#timeline').append(li);
});
$('#vaultCount').textContent=VAULT.length;
VAULT.forEach((n,i)=>{
  const f=document.createElement('figure');
  const ph=document.createElement('div');ph.className='ph';
  ph.style.background=`hsl(${(i*37)%360} 55% 42%)`;ph.textContent='#'+pad(i+1);
  const c=document.createElement('figcaption');c.textContent=n;
  f.append(ph,c);$('#vaultGrid').append(f);
});
DRIVERS.forEach(([n,d,t])=>{
  const a=document.createElement('article');a.className='card tier-'+t.toLowerCase();
  const h=document.createElement('h3');h.textContent=n;
  const p=document.createElement('p');p.textContent=d;
  a.append(h,p);$('#driverGrid').append(a);
});
FAQ.forEach(([q,a])=>{
  const d=document.createElement('details');
  const s=document.createElement('summary');s.textContent=q;
  const p=document.createElement('p');p.textContent=a;
  d.append(s,p);$('#faqList').append(d);
});
QUOTES.forEach(([t,c])=>{
  const b=document.createElement('blockquote');
  const p=document.createElement('p');p.textContent=t;
  const ci=document.createElement('cite');ci.textContent=c;
  b.append(p,ci);$('#quotes').append(b);
});

/* ====== chrome ====== */
$('#year').textContent=new Date().getFullYear();
$('#menuBtn').onclick=e=>{const o=$('#nav').classList.toggle('open');e.currentTarget.setAttribute('aria-expanded',o);};
document.querySelectorAll('#nav a').forEach(a=>a.addEventListener('click',()=>$('#nav').classList.remove('open')));
const toTop=$('#toTop');
addEventListener('scroll',()=>toTop.classList.toggle('show',scrollY>600),{passive:true});
toTop.onclick=()=>scrollTo({top:0});


/* ====== Series standings (data/standings.json, written by scripts/update_standings.py) ====== */
let ST = [], stStatus = 'all', stQuery = '';
function renderStandings(){
  const box = $('#stList'); box.textContent = '';
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
  const c = $('#stChips'); c.textContent = '';
  [['all','All'],['current','Current'],['finished','Finished']].forEach(([k,l])=>{
    const b = el('button','chip'+(stStatus===k?' on':''),l);
    b.onclick = ()=>{stStatus=k; renderStChips(); renderStandings();}; c.append(b);
  });
}
$('#stSearch').addEventListener('input', e=>{stQuery = e.target.value.trim().toLowerCase(); renderStandings();});
async function loadStandings(){
  try{
    const data = await (await fetch('data/standings.json',{cache:'no-store'})).json();
    ST = data.events || [];
    if(data.updated) $('#stUpdated').textContent = 'Updated ' + new Date(data.updated).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'}) + '.';
  }catch(e){ ST = []; }
  renderStChips(); renderStandings();
}
loadStandings();
