const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
let seq = 0;

export function ring({ name, identicon = '', serial = null, year = new Date().getFullYear() }) {
  const id = 'rg' + seq++;
  const label = (name + '.nim').toUpperCase();
  const n = label.length;
  const w = 320, h = 132, x = 20, y = 70;
  const fs = Math.max(8, Math.min(30, 206 / (n * 0.74)));
  const engrave = (attrs, body) => `<text ${attrs} fill="#5A3B00" filter="url(#${id}k)" font-family="Segoe UI, system-ui, sans-serif" font-weight="800">${body}</text>`;
  const half = Math.ceil(n / 2), f2 = Math.max(10, Math.min(30, 206 / (half * 0.74)));
  const nameText = n > 18
    ? engrave(`x="${x + 104}" y="${y + 52 + f2 * 0.2}" font-size="${f2.toFixed(1)}"`, esc(label.slice(0, half))) + engrave(`x="${x + 104}" y="${y + 52 + f2 * 1.25}" font-size="${f2.toFixed(1)}"`, esc(label.slice(half)))
    : engrave(`x="${x + 104}" y="${y + 48 + fs * 0.8}" font-size="${fs.toFixed(1)}" letter-spacing="${n < 10 ? 2 : 0}"`, esc(label));
  const face = identicon.replace(/<\/?svg[^>]*>/g, '').replace(/hexagon-clip-\d+/g, id + 'h');
  const svg = `<svg viewBox="0 0 360 300" xmlns="http://www.w3.org/2000/svg"><defs>
<linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7A5200"/><stop offset=".12" stop-color="#E9B213"/><stop offset=".3" stop-color="#FFF1B8"/><stop offset=".45" stop-color="#F6C64A"/><stop offset=".78" stop-color="#C89200"/><stop offset="1" stop-color="#6E4A00"/></linearGradient>
<linearGradient id="${id}p" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".85"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<filter id="${id}k" x="-5%" y="-30%" width="110%" height="160%"><feOffset in="SourceAlpha" dx="0" dy="1" result="o"/><feFlood flood-color="#FFF4C8" flood-opacity=".9"/><feComposite in2="o" operator="in" result="l"/><feMerge><feMergeNode in="l"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<clipPath id="${id}c"><rect data-r="cut" x="0" y="0" width="360" height="300"/></clipPath>
<clipPath id="${id}b"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16"/></clipPath>
<clipPath id="${id}d"><circle cx="${x + 54}" cy="${y + h / 2}" r="34"/></clipPath></defs>
<g data-r="leg"><rect x="160" y="10" width="40" height="290" rx="20" fill="#E07A00"/><rect x="160" y="10" width="14" height="290" rx="7" fill="#F59E0B" opacity=".6"/>
${[0, 1, 2, 3, 4, 5].map((i) => `<path d="M162 ${30 + i * 44} q18 8 36 0" stroke="#B85F00" stroke-width="2" fill="none" opacity=".5"/>`).join('')}</g>
<ellipse data-r="shadow" cx="180" cy="${y + h + 26}" rx="140" ry="14" fill="#000" opacity=".18"/>
<g data-r="ring">
<ellipse cx="${x + w / 2}" cy="${y}" rx="${w / 2}" ry="14" fill="#8A6000"/>
<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${id}s)"/>
<ellipse cx="${x + w / 2}" cy="${y + h}" rx="${w / 2}" ry="14" fill="#6E4A00"/>
<path d="M${x} ${y + 10} H${x + w} M${x} ${y + h - 10} H${x + w}" stroke="#FFF6D0" stroke-width="1.2" opacity=".55"/>
<g data-r="seal"><circle cx="${x + 54}" cy="${y + h / 2}" r="37" fill="#A87400"/><g clip-path="url(#${id}d)"><g transform="translate(${x + 20} ${y + h / 2 - 34}) scale(.425)">${face}</g></g>
<circle cx="${x + 54}" cy="${y + h / 2}" r="34" fill="none" stroke="#5A3B00" stroke-width="2.5" opacity=".6"/></g>
<g data-r="top">${engrave(`x="${x + 104}" y="${y + 34}" font-size="13" letter-spacing="4"`, `NIM · ${esc(year)}`)}</g>
${serial ? `<g data-r="bottom">${engrave(`x="${x + 104}" y="${y + h - 18}" font-size="13" letter-spacing="3"`, `№ ${String(serial).padStart(6, '0')}`)}</g>` : ''}
<g clip-path="url(#${id}c)">${nameText}</g>
<g clip-path="url(#${id}b)"><rect data-r="shine" x="-140" y="${y}" width="90" height="${h}" fill="url(#${id}p)" transform="skewX(-20)" opacity="0"/></g></g>
<g data-r="tip" opacity="0"><circle r="16" fill="#FFF6D0" opacity=".28"/><circle r="8" fill="#FFF6D0" opacity=".5"/><circle r="3.6" fill="#fff"/>${'<circle data-r="spark" r="1.6" fill="#FFE38A"/>'.repeat(5)}</g></svg>`;

  const END = 4400;
  const span = (t, a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));
  const out = (v) => 1 - Math.pow(1 - v, 3);
  const bounce = (v) => { const k = 7.5625, d = 2.75; if (v < 1 / d) return k * v * v; if (v < 2 / d) return k * (v -= 1.5 / d) * v + 0.75; if (v < 2.5 / d) return k * (v -= 2.25 / d) * v + 0.9375; return k * (v -= 2.625 / d) * v + 0.984375; };
  const back = (v) => { const c = 1.7; return 1 + (c + 1) * Math.pow(v - 1, 3) + c * Math.pow(v - 1, 2); };
  const textY = n > 18 ? y + 70 : y + 48 + fs * 0.45;

  function draw(root, t) {
    const q = (k) => root.querySelector(`[data-r="${k}"]`);
    const set = (el, k, v) => el && el.setAttribute(k, v);
    set(q('leg'), 'transform', `translate(0 ${(-320 * (1 - out(span(t, 0, 500)))).toFixed(1)})`);
    const r1 = span(t, 450, 1250);
    set(q('ring'), 'transform', `translate(0 ${(-260 * (1 - bounce(r1))).toFixed(1)})`); set(q('ring'), 'opacity', t < 450 ? 0 : 1);
    set(q('shadow'), 'opacity', 0.18 * bounce(r1)); set(q('shadow'), 'rx', 60 + 80 * bounce(r1));
    const m = span(t, 1250, 1550), mx = x + 54, my = y + h / 2;
    set(q('seal'), 'transform', `translate(${mx} ${my}) scale(${(m ? 1.6 - 0.6 * back(m) : 0).toFixed(3)}) translate(${-mx} ${-my})`);
    set(q('top'), 'opacity', span(t, 1550, 1750));
    const k = span(t, 1750, 3150), ux = x + 100 + 236 * k;
    set(q('cut'), 'width', k <= 0 ? 0 : k >= 1 ? 360 : ux);
    set(q('tip'), 'opacity', k > 0 && k < 1 ? 1 : 0);
    set(q('tip'), 'transform', `translate(${ux.toFixed(1)} ${(textY + Math.sin(t / 22) * 6).toFixed(1)})`);
    root.querySelectorAll('[data-r="spark"]').forEach((c, i) => { const f = (t / 90 + i * 0.2) % 1, a = -1.2 - i * 0.5;
      c.setAttribute('cx', (Math.cos(a) * 26 * f).toFixed(1)); c.setAttribute('cy', (Math.sin(a) * 26 * f + 30 * f * f).toFixed(1)); c.setAttribute('opacity', (1 - f).toFixed(2)); });
    set(q('bottom'), 'opacity', span(t, 3150, 3350));
    const p = span(t, 3350, 3950); set(q('shine'), 'x', -140 + 620 * p); set(q('shine'), 'opacity', p > 0 && p < 1 ? 1 : 0);
  }

  return {
    svg,
    still(root) { draw(root, END); },
    play(root) {
      return new Promise((done) => {
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) { draw(root, END); return done(); }
        const start = performance.now();
        const step = (now) => { const t = now - start; draw(root, Math.min(t, END)); if (t < END) requestAnimationFrame(step); else done(); };
        draw(root, 0); requestAnimationFrame(step);
      });
    },
  };
}
