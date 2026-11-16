/* PokéTeam — Roleta Premium (Pacote 04)
   Camada visual e de animação sobre o sistema de roleta existente (app-menu-v3.js).
   NÃO altera: o conjunto `roulette` (chaves pt_*), as chaves de variante, nem a regra de sorteio.
   A seleção continua sendo `Math.floor(Math.random() * entries.length)` — chances iguais para cada entrada.
   Esta camada apenas (1) desenha a roleta, (2) anima o giro até o setor sorteado, (3) mostra resultado e histórico. */
(() => {
  'use strict';
  const canvas = document.getElementById('wheel');
  const spinBtn = document.getElementById('spin');
  if (!canvas || !spinBtn || typeof drawWheel !== 'function' || typeof roulette === 'undefined') return;

  const $ = id => document.getElementById(id);
  const SIZE = 1000, C = SIZE / 2;
  const R_RING_OUT = 486, R_RING_IN = 436, R_SECTOR = 430, R_HUB = 74;
  const HISTORY_KEY = 'pt_rouletteHistory';        // chave nova e própria deste recurso; nenhuma chave pt_* existente é alterada
  const reduceMotion = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ---------- Identidade visual das variantes (cor = identificador, não raridade) ---------- */
  const VARIANTS = {
    n:    { label: 'Normal',       short: 'N',    c0: '#8a55ea', c1: '#3c1788', tagBg: '#5a2fb8', tagFg: '#ffffff' },   // roxo clássico
    n100: { label: '100% IV',      short: 'IV',   c0: '#5461f0', c1: '#232a82', tagBg: '#3a46c8', tagFg: '#ffe9a8' },   // azul-violeta + detalhe dourado
    s:    { label: 'Shiny',        short: '✦',    c0: '#ec4cc4', c1: '#7c1670', tagBg: '#c4249f', tagFg: '#ffffff' },   // magenta com brilho
    s100: { label: 'Shiny 100%',   short: '✦IV',  c0: '#d9a437', c1: '#6a2c98', tagBg: '#a8761f', tagFg: '#fff6d6' }    // dourado-violeta
  };
  const vkey = e => e.shiny ? (e.iv100 ? 's100' : 's') : (e.iv100 ? 'n100' : 'n');
  const entriesNow = () => [...roulette].map(parseRouletteKey).filter(Boolean);
  const nameOf = id => (typeof cap === 'function' ? cap(state.list[id - 1]?.name || String(id)) : String(id));

  /* ---------- Estado de desenho ---------- */
  let angle = 0;                 // rotação atual da roda (graus, sentido horário)
  let winnerIdx = -1;            // setor destacado após o sorteio
  let frozen = null;             // entradas congeladas enquanto a roleta gira (evita divergência com o resultado)
  let base = null, baseSig = '';
  const ctx = canvas.getContext('2d');

  function currentEntries() { return frozen || entriesNow(); }

  /* ---------- Base (setores) em cache: só é refeita quando as entradas mudam ---------- */
  function buildBase(entries) {
    const n = entries.length, sig = entries.map(vkey).join('|');
    if (base && sig === baseSig) return base;
    baseSig = sig;
    base = document.createElement('canvas'); base.width = base.height = SIZE;
    const b = base.getContext('2d');
    const grads = {};
    for (const k in VARIANTS) {
      const g = b.createRadialGradient(C, C, R_HUB, C, C, R_SECTOR);
      g.addColorStop(0, VARIANTS[k].c1); g.addColorStop(.4, VARIANTS[k].c0); g.addColorStop(.82, VARIANTS[k].c0); g.addColorStop(1, VARIANTS[k].c1);
      grads[k] = g;
    }
    if (!n) {
      const g = b.createRadialGradient(C, C, R_HUB, C, C, R_SECTOR);
      g.addColorStop(0, '#2a1560'); g.addColorStop(1, '#170b3a');
      b.fillStyle = g; b.beginPath(); b.arc(C, C, R_SECTOR, 0, Math.PI * 2); b.fill();
      return base;
    }
    const step = Math.PI * 2 / n;
    for (let i = 0; i < n; i++) {
      const a0 = -Math.PI / 2 + i * step, a1 = a0 + step, k = vkey(entries[i]);
      b.beginPath(); b.moveTo(C, C); b.arc(C, C, R_SECTOR, a0, a1); b.closePath();
      b.fillStyle = grads[k]; b.fill();
      if (i % 2) { b.fillStyle = 'rgba(0,0,10,.16)'; b.fill(); }                 // alternância sutil entre setores vizinhos
      if (n <= 400 && (k === 'n100' || k === 's100')) {                          // detalhe dourado nas variantes 100% IV
        b.beginPath(); b.arc(C, C, R_SECTOR - 7, a0 + step * .04, a1 - step * .04);
        b.strokeStyle = 'rgba(255,214,112,.9)'; b.lineWidth = n > 60 ? 2 : 5; b.stroke();
      }
    }
    if (n <= 200) {                                                              // divisórias nítidas
      b.strokeStyle = 'rgba(244,224,255,.55)'; b.lineWidth = n > 60 ? 1.5 : 3;
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + i * step;
        b.beginPath(); b.moveTo(C + Math.cos(a) * R_HUB, C + Math.sin(a) * R_HUB); b.lineTo(C + Math.cos(a) * R_SECTOR, C + Math.sin(a) * R_SECTOR); b.stroke();
      }
    }
    const sheen = b.createRadialGradient(C - 120, C - 160, 20, C, C, R_SECTOR);
    sheen.addColorStop(0, 'rgba(255,255,255,.10)'); sheen.addColorStop(.6, 'rgba(255,255,255,0)');
    b.fillStyle = sheen; b.beginPath(); b.arc(C, C, R_SECTOR, 0, Math.PI * 2); b.fill();
    return base;
  }

  /* ---------- Aro dourado, hub e brilho (estáticos) ---------- */
  function drawFrame(n, entries) {
    let gold;
    if (ctx.createConicGradient) {
      gold = ctx.createConicGradient(-Math.PI / 2, C, C);
      [[0, '#fff0b8'], [.12, '#d9a53a'], [.25, '#8a5a12'], [.38, '#f4cf6a'], [.5, '#fff2c4'], [.62, '#c48a24'], [.75, '#7a4d0c'], [.88, '#f0c85e'], [1, '#fff0b8']].forEach(([s, c]) => gold.addColorStop(s, c));
    } else { gold = ctx.createLinearGradient(0, 0, SIZE, SIZE); gold.addColorStop(0, '#f6dc8c'); gold.addColorStop(.5, '#a87420'); gold.addColorStop(1, '#f6dc8c'); }
    ctx.beginPath(); ctx.arc(C, C, R_RING_OUT, 0, Math.PI * 2); ctx.arc(C, C, R_RING_IN, 0, Math.PI * 2, true); ctx.fillStyle = gold; ctx.fill('evenodd');
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(60,25,100,.85)';
    ctx.beginPath(); ctx.arc(C, C, R_RING_IN, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,248,214,.75)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(C, C, R_RING_OUT - 2, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 24; i++) {                                              // luzes do aro
      const a = i * Math.PI / 12 - Math.PI / 2, x = C + Math.cos(a) * 461, y = C + Math.sin(a) * 461;
      ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fillStyle = i % 2 ? '#fff6cf' : '#7a3fd0'; ctx.shadowColor = i % 2 ? 'rgba(255,230,140,.9)' : 'rgba(170,110,255,.9)'; ctx.shadowBlur = 10; ctx.fill(); ctx.shadowBlur = 0;
    }
    // hub
    ctx.beginPath(); ctx.arc(C, C, R_HUB + 12, 0, Math.PI * 2); ctx.fillStyle = gold; ctx.fill();
    const hg = ctx.createRadialGradient(C - 14, C - 18, 6, C, C, R_HUB);
    hg.addColorStop(0, '#6a3bc2'); hg.addColorStop(1, '#1d0b46');
    ctx.beginPath(); ctx.arc(C, C, R_HUB, 0, Math.PI * 2); ctx.fillStyle = hg; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,240,190,.8)'; ctx.stroke();
    ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
    if (n > 0) {
      ctx.font = '900 ' + (n >= 1000 ? 30 : n >= 100 ? 36 : 44) + 'px system-ui,Segoe UI,sans-serif'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(n.toLocaleString('pt-BR'), C, C + 6);
      ctx.font = '700 15px system-ui,Segoe UI,sans-serif'; ctx.fillStyle = '#e4d2ff';
      ctx.fillText(n === 1 ? 'opção' : 'opções', C, C + 28);
    } else {
      ctx.font = '800 15px system-ui,Segoe UI,sans-serif'; ctx.fillStyle = '#e4d2ff'; ctx.fillText('vazia', C, C + 5);
    }
  }

  /* ---------- Sprites e rótulos (sempre na vertical, dentro do setor) ---------- */
  /* Ajusta o rótulo ao espaço: reduz a fonte até um mínimo legível e, se ainda não couber, trunca com reticências. */
  function fitLabel(text, maxW, px) {
    let f = px; ctx.font = '800 ' + f + 'px system-ui,Segoe UI,sans-serif';
    while (f > 14 && ctx.measureText(text).width > maxW) { f -= 1; ctx.font = '800 ' + f + 'px system-ui,Segoe UI,sans-serif'; }
    let t = text;
    if (ctx.measureText(text).width > maxW) {
      while (t.length > 2 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
      t = t.replace(/\s+$/, '') + '…';
    }
    return { text: t, f, w: ctx.measureText(t).width };
  }
  let layout = [];                                    // caixas desenhadas no último quadro (usadas na verificação de limites)
  function drawSprites(entries, angRad) {
    layout = [];
    const n = entries.length; if (!n || n > 60) return;
    const step = Math.PI * 2 / n;
    const d = n <= 6 ? R_SECTOR * .6 : R_SECTOR * .7;
    const chord = n === 1 ? R_SECTOR * 1.2 : 2 * d * Math.sin(Math.min(step, Math.PI) / 2);
    let showName = n <= 20; const showTag = n <= 24, tagFull = n <= 10;
    const nameH = n <= 6 ? 30 : n <= 12 ? 26 : 24, tagH = n <= 6 ? 26 : 22;
    let s = Math.max(14, Math.min(R_SECTOR * (n <= 4 ? .46 : .36), chord * (n <= 12 ? .56 : .66)));
    // pilha (sprite + nome + variante) precisa caber na largura do setor; se não couber, reduz o sprite e, por último, tira o nome
    const room = chord * .9, need = () => s + (showName ? nameH : 0) + (showTag ? tagH : 0) + 4;
    if (n > 1 && need() > room) s = Math.max(14, room - (showName ? nameH : 0) - (showTag ? tagH : 0) - 4);
    if (n > 1 && showName && s < 30) { showName = false; s = Math.max(14, Math.min(s + nameH, room - (showTag ? tagH : 0) - 4)); }
    for (let i = 0; i < n; i++) {
      const e = entries[i], k = vkey(e), a = -Math.PI / 2 + (i + .5) * step + angRad;
      const cx = C + Math.cos(a) * d, cy = C + Math.sin(a) * d;
      // recorte no setor: o conteúdo nunca ultrapassa as bordas
      ctx.save();
      ctx.beginPath(); ctx.moveTo(C, C); ctx.arc(C, C, R_SECTOR - 4, -Math.PI / 2 + i * step + angRad, -Math.PI / 2 + (i + 1) * step + angRad); ctx.closePath(); ctx.clip();
      const labelH = (showName ? nameH : 0) + (showTag ? tagH : 0);
      const spriteY = cy - labelH / 2;
      const img = typeof getRouletteImage === 'function' ? getRouletteImage(e.id, e.shiny, e.iv100) : null;
      if (e.iv100) { ctx.beginPath(); ctx.arc(cx, spriteY, s * .56, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(255,214,112,.95)'; ctx.lineWidth = Math.max(2, s * .04); ctx.stroke(); }
      if (img && img.complete && img.naturalWidth) {
        ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 10;
        ctx.drawImage(img, cx - s / 2, spriteY - s / 2, s, s); ctx.shadowBlur = 0;
      }
      let ty = spriteY + s / 2 + 4;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      const rec = { i, boxes: [{ k: 'sprite', x: cx - s / 2, y: spriteY - s / 2, w: s, h: s }] };
      if (showName) {
        const lab = fitLabel(nameOf(e.id), chord * .8, Math.min(n <= 6 ? 26 : 22, Math.max(14, s * .24)));
        ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(12,4,34,.9)'; ctx.strokeText(lab.text, cx, ty);
        ctx.fillStyle = '#fff'; ctx.fillText(lab.text, cx, ty);
        rec.boxes.push({ k: 'name', x: cx - lab.w / 2, y: ty, w: lab.w, h: lab.f }); ty += lab.f + 6;
      }
      if (showTag) {
        const v = VARIANTS[k], text = tagFull ? v.label : v.short, f = Math.max(12, Math.min(n <= 6 ? 16 : 14, s * .16 + 3));
        ctx.font = '900 ' + f + 'px system-ui,Segoe UI,sans-serif';
        const w = ctx.measureText(text).width + 12, h = f + 6, x = cx - w / 2;
        ctx.fillStyle = v.tagBg; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, ty, w, h, h / 2) : ctx.rect(x, ty, w, h); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = v.tagFg; ctx.fillText(text, cx, ty + 3);
        rec.boxes.push({ k: 'tag', x, y: ty, w, h });
      }
      layout.push(rec);
      ctx.restore();
    }
    ctx.textBaseline = 'alphabetic';
  }

  /* ---------- Desenho completo ---------- */
  function render(deg) {
    const entries = currentEntries(), n = entries.length, angRad = deg * Math.PI / 180;
    ctx.clearRect(0, 0, SIZE, SIZE);
    const glow = ctx.createRadialGradient(C, C, R_RING_OUT - 10, C, C, C);      // brilho roxo por trás do aro (desenhado ANTES de tudo)
    glow.addColorStop(0, 'rgba(170,90,255,.55)'); glow.addColorStop(1, 'rgba(170,90,255,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(C, C, C, 0, Math.PI * 2); ctx.fill();
    const b = buildBase(entries);
    ctx.save(); ctx.translate(C, C); ctx.rotate(angRad); ctx.drawImage(b, -C, -C); ctx.restore();
    if (n && winnerIdx >= 0 && winnerIdx < n) {                                  // destaque do vencedor
      const step = Math.PI * 2 / n, a0 = -Math.PI / 2 + winnerIdx * step + angRad, a1 = a0 + step;
      ctx.save(); ctx.beginPath(); ctx.arc(C, C, R_SECTOR, 0, Math.PI * 2); ctx.fillStyle = 'rgba(8,2,24,.5)'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(C, C); ctx.arc(C, C, R_SECTOR, a0, a1); ctx.closePath(); ctx.clip();
      ctx.translate(C, C); ctx.rotate(angRad); ctx.drawImage(b, -C, -C); ctx.restore();
      ctx.save(); ctx.beginPath(); ctx.moveTo(C, C); ctx.arc(C, C, R_SECTOR, a0, a1); ctx.closePath();
      ctx.shadowColor = 'rgba(255,225,130,.95)'; ctx.shadowBlur = 26; ctx.lineWidth = 6; ctx.strokeStyle = '#ffe27a'; ctx.stroke(); ctx.restore();
    }
    drawSprites(entries, angRad);
    drawFrame(n, entries);
    if (!n) {
      ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(235,222,255,.92)'; ctx.font = '800 34px system-ui,Segoe UI,sans-serif'; ctx.fillText('Selecione Pokémon', C, C - 150);
      ctx.font = '600 22px system-ui,Segoe UI,sans-serif'; ctx.fillStyle = 'rgba(200,180,240,.85)'; ctx.fillText('para montar a roleta', C, C - 116);
    }
  }

  /* ---------- Integração: substitui apenas a função de desenho ---------- */
  let winnerSig = '';
  drawWheel = function () {                            // eslint-disable-line no-global-assign
    if (winnerIdx >= 0 && !frozen && entriesNow().map(vkey).join('|') !== winnerSig) winnerIdx = -1;   // seleção mudou: some o destaque
    render(angle);
  };
  const baseSummary = updateRouletteSummary;
  updateRouletteSummary = function () {                  // eslint-disable-line no-global-assign
    baseSummary();
    const n = roulette.size, c = $('rpCount'), p = $('rpChance');
    if (c) c.textContent = n.toLocaleString('pt-BR');
    if (p) { const pct = 100 / n; p.textContent = n ? pct.toLocaleString('pt-BR', { maximumFractionDigits: pct >= 10 ? 2 : pct >= 1 ? 3 : 4 }) + '%' : '—'; }
    spinBtn.setAttribute('aria-disabled', n ? 'false' : 'true');
  };

  /* ---------- Histórico (dados reais dos sorteios feitos neste aparelho) ---------- */
  function readHistory() { try { const v = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); return Array.isArray(v) ? v.filter(x => x && Number.isFinite(x.id) && Number.isFinite(x.t)).slice(0, 12) : []; } catch (e) { return []; } }
  function writeHistory(list) { try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 12))); } catch (e) { /* sem armazenamento: o histórico vale só nesta sessão */ } }
  let history = readHistory();
  const ago = t => { const m = Math.floor((Date.now() - t) / 60000); return m < 1 ? 'Agora' : m < 60 ? 'há ' + m + ' min' : m < 1440 ? 'há ' + Math.floor(m / 60) + ' h' : 'há ' + Math.floor(m / 1440) + ' d'; };
  function renderHistory() {
    const ol = $('rpHistory'), clr = $('rpHistoryClear'); if (!ol) return;
    if (clr) clr.hidden = !history.length;
    ol.innerHTML = history.length ? history.map(h => {
      const v = VARIANTS[h.shiny ? (h.iv100 ? 's100' : 's') : (h.iv100 ? 'n100' : 'n')];
      return `<li><img src="${sprite(h.id, !!h.shiny)}" alt="" loading="lazy"><span><b>${nameOf(h.id)}</b> <em class="rp-vtag rp-v-${h.shiny ? (h.iv100 ? 's100' : 's') : (h.iv100 ? 'n100' : 'n')}">${v.label}</em></span><time>${ago(h.t)}</time></li>`;
    }).join('') : '<li class="rp-empty">Nenhum sorteio ainda. Gire a roleta para começar o histórico.</li>';
  }
  if ($('rpHistoryClear')) $('rpHistoryClear').onclick = () => { history = []; writeHistory(history); renderHistory(); };

  function showIdleResult() {
    $('spinResult').innerHTML = '<div class="rp-result-idle"><div class="rp-q" aria-hidden="true">?</div><div><h3>Resultado do sorteio</h3><p>O vencedor da roleta aparecerá aqui.</p></div></div>';
  }

  /* ---------- Giro ---------- */
  let lastRun = null;                                 // { idx, winner, n } do último sorteio (usado nos testes e na verificação)
  function pointerIndex(deg, n) {                     // setor que está sob o ponteiro (topo) para um ângulo
    const slice = 360 / n, rel = (((-deg) % 360) + 360) % 360;
    return Math.min(n - 1, Math.floor(rel / slice));
  }
  function setBusy(on) {
    spinBtn.disabled = on; spinBtn.classList.toggle('is-spinning', on);
    spinBtn.setAttribute('aria-busy', String(on)); spinBtn.textContent = on ? 'GIRANDO…' : 'GIRAR ROLETA';
    document.querySelector('.wheel-panel')?.classList.toggle('rp-spinning', on);
  }
  function finish(winner, n, idx) {
    frozen = null; spinning = false; setBusy(false);
    winnerIdx = idx; winnerSig = entriesNow().map(vkey).join('|'); render(angle);
    const landed = pointerIndex(angle, n);
    if (landed !== idx) console.error('Roleta: ponteiro em', landed, 'mas o vencedor sorteado foi', idx);
    history.unshift({ id: winner.id, shiny: winner.shiny, iv100: winner.iv100, t: Date.now() }); history = history.slice(0, 12); writeHistory(history); renderHistory();
    showResult(winner, n);
  }
  async function showResult(winner, n) {
    const box = $('spinResult');
    try {
      const p = state.list[winner.id - 1] || { name: '#' + winner.id }, d = await getDetail(winner.id);
      const k = vkey(winner);
      box.innerHTML = `<div class="rp-result-win rp-win-${k}"><div class="rp-win-art"><img src="${sprite(winner.id, winner.shiny)}" alt="${cap(p.name)}"></div><div class="rp-win-info"><span class="rp-kicker">🎉 RESULTADO</span><h2>${cap(p.name)}${winner.shiny ? ' ✨' : ''}${winner.iv100 ? ' 💯' : ''}</h2><div class="roulette-variant-badge">${rouletteVariantLabel(winner)}</div><div class="types">${(d.types || []).map(t => `<span class="type ${t}">${TYPE_PT[t] || t}</span>`).join('')}</div><p>#${pad(winner.id)} • ${regionOf(winner.id)}<br>${formatRouletteProbability(n)}</p><div class="result-actions"><button id="rouletteViewDex" type="button">📖 Ver na Pokédex</button><button id="rouletteFav" type="button">⭐ Favoritar</button><button id="rouletteAddTeam" type="button">⚔️ Adicionar ao time</button></div></div></div>`;
      $('rouletteViewDex').onclick = () => { go('pokedex'); openPokemon(winner.id, winner.shiny); };
      $('rouletteFav').onclick = () => { if (!favs.has(winner.id)) { toggleFav(winner.id, winner.shiny); } else if (!!favShiny[winner.id] !== winner.shiny) { favs.delete(winner.id); delete favShiny[winner.id]; toggleFav(winner.id, winner.shiny); toast('Variante dos Desejos atualizada ⭐'); } else toast('Esta variante já está nos Desejos ⭐'); };
      $('rouletteAddTeam').onclick = () => openTeamChooser(winner.id, winner.shiny, winner.iv100);
    } catch (e) {
      console.error('roulette result failed', e);
      box.innerHTML = '<div class="rp-result-idle"><div><h3>Resultado sorteado</h3><p>O resultado foi sorteado, mas houve erro ao carregar os detalhes. Você pode girar novamente.</p></div></div>';
    }
  }
  function onSpin() {
    if (spinning) return;
    const entries = entriesNow();
    if (!entries.length) { toast('Selecione pelo menos 1 opção.'); spinBtn.classList.remove('rp-shake'); void spinBtn.offsetWidth; spinBtn.classList.add('rp-shake'); return; }
    spinning = true; frozen = entries; winnerIdx = -1; setBusy(true);
    $('spinResult').innerHTML = '<div class="rp-result-idle"><div class="rp-q rp-q-spin" aria-hidden="true">?</div><div><h3>Girando…</h3><p>Aguarde o ponteiro parar.</p></div></div>';
    // ── regra de sorteio inalterada: chances iguais para todas as entradas ──
    const n = entries.length, idx = Math.floor(Math.random() * n), winner = entries[idx];
    const slice = 360 / n, target = 360 - (idx * slice + slice / 2);
    const cur = ((angle % 360) + 360) % 360, extra = (((target - cur) % 360) + 360) % 360;
    const turns = reduceMotion() ? 1 : 7, total = 360 * turns + extra, a0 = angle, dur = reduceMotion() ? 700 : 4600;
    lastRun = { idx, winner, n };
    const t0 = performance.now();
    const tick = now => {
      const t = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - t, 4);
      angle = a0 + total * e; rotation = angle; render(angle);
      if (t < 1) requestAnimationFrame(tick); else { angle = a0 + total; rotation = angle; finish(winner, n, idx); }
    };
    requestAnimationFrame(tick);
  }
  spinBtn.dataset.pointerSyncFixed = '1';
  spinBtn.onclick = onSpin;
  const baseClear = $('clearRoulette');
  if (baseClear) { const prev = baseClear.onclick; baseClear.onclick = e => { prev && prev.call(baseClear, e); winnerIdx = -1; showIdleResult(); drawWheel(); }; }

  /* Mantém o catálogo com a mesma altura da roleta no desktop (rolagem interna) */
  const panel = document.querySelector('#roulette .wheel-panel'), cat = document.querySelector('#roulette .roulette-catalog');
  function syncHeights() {
    if (!panel || !cat) return;
    if (window.innerWidth <= 1100) { cat.style.maxHeight = ''; return; }
    const h = panel.offsetHeight; if (h > 200) cat.style.maxHeight = h + 'px';
  }
  if (window.ResizeObserver && panel) new ResizeObserver(syncHeights).observe(panel);
  window.addEventListener('resize', syncHeights);

  // gancho para testes
  /* Verifica se todas as caixas (sprite/nome/variante) estão dentro do seu setor e sem sobreposição; usado nos testes. */
  function checkLayout() {
    const entries = currentEntries(), n = entries.length, step = Math.PI * 2 / n, angRad = angle * Math.PI / 180, problems = [];
    layout.forEach(rec => {
      const a0 = -Math.PI / 2 + rec.i * step + angRad, a1 = a0 + step;
      rec.boxes.forEach(b0 => {
        const m = b0.k === 'sprite' ? b0.w * .1 : 0, b = { k: b0.k, x: b0.x + m, y: b0.y + m, w: b0.w - 2 * m, h: b0.h - 2 * m };   // a arte ocupa ~80% da caixa quadrada do sprite
        [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]].forEach(([px, py]) => {
          const dx = px - C, dy = py - C, r = Math.hypot(dx, dy);
          let t = Math.atan2(dy, dx); while (t < a0 - 1e-6) t += Math.PI * 2; while (t > a0 + Math.PI * 2) t -= Math.PI * 2;
          const inside = n === 1 ? r > R_HUB && r < R_SECTOR : (t <= a1 + 1e-3 && r > R_HUB && r < R_SECTOR);
          if (!inside) problems.push(`entrada ${rec.i} ${b.k}`);
        });
      });
      for (let p = 0; p < rec.boxes.length; p++) for (let q = p + 1; q < rec.boxes.length; q++) {
        const A = rec.boxes[p], B = rec.boxes[q];
        if (A.x < B.x + B.w && B.x < A.x + A.w && A.y < B.y + B.h && B.y < A.y + A.h && !(A.k === 'sprite' && B.k !== 'sprite' && B.y >= A.y + A.h - 2)) problems.push(`sobreposição ${rec.i} ${A.k}/${B.k}`);
      }
    });
    return [...new Set(problems)];
  }
  window.PTRoulette = { setAngle: d => { angle = d; render(angle); }, checkLayout, boxes: () => layout, entries: entriesNow, angle: () => angle, pointerIndex, lastRun: () => lastRun, winnerIdx: () => winnerIdx, render: () => render(angle) };

  showIdleResult(); renderHistory(); updateRouletteSummary(); drawWheel();
})();
