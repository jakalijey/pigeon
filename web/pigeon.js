const poly = (pts, f) => `<polygon points="${pts}" fill="${f}"/>`;
const TONES = {
  day: { a: '#FFFDF7', b: '#E8DFCC', c: '#CFC3AA', g: '#FC8702', k: '#1F2348' },
  night: { a: '#F4ECDC', b: '#CFC6E6', c: '#A39BC6', g: '#FF9A2E', k: '#1F2348' },
};
// night = the choice made by tapping the moon/sun (data-tema), else the phone's own setting
export const isNight = () => { const t = document.documentElement.dataset.tema; return t ? t === 'gece' : matchMedia('(prefers-color-scheme: dark)').matches; };
export const tone = () => (isNight() ? TONES.night : TONES.day);

export function perched(r = tone()) {
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
${poly('6,52 22,58 30,72 10,66', r.c)}${poly('22,58 56,40 80,50 62,72 30,72', r.a)}${poly('30,72 62,72 52,80 40,80', r.b)}
${poly('36,56 54,16 66,48', r.a)}${poly('36,56 66,48 58,62', r.b)}${poly('68,26 84,30 82,50 70,48', r.a)}${poly('70,48 82,50 76,56', r.b)}
${poly('84,32 95,37 84,40', r.g)}<circle cx="77" cy="35" r="2.4" fill="${r.k}"/>
<path d="M44 80l-2 9M54 80l2 9" stroke="${r.g}" stroke-width="2.6" stroke-linecap="round"/></svg>`;
}

export function flying(r = tone(), letter = true) {
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
${poly('4,46 22,52 26,64 8,62', r.c)}${poly('22,52 58,44 80,50 60,64 28,64', r.a)}
${poly('36,50 30,6 62,46', r.a)}${poly('36,50 62,46 48,58', r.b)}${poly('42,58 70,92 58,56', r.b)}
${poly('70,34 86,38 84,54 72,52', r.a)}${poly('86,40 97,45 86,48', r.g)}<circle cx="79" cy="43" r="2.2" fill="${r.k}"/>
${letter ? `<g transform="translate(40 66) rotate(-8)"><rect width="22" height="15" rx="1.5" fill="${r.a}" stroke="${r.c}"/><path d="M0 0l11 9 11-9" fill="none" stroke="${r.c}" stroke-width="1.4"/><circle cx="11" cy="10" r="3" fill="#D94432"/></g>` : ''}</svg>`;
}

export function logo() {
  const inner = flying({ a: '#FFFDF7', b: '#F3E3CC', c: '#E2CBA8', g: '#1F2348', k: '#1F2348' }).replace(/<\/?svg[^>]*>/g, '');
  return `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="6" width="108" height="108" rx="30" fill="#FC8702"/><g transform="translate(14 12) scale(.92)">${inner}</g></svg>`;
}

let stampSeq = 0;
export function postmark(top, lines, color) {
  const id = 'pm' + stampSeq++;
  return `<svg viewBox="0 0 130 130"><defs><path id="${id}" d="M65 65 m-46 0 a46 46 0 1 1 92 0 a46 46 0 1 1 -92 0"/></defs>
<g fill="none" stroke="${color}" stroke-width="3"><circle cx="65" cy="65" r="58"/><circle cx="65" cy="65" r="36"/></g>
<text font-family="Segoe UI,system-ui" font-weight="800" font-size="12" letter-spacing="3" fill="${color}"><textPath href="#${id}">${top}</textPath></text>
<text x="65" y="${lines[1] ? 62 : 70}" text-anchor="middle" font-family="Segoe UI,system-ui" font-weight="800" font-size="16" fill="${color}">${lines[0]}</text>
${lines[1] ? `<text x="65" y="80" text-anchor="middle" font-family="Segoe UI,system-ui" font-weight="700" font-size="11" fill="${color}">${lines[1]}</text>` : ''}
<path d="M4 50 h20 M4 58 h22 M4 66 h20 M106 64 h20 M104 72 h22 M106 80 h20" stroke="${color}" stroke-width="2.4"/></svg>`;
}
