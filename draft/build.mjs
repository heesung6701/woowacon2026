// <name>.md -> <name>.html (self-contained, no deps). Run: node draft/build.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const name = process.argv[2] || 'slides';
const md = readFileSync(join(dir, `${name}.md`), 'utf8');

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (s) =>
  esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[직접 질문\]\s*/g, '<span class="tag t-qa">직접 질문</span>')
    .replace(/\[내 생각\]\s*/g, '<span class="tag t-mine">내 생각</span>')
    .replace(/\[발표자 정리\]\s*/g, '<span class="tag t-sum">발표자 정리</span>')
    .replace(/\[(확인필요[^\]]*)\]/g, '<span class="tag t-warn">$1</span>');
// line source: untagged = talk content, [직접 질문] = asked speaker after the talk, [내 생각] = my own view
const cls = (t) => (/^\[직접 질문\]/.test(t) ? ' class="qa"' : /^\[내 생각\]/.test(t) ? ' class="mine"' : '');
const li = (t) => `<li${cls(t)}>${inline(t)}</li>`;
const para = (t) => `<p${cls(t)}>${inline(t)}</p>`;

function body(lines) {
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    if (l.startsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].startsWith('|')) rows.push(lines[i++]);
      const cells = (r) => r.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const [head, , ...rest] = rows;
      out.push(
        '<table><thead><tr>' + cells(head).map((c) => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>' +
          rest.map((r) => '<tr>' + cells(r).map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') +
          '</tbody></table>'
      );
    } else if (/^- /.test(l)) {
      const items = [];
      while (i < lines.length && /^- /.test(lines[i])) items.push(lines[i++].slice(2));
      out.push('<ul>' + items.map(li).join('') + '</ul>');
    } else if (/^\d+\. /.test(l)) {
      const items = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) items.push(lines[i++].replace(/^\d+\. /, ''));
      out.push('<ol>' + items.map(li).join('') + '</ol>');
    } else if (l.startsWith('>')) {
      const q = [];
      while (i < lines.length && lines[i].startsWith('>')) q.push(lines[i++].replace(/^>\s?/, ''));
      out.push(`<div class="callout">${q.map(inline).join('<br>')}</div>`);
    } else {
      out.push(para(l));
      i++;
    }
  }
  return out.join('\n');
}

// split on standalone --- ; first chunk is the doc preamble (title + legend), skip it
const chunks = md.split(/^---\s*$/m).slice(1);
const slides = [];
for (const chunk of chunks) {
  const lines = chunk.split('\n');
  const notes = [], refs = [], rest = [];
  let h1 = null, h2 = null;
  for (const l of lines) {
    if (/^# /.test(l)) h1 = l.slice(2).trim();
    else if (/^## /.test(l)) h2 = l.slice(3).trim();
    else if (l.startsWith('🎙')) notes.push(l.replace(/^🎙\s*/, ''));
    else if (l.startsWith('📷')) refs.push(l.replace(/^📷\s*/, ''));
    else rest.push(l);
  }
  if (!h1 && !h2) continue;
  const noteHtml =
    (notes.length ? `<h4>대본</h4>${notes.map(para).join('')}` : '') +
    (refs.length ? `<h4>근거 사진</h4>${refs.map((n) => `<p>${inline(n)}</p>`).join('')}` : '');
  if (h2 === null) {
    slides.push(`<section class="slide section"><h1>${inline(h1)}</h1><aside class="notes">${noteHtml}</aside></section>`);
    continue;
  }
  const m = h2.match(/^(\d+|[A-Z])\.\s+(?:\[(.+?)\]\s*)?(.*)$/);
  const [num, eyebrow, title] = m ? [m[1], m[2], m[3]] : ['', '', h2];
  const cover = num === '0';
  let coverTitle = title;
  if (cover) { // real title is the first bold line, not the "표지" heading
    const k = rest.findIndex((l) => /^\*\*.+\*\*$/.test(l.trim()));
    if (k >= 0) coverTitle = rest.splice(k, 1)[0].trim().replace(/^\*\*|\*\*$/g, '');
  }
  slides.push(
    `<section class="slide${cover ? ' cover' : ''}">` +
      (cover ? '' : `<div class="eyebrow">${eyebrow ? esc(eyebrow) : ''}</div>`) +
      `<h2>${inline(coverTitle)}</h2><div class="body">${body(rest)}</div>` +
      `<aside class="notes">${noteHtml}</aside></section>`
  );
}

// light palette applied by OS preference unless the viewer forced dark (T key)
const light =
  '--page:#e4ecea;--bg:#f7fbfa;--glow:#d3f0e9;--panel:#e6f2f0;--ink:#10201e;--muted:#4d6763;--accent:#0b8a78;--on-accent:#ffffff;' +
  '--warn:#8a5a00;--line:#c9dcd8;--memo:#f4b860;--memo-ink:#8a4f00;--mine:#ff8fb1;--mine-ink:#b0194b;--code-bg:#e3f0ee;--code-ink:#0b5e52;' +
  '--row:#eef6f4;--notes-bg:#ffffffee;--notes-ink:#1d302d;--help:#7a9893;--hud:#d5e3e0';
const css = `
:root{--page:#050e0d;--bg:#0a1a19;--glow:#123a36;--panel:#12302d;--ink:#eaf7f5;--muted:#9fbdb8;--accent:#3fe3cb;--on-accent:#06211e;
 --warn:#ffd166;--line:#24504b;--memo:#f4b860;--memo-ink:#f6dcb2;--mine:#ff8fb1;--mine-ink:#ffd3e0;--code-bg:#0e2523;--code-ink:#bff7ee;
 --row:#0d2623;--notes-bg:#06201dee;--notes-ink:#d7efeb;--help:#5d807b;--hud:#0e2321;color-scheme:dark}
@media (prefers-color-scheme:light){:root:not([data-theme="dark"]){${light};color-scheme:light}}
:root[data-theme="light"]{${light};color-scheme:light}
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;background:var(--page);color:var(--ink);overflow:hidden;
 font-family:"Pretendard","Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",system-ui,sans-serif}
#stage{position:absolute;left:50%;top:50%;width:1280px;height:720px;transform-origin:0 0;background:var(--bg);overflow:hidden}
.slide{position:absolute;inset:0;padding:44px 64px 56px;display:flex;flex-direction:column;visibility:hidden;opacity:0;
 transition:opacity .25s;background:radial-gradient(1200px 600px at 100% 0,var(--glow) 0,transparent 60%),var(--bg)}
.slide.on{visibility:visible;opacity:1}
.eyebrow{font-size:16px;letter-spacing:.04em;color:var(--accent);margin-bottom:8px;min-height:22px;display:flex;gap:12px;align-items:baseline}
.eyebrow b{display:inline-block;background:var(--accent);color:var(--on-accent);border-radius:6px;padding:1px 9px;font-size:14px}
h2{font-size:38px;line-height:1.25;font-weight:800;margin-bottom:18px;letter-spacing:-.01em}
.body{flex:1;overflow:hidden;font-size:28px;line-height:1.5;color:var(--ink)}
.body>*+*{margin-top:.5em}
ul,ol{padding-left:1.2em}li{margin:.3em 0}li::marker{color:var(--accent)}
strong{color:var(--accent);font-weight:700}
code{font-family:ui-monospace,"SF Mono",Menlo,monospace;font-size:.82em;background:var(--code-bg);border:1px solid var(--line);border-radius:5px;padding:0 .3em;color:var(--code-ink)}
.callout{background:var(--panel);border-left:4px solid var(--accent);border-radius:8px;padding:.6em .9em;color:var(--muted);font-size:.9em}
table{width:100%;border-collapse:collapse;font-size:.82em}
th{text-align:left;color:var(--accent);border-bottom:2px solid var(--accent);padding:.35em .6em}
td{padding:.38em .6em;border-bottom:1px solid var(--line);vertical-align:top}
tr:nth-child(even) td{background:var(--row)}
.tag{display:inline-block;font-size:.55em;font-weight:700;border-radius:5px;padding:.1em .55em;margin-right:.55em;vertical-align:.15em;white-space:nowrap}
.t-qa{background:var(--memo);color:#2b1d00}.t-mine{background:var(--mine);color:#3a0014}.t-sum{background:#3a5e8a;color:#e3efff}
.t-warn{background:transparent;color:var(--warn);border:1px solid var(--warn);white-space:normal}
.qa{color:var(--memo-ink)}li.qa::marker{color:var(--memo)}
.mine{color:var(--mine-ink)}li.mine::marker{color:var(--mine)}
.slide.cover{justify-content:center}.slide.cover h2{font-size:64px;line-height:1.2;margin-bottom:28px}
.slide.cover .body{flex:none;overflow:visible;font-size:26px;color:var(--muted)}
.slide.section{justify-content:center;align-items:center;text-align:center}
.slide.section h1{font-size:60px;font-weight:800;color:var(--accent);letter-spacing:-.01em}
.notes{display:none}
#hud{position:fixed;left:0;right:0;bottom:0;height:3px;background:var(--hud);z-index:5}
#bar{height:100%;width:0;background:var(--accent);transition:width .2s}
#count{position:fixed;right:14px;bottom:10px;font-size:13px;color:var(--muted);z-index:5;font-variant-numeric:tabular-nums}
#help{position:fixed;left:14px;bottom:10px;font-size:12px;color:var(--help);z-index:5}
#notes{position:fixed;left:0;right:0;bottom:0;max-height:38vh;overflow:auto;background:var(--notes-bg);border-top:2px solid var(--accent);
 padding:14px 28px 22px;font-size:17px;line-height:1.6;color:var(--notes-ink);z-index:9;display:none;backdrop-filter:blur(6px)}
#notes.on{display:block}#notes h4{color:var(--accent);font-size:13px;margin:.4em 0 .2em;letter-spacing:.06em}
#notes p{margin:.25em 0}
@media print{
 @page{size:1280px 720px;margin:0}
 html,body{overflow:visible;height:auto;background:#fff}
 #stage{position:static;transform:none!important;width:1280px;height:auto;overflow:visible}
 .slide{position:relative;visibility:visible;opacity:1;width:1280px;height:720px;page-break-after:always;-webkit-print-color-adjust:exact;print-color-adjust:exact}
 #hud,#count,#help,#notes{display:none!important}
}`;

const js = `
const stage=document.getElementById('stage');
const slides=[...stage.querySelectorAll('.slide')];
const notesEl=document.getElementById('notes');
let cur=0;
function scale(){const s=Math.min(innerWidth/1280,innerHeight/720);
 stage.style.transform='scale('+s+')';
 stage.style.marginLeft=(-640*s)+'px';stage.style.marginTop=(-360*s)+'px';}
// shrink body font until the slide body fits (dense v1 slides)
function fit(){slides.forEach(sl=>{const b=sl.querySelector('.body');if(!b||sl.classList.contains('cover'))return;
 let fs=sl.classList.contains('cover')?26:28;b.style.fontSize=fs+'px';
 while(b.scrollHeight>b.clientHeight+1&&fs>12){fs-=0.5;b.style.fontSize=fs+'px';}});}
// T toggles light/dark; choice kept per viewer (storage may be blocked)
function toggleTheme(){const r=document.documentElement;const dark=r.dataset.theme?r.dataset.theme==='dark':!matchMedia('(prefers-color-scheme: light)').matches;
 r.dataset.theme=dark?'light':'dark';try{localStorage.setItem('theme',r.dataset.theme)}catch(e){}}
function go(n){cur=Math.max(0,Math.min(slides.length-1,n));
 slides.forEach((s,i)=>s.classList.toggle('on',i===cur));
 document.getElementById('bar').style.width=((cur+1)/slides.length*100)+'%';
 document.getElementById('count').textContent=(cur+1)+' / '+slides.length;
 notesEl.innerHTML=slides[cur].querySelector('.notes').innerHTML;
 history.replaceState(null,'','#'+(cur+1));}
addEventListener('keydown',e=>{
 if(['ArrowRight','ArrowDown','PageDown',' ','Enter'].includes(e.key)){e.preventDefault();go(cur+1)}
 else if(['ArrowLeft','ArrowUp','PageUp','Backspace'].includes(e.key)){e.preventDefault();go(cur-1)}
 else if(e.key==='Home')go(0);else if(e.key==='End')go(slides.length-1);
 else if(e.key==='n'||e.key==='N')notesEl.classList.toggle('on'); else if(e.key==='t'||e.key==='T')toggleTheme(); else if(e.key==='f'||e.key==='F'){document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen()}});
stage.addEventListener('click',e=>{go(e.clientX<innerWidth/3?cur-1:cur+1)});
let tx=null;addEventListener('touchstart',e=>{tx=e.touches[0].clientX},{passive:true});
addEventListener('touchend',e=>{if(tx===null)return;const d=e.changedTouches[0].clientX-tx;if(Math.abs(d)>40)go(cur+(d<0?1:-1));tx=null});
addEventListener('resize',scale);
scale();(document.fonts&&document.fonts.ready||Promise.resolve()).then(()=>{fit();});fit();
go((parseInt(location.hash.slice(1))||1)-1);`;

const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>우아콘 2026 참석 공유</title>
<script>try{const t=localStorage.getItem('theme');if(t)document.documentElement.dataset.theme=t}catch(e){}</script>
<style>${css}</style>
</head>
<body>
<div id="stage">
${slides.join('\n')}
</div>
<div id="notes"></div>
<div id="hud"><div id="bar"></div></div>
<div id="help">← → 이동 · N 대본 · T 테마 · F 전체화면 · 표시 없음=발표 내용 · 주황=발표 후 직접 질문 · 분홍=내 생각</div>
<div id="count"></div>
<script>${js}</script>
</body>
</html>
`;
writeFileSync(join(dir, `${name}.html`), html);
console.log(`slides: ${slides.length} -> draft/${name}.html (${(html.length / 1024).toFixed(0)} KB)`);
