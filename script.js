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
  $('#eventCd').textContent = now>end ? 'Race finished' : txt;
  $('#eventCdLabel').textContent = live ? 'Racing right now, ends in' : (now>end ? 'Result' : 'Starts in');
}

/* ====== events (events.json, copied from the Paddock event page) ====== */
function renderEvent(){
  if(!EVENT) return;
  const dt = new Date(EVENT.start);
  $('#eventName').textContent = EVENT.name;
  $('#eventDate').textContent = dt.toLocaleString(undefined,{dateStyle:'full',timeStyle:'short'});
  $('#eventDesc').textContent = EVENT.description || '';
  $('#eventLink').href = EVENT.url;
  $('#eventThumb').href = EVENT.url;
  if(EVENT.thumbnail) $('#eventThumb').style.backgroundImage = `url("${EVENT.thumbnail}")`;
  const past = Date.now() > dt.getTime() + (EVENT.durationHours||CONFIG.raceDurationHours)*3600e3;
  $('#eventTag').textContent = past ? 'Most recent race' : 'Next race';
}
async function loadEvents(){
  try{
    const r = await fetch('events.json',{cache:'no-store'});
    const data = await r.json();
    const list = (data.events||[]).slice().sort((a,b)=>new Date(a.start)-new Date(b.start));
    const now = Date.now();
    EVENT = list.find(e=>new Date(e.start).getTime()+(e.durationHours||CONFIG.raceDurationHours)*3600e3>=now) || list[list.length-1] || null;
    renderEvent(); tick();
    const posts = data.instagramPosts||[];
    posts.forEach(p=>{
      const a=document.createElement('a'); a.href=p.url; a.target='_blank'; a.rel='noopener';
      const img=document.createElement('img'); img.src=p.image; img.alt=p.caption||'Instagram post'; img.loading='lazy';
      a.append(img); $('#igPosts').append(a);
    });
  }catch(e){
    $('#eventName').textContent='Open the Paddock for the latest race';
  }
}
loadEvents();
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
