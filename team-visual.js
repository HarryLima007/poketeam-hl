/* PokéTeam — Team Builder: motor de cálculo único + indicadores do banner de Estratégia.

   MOTOR (window.PTTeamEngine) — usado pelas barras, pela análise, pelas recomendações e pelo comparador,
   para que todos os números venham do mesmo cálculo:
   - Equilíbrio = nota 0-100 já existente na análise do time (teamMetricsFromTypes): 50 pts de cobertura
     elemental + 30 pts de resistência/imunidade + 20 pts de penalidade por fraquezas compartilhadas.
   - Ataque  = 60% cobertura elemental (tipos do time super efetivos contra quantos dos 18 tipos)
             + 40% ataque base médio (maior entre Ataque e Ataque Esp. de cada membro, normalizado 40..140).
   - Defesa  = 60% defesa por tipagem (resistências/imunidades e fraquezas compartilhadas, mesmos critérios do Equilíbrio)
             + 40% resistência base média (média de PS, Defesa e Defesa Esp. de cada membro, normalizada 40..110).
   Os atributos base vêm da PokéAPI (campo stats do mesmo /pokemon/{id} já consultado). Se algum membro ainda não
   tiver atributos, Ataque e Defesa usam só a parte de tipos até que carreguem.
   Limitações: não considera golpes, habilidades, itens, natureza, EVs/IVs nem os atributos de formas Mega/Gigantamax
   (usa os da espécie base); os TIPOS, porém, respeitam a forma escolhida no slot.
   Normalização: norm(x, lo, hi) = (x - lo) / (hi - lo), limitada a 0..1. */
(() => {
  'use strict';
  if (typeof renderTeams !== 'function' || typeof teamMetricsFromTypes !== 'function' || typeof teams === 'undefined') return;

  /* ---- getDetail com atributos base (mesma requisição/cache; só acrescenta `stats`) ---- */
  const STAT_KEYS = { hp: 'hp', attack: 'atk', defense: 'def', 'special-attack': 'spa', 'special-defense': 'spd', speed: 'spe' };
  const originalGetDetail = getDetail;
  getDetail = async function (id) {
    const cached = state.details.get(id);
    if (cached && cached.stats) return cached;
    try {
      const p = await fetchJSON(`${API}/pokemon/${id}`, 'pokemon_' + id);
      const stats = {};
      (p.stats || []).forEach(s => { const k = STAT_KEYS[s.stat?.name]; if (k) stats[k] = s.base_stat; });
      const d = { id, name: p.name, types: p.types.slice().sort((a, b) => a.slot - b.slot).map(x => x.type.name), forms: p.forms?.map(x => x.name) || [], stats };
      state.details.set(id, d);
      return d;
    } catch (e) {
      return originalGetDetail(id);
    }
  };

  /* ---- motor ---- */
  const clamp01 = x => Math.max(0, Math.min(1, x));
  const norm = (x, lo, hi) => clamp01((x - lo) / (hi - lo));
  const avg = a => a.reduce((s, x) => s + x, 0) / (a.length || 1);
  const scoreLabel = s => s >= 80 ? 'Muito equilibrado' : s >= 65 ? 'Bom equilíbrio' : s >= 50 ? 'Equilíbrio médio' : 'Precisa de ajustes';

  function memberInfo(team, i) {
    const id = team.members[i];
    const d = state.details.get(id);
    const f = team.memberForms?.[i];
    const types = (f && Array.isArray(f.types) && f.types.length) ? f.types : d?.types;
    if (!types || !types.length) return null;
    return { id, types: [...types], stats: d?.stats || null, form: f || null };
  }
  function infoList(team) {
    const list = [];
    for (let i = 0; i < team.members.length; i++) {
      const m = memberInfo(team, i);
      if (!m) return null;           // tipos ainda carregando
      list.push(m);
    }
    return list;
  }
  function evaluate(list) {
    if (!list || !list.length) return { empty: true, attack: 0, defense: 0, balance: 0, label: '', score: 0, covered: [], uncovered: TYPES.slice(), shared: [], rows: [], elementTypes: [], defensiveCovered: 0 };
    const m = teamMetricsFromTypes(list.map(x => x.types));
    const n = TYPES.length;
    const cov = m.covered.length / n;
    const sharedBurden = m.shared.reduce((s, x) => s + (x.weak - 1), 0);
    const weaknessScore = Math.max(0, 20 - Math.min(20, sharedBurden * 4));
    const defTyping = ((m.defensiveCovered / n) * 30 + weaknessScore) / 50;
    const full = list.every(x => x.stats && x.stats.atk != null && x.stats.hp != null);
    const off = full ? avg(list.map(x => norm(Math.max(x.stats.atk, x.stats.spa), 40, 140))) : null;
    const bulk = full ? avg(list.map(x => norm((x.stats.hp + x.stats.def + x.stats.spd) / 3, 40, 110))) : null;
    return {
      ...m,
      empty: false,
      attack: Math.round(100 * (off === null ? cov : 0.6 * cov + 0.4 * off)),
      defense: Math.round(100 * (bulk === null ? defTyping : 0.6 * defTyping + 0.4 * bulk)),
      balance: m.score,
      label: scoreLabel(m.score),
      parts: { cov, defTyping, off, bulk, statsComplete: full }
    };
  }
  // Ao recarregar a página, parte dos detalhes pode ter sido carregada (do cache de sessão) antes deste arquivo
  // assumir getDetail; nesse caso faltam os atributos base. Completa-os uma única vez por Pokémon.
  const statsTried = new Set();
  function ensureStats(team) {
    const miss = [...new Set(team.members)].filter(id => { const d = state.details.get(id); return d && !d.stats && !statsTried.has(id); });
    if (!miss.length) return;
    miss.forEach(id => statsTried.add(id));
    Promise.allSettled(miss.map(id => getDetail(id))).then(() => { if (state.activeTeam === team.id) renderTeams(); });
  }
  window.PTTeamEngine = { memberInfo, infoList, evaluate, norm, scoreLabel, ensureStats };

  /* ---- barras do banner ---- */
  const box = () => document.getElementById('strategyMeters');
  let last = { attack: 0, defense: 0, balance: 0 };
  const EXPLAIN = {
    attack: 'Capacidade ofensiva. Combina 60% de cobertura elemental (contra quantos dos 18 tipos o time tem vantagem) com 40% do ataque base médio dos membros (o maior entre Ataque e Ataque Esp.). Não considera golpes, habilidades nem itens.',
    defense: 'Capacidade defensiva. Combina 60% de defesa por tipagem (quantos tipos o time resiste ou anula e quão repetidas são as fraquezas) com 40% da resistência base média (PS, Defesa e Defesa Esp.). Não considera habilidades nem itens.',
    balance: 'Visão geral da composição. É a mesma nota de "Análise do time": cobertura elemental (50 pts), resistências e imunidades (30 pts) e fraquezas compartilhadas (20 pts).'
  };

  function update() {
    const root = box();
    if (!root) return;
    const team = teams.find(x => x.id === state.activeTeam);
    let vals = last, st = 'ready', ev = null;
    if (!team || !team.members.length) { vals = { attack: 0, defense: 0, balance: 0 }; st = 'empty'; }
    else {
      const list = infoList(team);
      if (!list) st = 'loading';
      else { ev = evaluate(list); vals = ev; last = { attack: ev.attack, defense: ev.defense, balance: ev.balance }; ensureStats(team); }
    }
    root.dataset.state = st;
    [['attack', 'Ataque'], ['defense', 'Defesa'], ['balance', 'Equilíbrio']].forEach(([key, label]) => {
      const m = root.querySelector(`[data-meter="${key}"]`);
      if (!m) return;
      const pct = Math.max(0, Math.min(100, vals[key] || 0));
      m.querySelector('i').style.width = pct + '%';
      const bar = m.querySelector('.meter-bar');
      bar.setAttribute('aria-valuenow', String(pct));
      bar.setAttribute('aria-valuetext', st === 'empty' ? 'sem dados' : pct + ' de 100');
      const val = m.querySelector('.meter-val');
      if (val) val.textContent = st === 'empty' ? '—' : String(pct);
      m.dataset.note = st === 'empty' ? 'Adicione Pokémon ao time para calcular.' : st === 'loading' ? 'Carregando dados dos Pokémon…' : '';
    });
  }

  /* ---- balão explicativo (ⓘ): clique, foco ou passar o mouse ---- */
  let pop = null, popFor = null;
  function ensurePop() {
    if (pop) return pop;
    pop = document.createElement('div');
    pop.id = 'meterPop'; pop.setAttribute('role', 'tooltip'); pop.hidden = true;
    document.body.appendChild(pop);
    return pop;
  }
  function showPop(btn) {
    const key = btn.closest('[data-meter]')?.dataset.meter;
    if (!key) return;
    const p = ensurePop();
    const m = btn.closest('[data-meter]');
    p.innerHTML = `<b>${m.querySelector('b').textContent}</b><span>${EXPLAIN[key]}</span>${m.dataset.note ? `<em>${m.dataset.note}</em>` : ''}`;
    p.hidden = false;
    const r = btn.getBoundingClientRect(), pw = Math.min(300, window.innerWidth - 16);
    p.style.width = pw + 'px';
    p.style.left = Math.max(8, Math.min(window.innerWidth - pw - 8, r.right - pw)) + 'px';
    p.style.top = (r.bottom + 8) + 'px';
    const pr = p.getBoundingClientRect();
    if (pr.bottom > window.innerHeight - 8) p.style.top = Math.max(8, r.top - pr.height - 8) + 'px';
    document.querySelectorAll('.meter-info[aria-expanded="true"]').forEach(b => b.setAttribute('aria-expanded', 'false'));
    btn.setAttribute('aria-expanded', 'true');
    popFor = btn;
  }
  function hidePop() {
    if (pop) pop.hidden = true;
    if (popFor) popFor.setAttribute('aria-expanded', 'false');
    popFor = null;
  }
  document.addEventListener('click', e => {
    const b = e.target.closest?.('.meter-info');
    if (b) { e.preventDefault(); popFor === b ? hidePop() : showPop(b); return; }
    if (!e.target.closest?.('#meterPop')) hidePop();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') hidePop(); });
  document.addEventListener('mouseover', e => { const b = e.target.closest?.('.meter-info'); if (b && popFor !== b) showPop(b); });
  document.addEventListener('mouseout', e => { const b = e.target.closest?.('.meter-info'); if (b && popFor === b && !b.matches(':focus')) hidePop(); });
  document.addEventListener('focusin', e => { const b = e.target.closest?.('.meter-info'); if (b) showPop(b); });
  window.addEventListener('scroll', hidePop, { passive: true });

  const original = renderTeams;
  renderTeams = function () {
    const r = original.apply(this, arguments);
    try { update(); } catch (e) { console.warn('Falha ao atualizar indicadores do time', e); }
    return r;
  };
  window.PTTeamMeters = { update };
  try { update(); } catch (e) { /* ainda sem dados */ }
})();
