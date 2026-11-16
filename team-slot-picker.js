/* PokéTeam — Pacote de Atualização 01 / Melhoria 02
   Seletor de Pokémon direto nos slots de Times.
   - Slot vazio  -> adiciona na próxima posição livre da equipe ativa.
   - Slot preenchido (botão "Trocar") -> substitui aquele slot.
   Reutiliza os dados e funções da Pokédex (state, getDetail, getSpecialForms,
   getTransformationForms, categorySingleMatch, matchesSearch...). Não altera o
   formato de pt_teams (members, memberShiny, memberIV100, memberForms). */
(() => {
  'use strict';
  if (typeof teams === 'undefined' || typeof renderTeams !== 'function') return;

  const PAGE = 60;
  const CATS = [['all', 'Todas as classificações'], ['legendary', '🟡 Lendários'], ['mythical', '🔵 Míticos'], ['ub', '🟣 Ultra Beasts'], ['paradox', '🌀 Paradoxos'], ['transform', '🔄 Transformações'], ['starter', '🌱 Iniciais Regionais'], ['mega', '💥 Mega Evoluções'], ['gmax', '⚡ Gigantamax']];
  let ctx = null;      // { teamId, mode: 'add'|'replace', index }
  let sel = null;      // { id, shiny, iv100, formKey, forms: [], formsLoading }
  let shown = PAGE;
  let token = 0;
  let root = null;
  let ownsScrollLock = false;

  const el = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function build() {
    if (root) return root;
    root = document.createElement('div');
    root.id = 'slotPicker';
    root.className = 'modal hidden';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', 'slotPickerTitle');
    root.innerHTML = `<div class="modal-card slot-picker-card">
      <button type="button" class="modal-close" id="slotPickerClose" aria-label="Fechar seletor">×</button>
      <div class="sp-head"><span class="eyebrow">TEAM BUILDER</span><h2 id="slotPickerTitle">Escolher Pokémon</h2><p id="slotPickerSub"></p></div>
      <div class="sp-body">
        <div class="sp-browse">
          <div class="sp-filters">
            <input id="spSearch" type="search" placeholder="Buscar por nome ou número" autocomplete="off">
            <select id="spRegion" aria-label="Região"></select>
            <select id="spType" aria-label="Tipo"></select>
            <select id="spCat" aria-label="Classificação"></select>
          </div>
          <div id="spCount" class="sp-count"></div>
          <div id="spGrid" class="sp-grid"></div>
          <button type="button" id="spMore" class="sp-more hidden">Mostrar mais</button>
        </div>
        <aside class="sp-preview" id="spPreview" aria-live="polite"></aside>
      </div>
    </div>`;
    document.body.appendChild(root);
    el('spRegion').innerHTML = '<option value="all">Todas as regiões</option>' + REGIONS.map(r => `<option value="${r[0]}">${r[0]} — #${r[1]}–#${r[2]}</option>`).join('');
    el('spType').innerHTML = '<option value="all">Todos os tipos</option>' + TYPES.map(t => `<option value="${t}">${TYPE_PT[t]}</option>`).join('');
    el('spCat').innerHTML = CATS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');

    let deb;
    el('spSearch').addEventListener('input', () => { clearTimeout(deb); deb = setTimeout(() => { shown = PAGE; renderGrid(); }, 150); });
    ['spRegion', 'spType', 'spCat'].forEach(id => el(id).addEventListener('change', () => { shown = PAGE; renderGrid(); }));
    el('spMore').addEventListener('click', () => { shown += PAGE; renderGrid(); });
    el('slotPickerClose').addEventListener('click', close);
    root.addEventListener('click', e => { if (e.target === root) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !root.classList.contains('hidden') && document.getElementById('siteDialog').classList.contains('hidden')) close(); });
    el('spGrid').addEventListener('click', e => {
      const b = e.target.closest('[data-sp-id]');
      if (b) select(Number(b.dataset.spId));
    });
    el('spPreview').addEventListener('click', e => {
      const t = e.target;
      if (t.closest('#spShiny')) { sel.shiny = !sel.shiny; renderPreview(); renderGrid(true); }
      else if (t.closest('#spIV')) { sel.iv100 = !sel.iv100; renderPreview(); }
      else if (t.closest('[data-sp-form]')) { sel.formKey = t.closest('[data-sp-form]').dataset.spForm; renderPreview(); }
      else if (t.closest('#spCancel')) close();
      else if (t.closest('#spConfirm')) commit();
    });
    return root;
  }

  function team() { return teams.find(t => t.id === ctx?.teamId); }

  // mode: 'add' | 'replace' | 'compare' (compare não altera a equipe: devolve a escolha via onPick)
  function open(mode, index, onPick) {
    const t = teams.find(x => x.id === state.activeTeam);
    if (!t) return;
    if (mode === 'add' && t.members.length >= 6) { toast(`${t.name} está cheia (6/6).`); return; }
    build();
    ctx = { teamId: t.id, mode, onPick, index: (mode === 'replace' || mode === 'compare') ? index : t.members.length };
    sel = null;
    shown = PAGE;
    const slotN = ctx.index + 1;
    el('slotPickerTitle').textContent = mode === 'compare' ? `Candidato para substituir o slot ${slotN}` : mode === 'replace' ? `Trocar Pokémon do slot ${slotN}` : `Escolher Pokémon para o slot ${slotN}`;
    el('slotPickerSub').textContent = `Equipe: ${t.name}`;
    el('spSearch').value = ''; el('spRegion').value = 'all'; el('spType').value = 'all'; el('spCat').value = 'all';
    if (document.body.dataset.scrollLocked !== '1') { lockPageScroll(); ownsScrollLock = true; } else ownsScrollLock = false;
    root.classList.remove('hidden');
    renderPreview();
    renderGrid();
    el('spSearch').focus({ preventScroll: true });
  }

  function close() {
    if (!root) return;
    root.classList.add('hidden');
    if (ownsScrollLock) { unlockPageScroll(); ownsScrollLock = false; }
    ctx = null; sel = null; token++;
  }

  async function ensureDetails(list) {
    const missing = list.filter(p => !state.details.has(p.id));
    let i = 0;
    async function worker() { while (i < missing.length) { await getDetail(missing[i++].id); } }
    await Promise.allSettled(Array.from({ length: 10 }, worker));
  }

  async function renderGrid(keepOnly) {
    const my = ++token;
    const q = el('spSearch').value, region = el('spRegion').value, type = el('spType').value, cat = el('spCat').value;
    let base = state.list.filter(p => matchesSearch(p, q) && (region === 'all' || regionOf(p.id) === region) && categorySingleMatch(p, cat));
    if (type !== 'all') {
      if (base.some(p => !state.details.has(p.id))) {
        el('spCount').textContent = 'Carregando tipos…';
        await ensureDetails(base);
        if (my !== token) return;
      }
      base = base.filter(p => state.details.get(p.id)?.types?.includes(type));
    }
    base.sort((a, b) => a.id - b.id);
    const grid = el('spGrid');
    const prevScroll = keepOnly ? grid.scrollTop : 0;
    el('spCount').textContent = `${base.length} Pokémon`;
    grid.innerHTML = base.length ? base.slice(0, shown).map(p => {
      const d = state.details.get(p.id), types = d?.types || [];
      const name = cap(d?.name || p.name);
      return `<button type="button" class="sp-card${sel && sel.id === p.id ? ' selected' : ''}" data-sp-id="${p.id}" title="${esc(name)}"><img loading="lazy" src="${sprite(p.id, !!sel?.shiny)}" alt=""><b>#${pad(p.id)}</b><span class="sp-name">${esc(name)}</span><span class="sp-types">${types.map(t => `<i class="type ${t}">${TYPE_PT[t] || t}</i>`).join('')}</span></button>`;
    }).join('') : '<div class="empty-state">Nenhum Pokémon encontrado.</div>';
    el('spMore').classList.toggle('hidden', base.length <= shown);
    if (prevScroll) grid.scrollTop = prevScroll;
  }

  function formList() { return sel?.forms || []; }
  function currentForm() { return sel && sel.formKey !== 'base' ? formList().find(f => f.key === sel.formKey) || null : null; }

  async function select(id) {
    sel = { id, shiny: sel?.shiny || false, iv100: sel?.iv100 || false, formKey: 'base', forms: [], formsLoading: true };
    el('spGrid').querySelectorAll('.sp-card').forEach(c => c.classList.toggle('selected', Number(c.dataset.spId) === id));
    renderPreview();
    const mine = sel;
    try {
      await getDetail(id);
      const base = state.list[id - 1]?.name || `pokemon-${id}`;
      const forms = [];
      if (MEGA.has(id)) (await getSpecialForms(id, 'mega')).forEach((f, i) => forms.push({ key: `mega:${i}`, category: 'mega', f }));
      if (GMAX.has(id)) (await getSpecialForms(id, 'gmax')).forEach((f, i) => forms.push({ key: `gmax:${i}`, category: 'gmax', f }));
      (await getTransformationForms(id)).forEach((f, i) => forms.push({ key: `transform:${i}`, category: 'transform', f }));
      mine.forms = forms.map(x => ({ key: x.key, category: x.category, formName: x.f.formName || '', label: x.f.label || specialFormLabel(x.f.formName || '', base), art: x.f.art || '', shinyArt: x.f.shinyArt || '', types: Array.isArray(x.f.types) ? [...x.f.types] : [] }));
    } catch (e) { console.warn('Falha ao carregar formas no seletor', e); }
    mine.formsLoading = false;
    if (sel === mine) renderPreview();
  }

  function renderPreview() {
    const box = el('spPreview');
    if (!sel) { box.innerHTML = '<div class="sp-empty"><b>Nenhum Pokémon escolhido</b><span>Selecione um Pokémon na lista para ver a prévia e confirmar.</span></div><div class="sp-actions"><button type="button" id="spCancel">Cancelar</button></div>'; return; }
    const form = currentForm();
    const d = state.details.get(sel.id);
    const name = form ? form.label : cap(d?.name || state.list[sel.id - 1]?.name || `#${sel.id}`);
    const types = form?.types?.length ? form.types : (d?.types || []);
    const img = form ? (sel.shiny && form.shinyArt ? form.shinyArt : (form.art || sprite(sel.id, sel.shiny))) : sprite(sel.id, sel.shiny);
    const chips = [`<button type="button" class="sp-form${sel.formKey === 'base' ? ' active' : ''}" data-sp-form="base">Forma padrão</button>`].concat(formList().map(f => `<button type="button" class="sp-form${sel.formKey === f.key ? ' active' : ''}" data-sp-form="${f.key}">${esc(f.label)}</button>`)).join('');
    const replacing = ctx?.mode === 'replace';
    const confirmLabel = ctx?.mode === 'compare' ? 'Usar na comparação' : (replacing ? 'Confirmar troca' : 'Confirmar');
    box.innerHTML = `<div class="sp-preview-art"><img src="${img}" alt="${esc(name)}"></div>
      <div class="sp-preview-info"><span class="num">#${pad(sel.id)}</span><h3>${esc(name)}${sel.shiny ? ' ✨' : ''}${sel.iv100 ? ' 💯' : ''}</h3>
      <div class="types">${types.map(t => `<span class="type ${t}">${TYPE_PT[t] || t}</span>`).join('') || '<span class="muted">carregando tipos…</span>'}</div></div>
      <div class="sp-toggles"><button type="button" id="spShiny" class="${sel.shiny ? 'on' : ''}" aria-pressed="${sel.shiny}">✨ Shiny</button><button type="button" id="spIV" class="${sel.iv100 ? 'on' : ''}" aria-pressed="${sel.iv100}">💯 100% IV</button></div>
      <div class="sp-forms-label">Formas${sel.formsLoading ? ' (carregando…)' : ''}</div><div class="sp-forms">${chips}</div>
      <div class="sp-actions"><button type="button" id="spCancel">Cancelar</button><button type="button" id="spConfirm" class="primary">${confirmLabel}</button></div>`;
  }

  function payloadOf(form) {
    return form ? { category: form.category, formName: form.formName, label: form.label, art: form.art, shinyArt: form.shinyArt, types: [...(form.types || [])] } : null;
  }

  // Aplica uma escolha {id, shiny, iv100, form} à equipe: troca o slot `index` ou, se index == null, adiciona ao final.
  // Mantém o formato de pt_teams (members, memberShiny, memberIV100, memberForms). Retorna o número do slot ou 0.
  async function applySelection(t, index, selection) {
    const n = t.members.length;
    ['memberShiny', 'memberIV100', 'memberForms'].forEach(k => { t[k] = Array.isArray(t[k]) ? t[k].slice(0, n) : []; while (t[k].length < n) t[k].push(k === 'memberForms' ? null : false); });
    const id = selection.id, shiny = !!selection.shiny, iv = !!selection.iv100, payload = selection.form || null;
    let slotNumber;
    if (index != null && index < n) {
      t.members[index] = id; t.memberShiny[index] = shiny; t.memberIV100[index] = iv; t.memberForms[index] = payload;
      slotNumber = index + 1;
    } else {
      if (n >= 6) { toast(`${t.name} está cheia (6/6).`); return 0; }
      t.members.push(id); t.memberShiny.push(shiny); t.memberIV100.push(iv); t.memberForms.push(payload);
      slotNumber = n + 1;
    }
    const label = payload?.label || cap(state.list[id - 1]?.name || 'Pokémon');
    await getDetail(id);
    state.activeTeam = t.id;
    save();
    try { renderTeams(); } catch (e) { console.error('Falha ao atualizar Times', e); }
    toast(`${label}${shiny ? ' ✨' : ''}${iv ? ' 💯' : ''} no slot ${slotNumber} de ${t.name}`);
    return slotNumber;
  }

  async function commit() {
    const t = team();
    if (!t || !sel) return;
    const selection = { id: sel.id, shiny: !!sel.shiny, iv100: !!sel.iv100, form: payloadOf(currentForm()) };
    if (ctx.mode === 'compare') {
      const cb = ctx.onPick;
      close();
      if (typeof cb === 'function') cb(selection);
      return;
    }
    const n = t.members.length;
    const idx = (ctx.mode === 'replace' && ctx.index < n) ? ctx.index : null;
    close();
    await applySelection(t, idx, selection);
  }

  window.PTSlotPicker = { open, applySelection };
  /* ---- integração com a tela de Times ---- */
  function decorate() {
    const area = el('teamArea');
    if (!area) return;
    area.querySelectorAll('.slot.empty-slot').forEach(s => {
      s.dataset.pickSlot = '1';
      s.setAttribute('role', 'button');
      s.tabIndex = 0;
      s.setAttribute('aria-label', 'Adicionar Pokémon a este slot');
    });
    area.querySelectorAll('.slot.filled').forEach((s, i) => {
      if (s.querySelector('[data-swap-member]')) return;
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'slot-swap'; b.dataset.swapMember = String(i); b.textContent = 'Trocar';
      b.setAttribute('aria-label', 'Trocar o Pokémon deste slot');
      const rm = s.querySelector('[data-remove-member]');
      rm ? s.insertBefore(b, rm) : s.appendChild(b);
    });
  }

  const originalRenderTeams = renderTeams;
  renderTeams = function () { const r = originalRenderTeams.apply(this, arguments); try { decorate(); } catch (e) { console.warn(e); } return r; };

  document.addEventListener('click', e => {
    const swap = e.target.closest?.('#teamArea [data-swap-member]');
    if (swap) { e.preventDefault(); open('replace', Number(swap.dataset.swapMember)); return; }
    const empty = e.target.closest?.('#teamArea .slot.empty-slot');
    if (empty) { e.preventDefault(); open('add'); }
  });
  document.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('#teamArea .slot.empty-slot')) { e.preventDefault(); open('add'); }
  });

  try { decorate(); } catch (e) { /* tela de Times ainda não renderizada */ }
})();
