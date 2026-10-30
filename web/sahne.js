// Desktop backdrop: a classic school drawing (house, barn, a child skipping rope, sheep, a stream). Only on wide screens (app.css .sahne).
// At night the child walks home and the sheep to the barn; birds leave, fireflies come out; the sun or moon shines in the stream.
// All CSS transitions/animations plus a little SMIL; no JS loop.

// git = where it walks at night (in the sheep's own scale)
const koyun = (x, y, s, gecikme, ters, gx, gy) => `
<g transform="translate(${x} ${y}) scale(${ters ? -s : s} ${s})"><g class="sh-git" style="--gx:${gx}px;--gy:${gy}px;transition-delay:${-gecikme * 0.2}s">
<g class="sh-koyun" style="animation-delay:${gecikme}s">
  <g class="sh-bacak"><line x1="-22" y1="16" x2="-23" y2="38"/><line x1="-6" y1="18" x2="-6" y2="40"/><line x1="10" y1="18" x2="10" y2="40"/><line x1="25" y1="16" x2="26" y2="38"/></g>
  <path class="sh-yun" d="M-38 4C-47-12-29-27-16-22C-10-37 14-35 18-24C33-31 50-15 41 0C52 13 37 28 24 22C15 33-9 31-15 24C-32 31-48 16-38 4Z"/>
  <g class="sh-kafa" style="animation-delay:${gecikme * 2}s"><ellipse cx="50" cy="-7" rx="14" ry="10"/><path d="M41-15 35-22" stroke-width="5"/><circle cx="54" cy="-10" r="2.4" class="sh-goz"/></g>
</g></g></g>`;

const cicek = (x, y, renk, i) => `
<g class="sh-cicek" style="animation-delay:${-i * 0.41}s">
  <path d="M${x} ${y}C${x - 3} ${y - 12} ${x + 3} ${y - 19} ${x} ${y - 30}" class="sh-sap"/>
  ${i % 2
    ? [0, 1, 2, 3, 4, 5].map((k) => `<circle cx="${(x + Math.cos(k * 1.047) * 7).toFixed(1)}" cy="${(y - 34 + Math.sin(k * 1.047) * 7).toFixed(1)}" r="5" class="sh-papatya"/>`).join('') + `<circle cx="${x}" cy="${y - 34}" r="5" fill="${renk}"/>`
    : `<path d="M${x - 9} ${y - 30}V${y - 44}l5 7 4-9 4 9 5-7V${y - 30}q-9 8-18 0Z" fill="${renk}"/>`}
</g>`;

// barn: red body, white cross-braced door
const ahir = (x, y) => `
<g transform="translate(${x} ${y})">
  <path class="sh-ahir" d="M0 30 36 0 72 30V86H0Z"/>
  <path class="sh-ahirdam" d="M-6 33 36-4 78 33" />
  <rect class="sh-ahirkapi" x="22" y="48" width="28" height="38"/>
  <path class="sh-ahircizgi" d="M22 48 50 86M50 48 22 86"/>
</g>`;

const ates = (pts) => pts.map(([x, y], i) => `<circle class="sh-ates" cx="${x}" cy="${y}" r="2.6" style="animation-delay:${(-i * 0.7).toFixed(1)}s"/>`).join('');

const ROPE = ['M-30-50Q0-198 30-50', 'M-30-50Q0-67 30-50', 'M-30-50Q0 64 30-50', 'M-30-50Q0-67 30-50', 'M-30-50Q0-198 30-50'].join(';');
const ip = (on) => `<path class="sh-ip" d="M-30-50Q0-198 30-50"><animate attributeName="d" dur="1.1s" repeatCount="indefinite" values="${ROPE}" keyTimes="0;.25;.5;.75;1"/>`
  + `<animate attributeName="opacity" dur="1.1s" repeatCount="indefinite" calcMode="discrete" values="${on ? '1;0' : '0;1'}" keyTimes="0;.5"/></path>`;

const kus = (top, sure, gecikme, olcek) => `<i class="sh-kus" style="top:${top}%;animation-duration:${sure}s;animation-delay:${gecikme}s"><svg viewBox="0 0 48 16" style="width:${Math.round(34 * olcek)}px"><path d="M2 12Q13 1 24 12Q35 1 46 12"/></svg></i>`;

export function sahneHTML() {
  return `<div class="sh-gok" aria-hidden="true">${kus(14, 46, -6, 1)}${kus(22, 58, -30, 0.75)}${kus(9, 64, -48, 0.6)}</div>
<div class="sahne" aria-hidden="true">
<svg class="sh-tepe" viewBox="0 0 1000 380" preserveAspectRatio="none">
  <path class="sh-turkuaz" d="M0 54C160 46 330 64 520 50 700 38 880 60 1000 48V92C880 100 700 84 520 94 330 104 160 86 0 96Z"/>
  <path class="sh-cim2" d="M0 84C180 74 360 98 540 86 720 74 880 92 1000 82V380H0Z"/>
  <path class="sh-cim1" d="M0 190C220 150 420 210 620 180 800 154 920 186 1000 170V380H0Z"/>
</svg>

<svg class="sh-sol" viewBox="0 0 660 380" preserveAspectRatio="xMinYMax meet">
  <path class="sh-yol" d="M128 290C118 320 160 340 150 362 146 372 140 378 138 380H186C190 370 196 360 198 350 206 326 168 312 162 290Z"/>
  <rect class="sh-baca" x="190" y="104" width="24" height="50" rx="3"/>
  <circle class="sh-duman" cx="202" cy="96" r="9"/><circle class="sh-duman" cx="202" cy="96" r="9" style="animation-delay:-1.4s"/><circle class="sh-duman" cx="202" cy="96" r="9" style="animation-delay:-2.8s"/>
  <rect class="sh-duvar" x="60" y="170" width="170" height="122" rx="4"/>
  <path class="sh-cati" d="M40 176 145 92 250 176Z"/>
  <rect class="sh-kapi" x="128" y="230" width="34" height="62" rx="15"/>
  <circle cx="153" cy="262" r="3" fill="#F6C344"/>
  <g class="sh-cam"><rect x="78" y="192" width="36" height="34" rx="4"/><rect x="176" y="192" width="36" height="34" rx="4"/></g>
  <g class="sh-cerceve"><path d="M96 192V226M78 209H114M194 192V226M176 209H212"/></g>

  <rect class="sh-govde" x="292" y="186" width="18" height="110" rx="6"/>
  <path class="sh-yaprak" d="M300 96C258 92 246 132 258 152 240 172 264 204 298 194 322 210 356 192 350 168 372 150 356 112 332 114 326 96 310 92 300 96Z"/>
  <g fill="#E8574A"><circle cx="280" cy="136" r="6.5"/><circle cx="320" cy="126" r="6.5"/><circle cx="336" cy="162" r="6.5"/><circle cx="292" cy="178" r="6.5"/><circle cx="308" cy="152" r="6"/></g>

  ${ahir(574, 210)}

  <g transform="translate(410 322) scale(1.05)"><g class="sh-git sh-cocuk" style="--gx:-252px;--gy:-30px">
    <g><animateTransform attributeName="transform" type="translate" dur="1.1s" repeatCount="indefinite" values="0 0;0 -4;0 -16;0 -4;0 0" keyTimes="0;.25;.5;.75;1"/>
      ${ip(false)}
      <g class="sh-bacak"><line x1="-6" y1="-30" x2="-9" y2="0"/><line x1="6" y1="-30" x2="9" y2="0"/></g>
      <g fill="#D94432"><ellipse cx="-11" cy="1" rx="7" ry="3.5"/><ellipse cx="11" cy="1" rx="7" ry="3.5"/></g>
      <path d="M-22-28 0-74 22-28Z" fill="#F08BB4"/>
      <g class="sh-kol"><line x1="-7" y1="-62" x2="-30" y2="-50"/><line x1="7" y1="-62" x2="30" y2="-50"/></g>
      <circle cx="0" cy="-90" r="16" fill="#F6CDA6"/>
      <path d="M-16-94C-16-112 16-112 16-94 10-103-9-105-16-94Z" fill="#7A4A22"/>
      <g stroke="#7A4A22" stroke-width="4.5" stroke-linecap="round"><line x1="-15" y1="-96" x2="-27" y2="-83"/><line x1="15" y1="-96" x2="27" y2="-83"/></g>
      <g fill="#1F2348"><circle cx="-5.5" cy="-92" r="2.2"/><circle cx="5.5" cy="-92" r="2.2"/></g>
      <path d="M-6-83Q0-78 6-83" fill="none" stroke="#C0392B" stroke-width="2.5" stroke-linecap="round"/>
      ${ip(true)}
    </g>
  </g></g>

  ${koyun(520, 300, 0.95, -0.3, false, 72, -4)}
  ${koyun(450, 350, 0.8, -1.2, false, 180, -60)}
  ${[[30, 330, '#E8574A'], [250, 340, '#F6C344'], [340, 365, '#B57CF0'], [640, 362, '#E8574A'], [380, 250, '#F08BB4']].map(([x, y, r], i) => cicek(x, y, r, i)).join('')}
  ${ates([[60, 320], [270, 250], [360, 300], [470, 280], [560, 340], [620, 260], [200, 350]])}
</svg>

<svg class="sh-sag" viewBox="0 0 560 380" preserveAspectRatio="xMaxYMax meet">
  <defs><clipPath id="sh-dere"><path d="M338 68C296 140 386 192 304 262 262 300 236 340 224 380H560V250C470 200 404 150 368 66Z"/></clipPath></defs>
  <path class="sh-su" d="M338 68C296 140 386 192 304 262 262 300 236 340 224 380H560V250C470 200 404 150 368 66Z"/>
  <g clip-path="url(#sh-dere)">
    <ellipse class="sh-yansima" cx="430" cy="210" rx="16" ry="70" transform="rotate(-24 430 210)"/>
    <g class="sh-parilti"><path d="M408 170h18"/><path d="M432 214h22" style="animation-delay:-.7s"/><path d="M414 250h16" style="animation-delay:-1.3s"/><path d="M446 286h20" style="animation-delay:-.4s"/></g>
  </g>
  <g class="sh-dalga"><path d="M346 96C334 126 368 152 350 182"/><path d="M380 190C352 226 370 252 320 290" style="animation-delay:-1s"/><path d="M430 250C392 286 360 320 330 370" style="animation-delay:-2s"/><path d="M500 270C470 310 450 340 440 380" style="animation-delay:-.6s"/></g>
  ${ahir(14, 214)}
  ${koyun(160, 300, 0.95, -2, true, 104, -4)}
  ${[[60, 350, '#F6C344'], [230, 250, '#E8574A'], [130, 240, '#F08BB4'], [250, 345, '#B57CF0']].map(([x, y, r], i) => cicek(x, y, r, i + 1)).join('')}
  ${ates([[110, 330], [200, 280], [40, 310], [250, 230]])}
</svg>
</div>`;
}
