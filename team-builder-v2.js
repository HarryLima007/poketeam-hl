/* PokéTeam — Team Builder (Pacote 02)
   Camada sobre o sistema existente (não substitui a lógica de equipes nem o formato de pt_teams):
   - Análise do time em abas (Visão Geral, Fraquezas, Resistências, Imunidades, Cobertura, Análise Completa).
   - Assistente de composição (recomendações calculadas com as mesmas funções da versão anterior).
   - Comparador de substituição (simulação com o mesmo motor; só altera a equipe após confirmação).
   - Cards de slot com tipos coloridos, destaque de seleção, confirmação ao remover e indicador de salvamento.
   Depende de: team-visual.js (PTTeamEngine), team-slot-picker.js (PTSlotPicker). */
(() => {
  'use strict';
  const E = window.PTTeamEngine, P = window.PTSlotPicker;
  if (!E || !P || typeof teamAnalysisHTML !== 'function' || typeof teams === 'undefined') return;

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const activeTeam = () => teams.find(t => t.id === state.activeTeam);
  const typeChip = t => `<span class="type ${t}">${TYPE_PT[t] || t}</span>`;
  const pill = (type, count, kind, suffix = '') => `<span class="analysis-pill ${kind}">${typeChip(type)}${count != null ? `<b>${count}${suffix}</b>` : ''}</span>`;
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  let anaTab = 'overview';
  let selectedSlot = null, lastTeamId = null;
  let recOffset = 0, recSig = '';
  let cmp = null;                      // { teamId, index, sel }

  /* =============== ANÁLISE EM ABAS =============== */
  const TABS = [['overview', 'Visão Geral', '📊'], ['weak', 'Fraquezas', '⚠️'], ['resist', 'Resistências', '🛡️'], ['immune', 'Imunidades', '🚫'], ['cover', 'Cobertura', '🎯'], ['full', 'Análise Completa', '📋']];

  function panelOverview(ev) {
    const adv = [];
    adv.push(`Cobertura ofensiva: <b>${ev.covered.length}/${TYPES.length}</b> tipos com vantagem elemental`);
    adv.push(`Resistência ou imunidade a <b>${ev.defensiveCovered}/${TYPES.length}</b> tipos atacantes`);
    const imm = ev.rows.filter(x => x.immune > 0);
    if (imm.length) adv.push(`Imunidades: ${imm.map(x => TYPE_PT[x.type]).join(', ')}`);
    adv.push(`Diversidade: ${plural(ev.elementTypes.length, 'tipo elemental', 'tipos elementais')}`);
    const vul = [];
    if (ev.shared.length) vul.push(`Fraquezas compartilhadas: ${ev.shared.map(x => `${TYPE_PT[x.type]} (${x.weak})`).join(', ')}`);
    else vul.push('Nenhuma fraqueza compartilhada por 2 ou mais membros');
    if (ev.uncovered.length) vul.push(`Sem cobertura elemental contra: ${ev.uncovered.map(t => TYPE_PT[t]).join(', ')}`);
    else vul.push('Cobertura completa dos 18 tipos');
    return `<div class="ana-overview">
      <div class="balance-card"><div><span class="eyebrow">EQUILÍBRIO GERAL</span><strong>${ev.balance}/100</strong><small>${ev.label}</small></div>
        <div class="balance-bar"><span style="width:${ev.balance}%"></span></div>
        <p>Indicador heurístico baseado em cobertura elemental, resistências/imunidades e fraquezas compartilhadas.</p></div>
      <div class="ana-summary">
        <div class="ana-sum good"><h4>✅ Principais vantagens</h4><ul>${adv.map(x => `<li>${x}</li>`).join('')}</ul></div>
        <div class="ana-sum bad"><h4>⚠️ Principais vulnerabilidades</h4><ul>${vul.map(x => `<li>${x}</li>`).join('')}</ul></div>
      </div></div>`;
  }
  function panelWeak(ev) {
    const shared = ev.rows.filter(x => x.weak >= 2).sort((a, b) => b.weak - a.weak || b.max - a.max);
    const single = ev.rows.filter(x => x.weak === 1).sort((a, b) => b.max - a.max);
    return `<details class="ana-fold" open><summary>Fraquezas compartilhadas <em>${shared.length}</em></summary><div class="analysis-pills">${shared.length ? shared.map(x => pill(x.type, x.weak, 'weak', ' vulneráveis')).join('') : '<span class="muted">Nenhuma fraqueza compartilhada por 2 ou mais membros.</span>'}</div></details>
      <details class="ana-fold" open><summary>Fraquezas individuais <em>${single.length}</em></summary><div class="analysis-pills">${single.length ? single.map(x => pill(x.type, x.weak, 'weak', ' vulnerável')).join('') : '<span class="muted">Nenhuma.</span>'}</div></details>`;
  }
  function panelResist(ev) {
    const r = ev.rows.filter(x => x.resist > 0).sort((a, b) => b.resist - a.resist);
    return `<details class="ana-fold" open><summary>Tipos resistidos <em>${r.length}</em></summary><div class="analysis-pills">${r.length ? r.map(x => pill(x.type, x.resist, 'resist', x.resist > 1 ? ' resistentes' : ' resistente')).join('') : '<span class="muted">Nenhuma resistência identificada.</span>'}</div></details>`;
  }
  function panelImmune(ev) {
    const r = ev.rows.filter(x => x.immune > 0).sort((a, b) => b.immune - a.immune);
    return `<details class="ana-fold" open><summary>Imunidades <em>${r.length}</em></summary><div class="analysis-pills">${r.length ? r.map(x => pill(x.type, x.immune, 'immune', x.immune > 1 ? ' imunes' : ' imune')).join('') : '<span class="muted">Nenhuma imunidade no time.</span>'}</div></details>`;
  }
  function panelCover(ev) {
    const cov = TYPES.filter(d => ev.covered.includes(d));
    return `<div class="coverage-head"><h4>🎯 Cobertura elemental</h4><b>${ev.covered.length}/${TYPES.length} tipos</b></div>
      <p class="muted">Contra quais tipos a combinação elemental natural do time oferece vantagem geral.</p>
      <details class="ana-fold" open><summary>Super efetivo contra <em>${cov.length}</em></summary><div class="analysis-pills">${cov.map(t => pill(t, null, 'coverage')).join('')}</div></details>
      <details class="ana-fold" open><summary>Sem cobertura elemental <em>${ev.uncovered.length}</em></summary><div class="analysis-pills">${ev.uncovered.length ? ev.uncovered.map(t => pill(t, null, 'uncovered')).join('') : '<span class="muted">Cobertura completa dos 18 tipos.</span>'}</div></details>
      <details class="ana-fold"><summary>Tipos elementais disponíveis <em>${ev.elementTypes.length}</em></summary><div class="analysis-pills">${ev.elementTypes.map(t => pill(t, null, 'elemental')).join('')}</div></details>`;
  }
  function panelFull(ev, list) {
    const head = list.map((m, i) => `<th title="${esc(cap(state.list[m.id - 1]?.name || ''))}">${String(i + 1).padStart(2, '0')}</th>`).join('');
    const fmt = v => v === 0 ? '0' : v === 0.25 ? '¼' : v === 0.5 ? '½' : v === 2 ? '2×' : v === 4 ? '4×' : '·';
    const body = TYPES.map(t => `<tr><th scope="row">${typeChip(t)}</th>${list.map(m => { const v = defensiveMultiplier(t, m.types); return `<td class="mx ${v === 0 ? 'z' : v > 1 ? 'w' : v < 1 ? 'r' : ''}">${fmt(v)}</td>`; }).join('')}</tr>`).join('');
    return `${panelOverview(ev)}
      <h4 class="ana-h">Fraquezas</h4>${panelWeak(ev)}
      <h4 class="ana-h">Resistências</h4>${panelResist(ev)}
      <h4 class="ana-h">Imunidades</h4>${panelImmune(ev)}
      <h4 class="ana-h">Cobertura elemental</h4>${panelCover(ev)}
      <details class="ana-fold"><summary>Tabela de dano recebido por membro <em>18 × ${list.length}</em></summary>
        <div class="mx-wrap"><table class="mx-table"><thead><tr><th>Atacante</th>${head}</tr></thead><tbody>${body}</tbody></table></div>
        <p class="muted mx-note">0 = imune · ¼/½ = resiste · · = normal · 2×/4× = fraco. Usa a tipagem da forma escolhida em cada slot.</p></details>
      <p class="analysis-note">Base universal do PokéTeam: esta análise usa apenas tipos elementais, fraquezas, resistências, imunidades e complementaridade. Mecânicas específicas de jogos são ignoradas.</p>`;
  }

  teamAnalysisHTML = function (t) {
    if (!t.members.length) return '<div class="team-analysis empty-analysis"><h3>🛡️ Análise de tipos</h3><p>Adicione Pokémon para analisar defesa, cobertura ofensiva e equilíbrio do time.</p></div>';
    const list = E.infoList(t);
    if (!list) return '<div class="team-analysis"><h3>🛡️ Análise de tipos</h3><p class="muted">Carregando tipos dos Pokémon…</p></div>';
    const ev = E.evaluate(list);
    const panels = { overview: panelOverview(ev), weak: panelWeak(ev), resist: panelResist(ev), immune: panelImmune(ev), cover: panelCover(ev), full: panelFull(ev, list) };
    const tabs = TABS.map(([k, l, ic]) => `<button type="button" role="tab" class="ana-tab${anaTab === k ? ' active' : ''}" data-ana-tab="${k}" aria-selected="${anaTab === k}"><span aria-hidden="true">${ic}</span> ${l}</button>`).join('');
    return `<div class="team-analysis">
      <div class="analysis-head"><div><span class="eyebrow">VISÃO GERAL DO TIME</span><h3>🎯 Análise do time</h3></div><span class="analysis-count">${t.members.length}/6 Pokémon</span></div>
      <div class="ana-tabs" role="tablist" aria-label="Seções da análise">${tabs}</div>
      ${TABS.map(([k]) => `<div class="ana-panel" role="tabpanel" data-ana-panel="${k}"${anaTab === k ? '' : ' hidden'}>${panels[k]}</div>`).join('')}
    </div>`;
  };

  /* =============== RECOMENDAÇÕES (mesmos cálculos de antes, com a tipagem efetiva dos slots) =============== */
  function computeRecs(t, filter, limit) {
    if (t.members.length >= 6) return [];
    const list = E.infoList(t);
    if (!list) return [];
    const currentTypes = list.map(x => x.types);
    const base = teamMetricsFromTypes(currentTypes);
    const existing = new Set(t.members);
    return state.list.filter(p => !existing.has(p.id) && recommendationFilterMatch(p, filter) && state.details.get(p.id)?.types?.length).map(p => {
      const types = state.details.get(p.id).types;
      const next = teamMetricsFromTypes([...currentTypes, types]);
      const newCoverage = next.covered.filter(x => !base.covered.includes(x));
      const fixedWeaknesses = base.shared.filter(w => !next.shared.some(n => n.type === w.type && n.weak >= w.weak));
      const resistsWeaknesses = base.shared.filter(w => { const m = defensiveMultiplier(w.type, types); return m > 0 && m < 1; });
      const immunesWeaknesses = base.shared.filter(w => defensiveMultiplier(w.type, types) === 0);
      const gain = next.score - base.score;
      const diversityGain = new Set([...base.elementTypes, ...types]).size - base.elementTypes.length;
      const utility = gain * 100 + newCoverage.length * 16 + fixedWeaknesses.length * 14 + resistsWeaknesses.length * 8 + immunesWeaknesses.length * 12 + diversityGain * 6;
      return { p, types, nextScore: next.score, gain, newCoverage, fixedWeaknesses, resistsWeaknesses, immunesWeaknesses, diversityGain, synergy: synergyLabel(gain, newCoverage, resistsWeaknesses, immunesWeaknesses), utility };
    }).sort((a, b) => b.utility - a.utility || b.nextScore - a.nextScore || a.p.id - b.p.id).slice(0, limit);
  }
  computeTeamRecommendations = function (t, filter = 'all', limit = 8) { return computeRecs(t, filter, limit); };

  function reasonsOf(r) {
    const out = [];
    if (r.immunesWeaknesses.length) out.push(`Anula as fraquezas ${r.immunesWeaknesses.map(x => TYPE_PT[x.type]).join(', ')}`);
    if (r.resistsWeaknesses.length) out.push(`Resiste a ${r.resistsWeaknesses.map(x => TYPE_PT[x.type]).join(', ')}, hoje fraquezas do time`);
    if (r.newCoverage.length) out.push(`Amplia a cobertura em +${r.newCoverage.length} ${r.newCoverage.length === 1 ? 'tipo' : 'tipos'} (${r.newCoverage.slice(0, 3).map(x => TYPE_PT[x]).join(', ')}${r.newCoverage.length > 3 ? '…' : ''})`);
    if (r.diversityGain > 0) out.push('Aumenta a diversidade elemental');
    if (!out.length && r.gain > 0) out.push(`Melhora o equilíbrio em +${r.gain}`);
    if (!out.length) out.push('Complementa os tipos atuais');
    return out.slice(0, 4);
  }

  function assistantHTML(t) {
    const filter = state.teamRecFilter || 'no-legend';
    const regionOptions = REGIONS.map(r => `<option value="region:${r[0]}" ${filter === `region:${r[0]}` ? 'selected' : ''}>${r[0]}</option>`).join('');
    const select = `<select id="teamRecFilter" aria-label="Filtro de recomendações"><option value="no-legend" ${filter === 'no-legend' ? 'selected' : ''}>Sem Lendários/Míticos</option><option value="all" ${filter === 'all' ? 'selected' : ''}>Todos</option><option value="legendary" ${filter === 'legendary' ? 'selected' : ''}>Lendários</option><option value="mythical" ${filter === 'mythical' ? 'selected' : ''}>Míticos</option>${regionOptions}</select>`;
    const head = `<div class="side-head"><h3>✨ Recomendação do Assistente</h3>${select}</div>`;
    const list = E.infoList(t);
    if (!list) return `<section class="side-panel assistant">${head}<p class="muted">Carregando dados para gerar recomendações…</p></section>`;
    const sig = t.id + '|' + t.members.join(',') + '|' + (t.memberForms || []).map(f => f?.formName || '').join(',') + '|' + filter;
    if (sig !== recSig) { recSig = sig; recOffset = 0; }
    const recs = computeRecs(t, filter, 8);
    if (!recs.length) return `<section class="side-panel assistant">${head}<div class="empty-state">Nenhum candidato disponível com este filtro (os dados dos Pokémon ainda podem estar carregando).</div></section>`;
    const i = recOffset % recs.length, r = recs[i];
    const others = recs.map((x, k) => [x, k]).filter(([, k]) => k !== i).slice(0, 4);
    return `<section class="side-panel assistant">${head}
      <article class="rec-featured">
        <img src="${sprite(r.p.id, false)}" alt="" loading="lazy">
        <div class="rec-feat-main"><b>#${pad(r.p.id)} ${esc(cap(r.p.name))}</b><div class="types">${r.types.map(typeChip).join('')}</div><span class="synergy-badge">Sinergia: ${r.synergy}</span></div>
        <div class="rec-feat-score"><span>Nova nota</span><strong>${r.nextScore}/100</strong><small>${r.gain >= 0 ? '+' : ''}${r.gain}</small></div>
      </article>
      <div class="rec-why"><h4>Por que esta recomendação?</h4><ul>${reasonsOf(r).map(x => `<li>${x}</li>`).join('')}</ul></div>
      <div class="rec-actions"><button type="button" class="primary" data-rec-pick="${r.p.id}">Adicionar</button><button type="button" data-rec-next="1">Ver outras opções</button></div>
      <p class="rec-count" aria-live="polite">Opção ${i + 1} de ${recs.length}</p>
      <h4 class="side-sub">🏆 Melhores alternativas</h4>
      <div class="rec-top">${others.map(([x, k]) => `<button type="button" class="rec-mini" data-rec-show="${k}" title="${esc(cap(x.p.name))} — nota ${x.nextScore}/100"><img src="${sprite(x.p.id, false)}" alt="" loading="lazy"><b>${esc(cap(x.p.name))}</b><span class="rec-mini-types">${x.types.map(typeChip).join('')}</span><small>${x.nextScore}/100</small></button>`).join('')}</div>
    </section>`;
  }

  /* =============== COMPARADOR =============== */
  const artOf = (id, shiny, form) => form ? ((shiny && form.shinyArt) ? form.shinyArt : (form.art || sprite(id, shiny))) : sprite(id, shiny);
  const nameOf = (id, form) => form?.label || cap(state.list[id - 1]?.name || ('#' + id));
  const MINUS = '\u2212';

  function simulate(t) {
    if (!cmp || cmp.teamId !== t.id || cmp.index >= t.members.length) return null;
    const list = E.infoList(t);
    const d = state.details.get(cmp.sel.id);
    if (!list || !d?.types?.length) return null;
    const f = cmp.sel.form;
    const cand = { id: cmp.sel.id, types: (f && f.types && f.types.length) ? [...f.types] : [...d.types], stats: d.stats || null, form: f };
    const sim = list.slice(); sim[cmp.index] = cand;
    return { cur: E.evaluate(list), sim: E.evaluate(sim), cand };
  }
  function deltaHTML(d) {
    const kind = d > 0 ? 'up' : d < 0 ? 'down' : 'zero';
    const icon = d > 0 ? '▲' : d < 0 ? '▼' : '●';
    const txt = d > 0 ? `+${d}` : d < 0 ? `${MINUS}${Math.abs(d)}` : '0';
    const word = d > 0 ? 'ganho' : d < 0 ? 'perda' : 'sem mudança';
    return `<span class="delta ${kind}"><i aria-hidden="true">${icon}</i><b>${txt}</b><span class="sr-only"> ${word}</span></span>`;
  }

  function comparatorHTML(t) {
    const idx = cmp && cmp.teamId === t.id ? cmp.index : (selectedSlot != null && selectedSlot < t.members.length ? selectedSlot : 0);
    const options = t.members.map((id, i) => `<option value="${i}" ${i === idx ? 'selected' : ''}>${String(i + 1).padStart(2, '0')} · ${esc(nameOf(id, t.memberForms?.[i]))}</option>`).join('');
    const sim = simulate(t);
    let result = '<p class="muted cmp-hint">Escolha um Pokémon da equipe e um candidato para ver o efeito na composição. A simulação não altera a equipe salva.</p>';
    if (sim) {
      const i = cmp.index, outId = t.members[i], outForm = t.memberForms?.[i] || null;
      const outShiny = !!t.memberShiny?.[i], outIV = !!t.memberIV100?.[i];
      const row = (icon, label, key) => { const a = sim.cur[key], b = sim.sim[key]; return `<div class="cmp-row"><span class="cmp-label"><span aria-hidden="true">${icon}</span> ${label}</span><span class="cmp-vals"><span class="cmp-from">${a}</span><span aria-hidden="true">→</span><b class="cmp-to">${b}</b></span>${deltaHTML(b - a)}</div>`; };
      const dA = sim.sim.attack - sim.cur.attack, dD = sim.sim.defense - sim.cur.defense, dB = sim.sim.balance - sim.cur.balance;
      const sgn = x => Math.sign(x);
      const diverge = (dA !== 0 || dD !== 0) && (sgn(dB) !== sgn(dA) || sgn(dB) !== sgn(dD));
      const note = diverge ? `<p class="cmp-note" role="note"><b>Por que os números divergem?</b> O Equilíbrio usa apenas critérios de tipos (cobertura elemental, resistências/imunidades e fraquezas compartilhadas). Ataque e Defesa também incluem os atributos base dos Pokémon, por isso podem variar de forma diferente.</p>` : '';
      result = `<div class="cmp-swap">
          <div class="cmp-poke out"><img src="${artOf(outId, outShiny, outForm)}" alt=""><small>Sai · slot ${String(i + 1).padStart(2, '0')}</small><b>${esc(nameOf(outId, outForm))}${outShiny ? ' ✨' : ''}${outIV ? ' 💯' : ''}</b></div>
          <span class="cmp-arrow" aria-hidden="true">→</span>
          <div class="cmp-poke in"><img src="${artOf(sim.cand.id, cmp.sel.shiny, cmp.sel.form)}" alt=""><small>Entra</small><b>${esc(nameOf(sim.cand.id, cmp.sel.form))}${cmp.sel.shiny ? ' ✨' : ''}${cmp.sel.iv100 ? ' 💯' : ''}</b></div>
        </div>
        <div class="cmp-scores"><div class="cur"><small>Equipe atual</small><b>${sim.cur.balance}<span>/100</span></b></div><span class="cmp-arrow" aria-hidden="true">→</span><div class="sim ${dB > 0 ? 'up' : dB < 0 ? 'down' : ''}"><small>Equipe simulada</small><b>${sim.sim.balance}<span>/100</span></b>${deltaHTML(dB)}</div></div>
        <div class="cmp-rows" role="group" aria-label="Diferenças por indicador">${row('⚔️', 'Ataque', 'attack')}${row('🛡️', 'Defesa', 'defense')}${row('⚖️', 'Equilíbrio', 'balance')}</div>
        ${note}
        <div class="cmp-actions"><button type="button" id="cmpConfirm" class="primary">Confirmar substituição</button><button type="button" id="cmpCancel">Cancelar comparação</button></div>`;
    } else if (cmp && cmp.teamId === t.id) {
      result = '<p class="muted cmp-hint">Calculando comparação…</p><div class="cmp-actions"><button type="button" id="cmpCancel">Cancelar comparação</button></div>';
    }
    return `<section class="side-panel comparator" id="comparatorPanel"><div class="side-head"><h3>⚖️ Comparador de Composição</h3></div>
      <div class="cmp-controls"><label for="cmpMember">Substituir</label><select id="cmpMember">${options}</select><button type="button" id="cmpPick">${cmp && cmp.teamId === t.id ? 'Trocar candidato' : 'Escolher candidato'}</button></div>${result}</section>`;
  }

  /* ---- Assistente para equipe COMPLETA: sugere substituições (usa os mesmos cálculos de tipos; nunca altera a equipe) ---- */
  let swapCache = { sig: '', data: null };
  function computeSwapRecs(t, filter, limit) {
    const list = E.infoList(t);
    if (!list) return null;
    const sig = [t.id, t.members.join(','), (t.memberForms || []).map(f => f?.formName || '').join(','), filter, state.details.size].join('|');
    if (swapCache.sig === sig) return swapCache.data;
    const curTypes = list.map(x => x.types);
    const cur = teamMetricsFromTypes(curTypes);
    const existing = new Set(t.members);
    const found = [];
    for (const p of state.list) {
      if (existing.has(p.id) || !recommendationFilterMatch(p, filter)) continue;
      const types = state.details.get(p.id)?.types;
      if (!types?.length) continue;
      let best = null;
      for (let i = 0; i < list.length; i++) {
        const next = teamMetricsFromTypes(curTypes.map((x, k) => k === i ? types : x));
        const gain = next.score - cur.score;
        if (gain <= 0) continue;
        const utility = gain * 100 + (next.covered.length - cur.covered.length) * 16 + (next.defensiveCovered - cur.defensiveCovered) * 8;
        if (!best || utility > best.utility) best = { index: i, p, types, next, gain, utility };
      }
      if (best) found.push(best);
    }
    found.sort((a, b) => b.utility - a.utility || b.next.score - a.next.score || a.p.id - b.p.id);
    const data = { cur, items: found.slice(0, limit).map(r => {
      const newCov = r.next.covered.filter(x => !cur.covered.includes(x));
      const fixed = cur.shared.filter(w => !r.next.shared.some(n => n.type === w.type && n.weak >= w.weak));
      const reasons = [];
      if (newCov.length) reasons.push(`Amplia a cobertura em +${newCov.length} ${newCov.length === 1 ? 'tipo' : 'tipos'} (${newCov.slice(0, 3).map(x => TYPE_PT[x]).join(', ')}${newCov.length > 3 ? '…' : ''})`);
      if (fixed.length) reasons.push(`Reduz fraquezas compartilhadas: ${fixed.map(x => TYPE_PT[x.type]).join(', ')}`);
      if (r.next.defensiveCovered > cur.defensiveCovered) reasons.push(`Resistência ou imunidade a +${r.next.defensiveCovered - cur.defensiveCovered} ${r.next.defensiveCovered - cur.defensiveCovered === 1 ? 'tipo' : 'tipos'}`);
      if (!reasons.length) reasons.push(`Melhora o equilíbrio em +${r.gain}`);
      return { ...r, reasons: reasons.slice(0, 4) };
    }) };
    swapCache = { sig, data };
    return data;
  }

  function swapAssistantHTML(t) {
    const filter = state.teamRecFilter || 'no-legend';
    const regionOptions = REGIONS.map(r => `<option value="region:${r[0]}" ${filter === `region:${r[0]}` ? 'selected' : ''}>${r[0]}</option>`).join('');
    const select = `<select id="teamRecFilter" aria-label="Filtro de recomendações"><option value="no-legend" ${filter === 'no-legend' ? 'selected' : ''}>Sem Lendários/Míticos</option><option value="all" ${filter === 'all' ? 'selected' : ''}>Todos</option><option value="legendary" ${filter === 'legendary' ? 'selected' : ''}>Lendários</option><option value="mythical" ${filter === 'mythical' ? 'selected' : ''}>Míticos</option>${regionOptions}</select>`;
    const head = `<div class="side-head"><h3>✨ Sugestões de substituição</h3>${select}</div><p class="muted side-lead">Equipe completa (6/6): o assistente testa trocar cada membro por outro Pokémon. Nada é alterado sem a sua confirmação.</p>`;
    const data = computeSwapRecs(t, filter, 8);
    if (!data) return `<section class="side-panel assistant">${head}<p class="muted">Carregando dados para gerar sugestões…</p></section>`;
    const sig = t.id + '|' + t.members.join(',') + '|' + filter + '|swap';
    if (sig !== recSig) { recSig = sig; recOffset = 0; }
    if (!data.items.length) return `<section class="side-panel assistant">${head}<div class="empty-state">Nenhuma substituição melhora a pontuação com este filtro. (Os dados dos Pokémon ainda podem estar carregando.)</div></section>`;
    const i = recOffset % data.items.length, r = data.items[i];
    const m = E.memberInfo(t, r.index);
    const outName = nameOf(t.members[r.index], t.memberForms?.[r.index]);
    const others = data.items.map((x, k) => [x, k]).filter(([, k]) => k !== i).slice(0, 4);
    return `<section class="side-panel assistant">${head}
      <article class="rec-featured swap">
        <div class="swap-line">
          <span class="swap-poke"><img src="${artOf(t.members[r.index], !!t.memberShiny?.[r.index], t.memberForms?.[r.index])}" alt=""><small>Sai · ${String(r.index + 1).padStart(2, '0')}</small><b>${esc(outName)}</b></span>
          <span class="cmp-arrow" aria-hidden="true">→</span>
          <span class="swap-poke"><img src="${sprite(r.p.id, false)}" alt=""><small>Entra · #${pad(r.p.id)}</small><b>${esc(cap(r.p.name))}</b></span>
        </div>
        <div class="types swap-types">${r.types.map(typeChip).join('')}</div>
        <div class="swap-scores"><span>Pontuação atual <b>${data.cur.score}</b></span><span aria-hidden="true">→</span><span>Simulada <b>${r.next.score}</b></span>${deltaHTML(r.gain)}</div>
      </article>
      <div class="rec-why"><h4>Por que esta sugestão?</h4><ul>${r.reasons.map(x => `<li>${x}</li>`).join('')}</ul></div>
      <p class="muted swap-hint">Pontuação = Equilíbrio (critérios de tipos). Use “Comparar” para ver também Ataque e Defesa.</p>
      <div class="rec-actions"><button type="button" class="primary" data-rec-compare="${r.p.id}:${r.index}">Comparar</button><button type="button" data-rec-next="1">Ver outras opções</button></div>
      <p class="rec-count" aria-live="polite">Sugestão ${i + 1} de ${data.items.length}</p>
      <h4 class="side-sub">🏆 Outras substituições</h4>
      <div class="rec-top">${others.map(([x, k]) => `<button type="button" class="rec-mini" data-rec-show="${k}" title="Substituir ${String(x.index + 1).padStart(2, '0')} por ${esc(cap(x.p.name))} — ${data.cur.score} → ${x.next.score}"><img src="${sprite(x.p.id, false)}" alt="" loading="lazy"><b>${esc(cap(x.p.name))}</b><small class="rec-mini-sub">no lugar do ${String(x.index + 1).padStart(2, '0')}</small><small>${data.cur.score} → ${x.next.score}</small></button>`).join('')}</div>
    </section>`;
  }

  teamRecommendationsHTML = function (t) {
    if (!t.members.length) return '';
    return `<div class="team-recommendations team-side">${comparatorHTML(t)}${t.members.length < 6 ? assistantHTML(t) : swapAssistantHTML(t)}</div>`;
  };
  /* =============== DECORAÇÃO DO DOM APÓS CADA RENDER =============== */
  function decorate() {
    const t = activeTeam();
    if (t && t.id !== lastTeamId) { lastTeamId = t.id; selectedSlot = null; if (cmp && cmp.teamId !== t.id) cmp = null; }
    if (!t) { cmp = null; return; }
    if (cmp && cmp.index >= t.members.length) cmp = null;
    if (selectedSlot != null && selectedSlot >= t.members.length) selectedSlot = null;
    document.querySelectorAll('#teamTabs button[data-team]').forEach(b => {
      const tm = teams.find(x => String(x.id) === b.dataset.team);
      if (!tm || b.querySelector('.tab-count')) return;
      const name = b.textContent;
      b.innerHTML = `<span class="tab-name">${esc(name)}</span><small class="tab-count">${tm.members.length}/6 Pokémon</small>`;
      b.title = `${name} — ${tm.members.length}/6 Pokémon`;
      if (b.classList.contains('active')) b.setAttribute('aria-current', 'true');
    });
    const head = document.querySelector('#teamArea .team-head');
    if (head && !head.querySelector('.save-status')) {
      const s = document.createElement('span'); s.className = 'save-status'; s.setAttribute('aria-live', 'polite'); s.textContent = '✓ Salvo automaticamente';
      head.querySelector('h2')?.after(s);
    }
    document.querySelectorAll('#teamArea .slot.filled').forEach((slot, i) => {
      slot.dataset.slotIndex = String(i);
      slot.classList.toggle('selected', selectedSlot === i);
      slot.setAttribute('aria-pressed', selectedSlot === i ? 'true' : 'false');
      let box = slot.querySelector('.slot-types');
      const m = E.memberInfo(t, i);
      if (!box) { box = document.createElement('div'); box.className = 'slot-types'; (slot.querySelector('h4') || slot.firstChild).after(box); }
      box.innerHTML = m ? `<span class="slot-num">#${pad(m.id)}</span><span class="slot-chips">${m.types.map(typeChip).join('')}</span>` : '<span class="muted">carregando tipos…</span>';
    });
  }

  const originalRenderTeams = renderTeams;
  renderTeams = function () {
    const r = originalRenderTeams.apply(this, arguments);
    try { decorate(); } catch (e) { console.warn('Falha ao decorar Times', e); }
    return r;
  };

  /* =============== INTERAÇÕES =============== */
  document.addEventListener('click', async e => {
    const tgt = e.target;
    const tab = tgt.closest?.('[data-ana-tab]');
    if (tab) {
      anaTab = tab.dataset.anaTab;
      const root = tab.closest('.team-analysis');
      root.querySelectorAll('[data-ana-tab]').forEach(b => { const on = b.dataset.anaTab === anaTab; b.classList.toggle('active', on); b.setAttribute('aria-selected', String(on)); });
      root.querySelectorAll('[data-ana-panel]').forEach(p => { p.hidden = p.dataset.anaPanel !== anaTab; });
      return;
    }
    const t = activeTeam();
    if (!t) return;
    const pick = tgt.closest?.('[data-rec-pick]');
    if (pick) { e.preventDefault(); await P.applySelection(t, null, { id: Number(pick.dataset.recPick), shiny: false, iv100: false, form: null }); return; }
    if (tgt.closest?.('[data-rec-next]')) { recOffset++; renderTeams(); return; }
    const cmpBtn = tgt.closest?.('[data-rec-compare]');
    if (cmpBtn) {
      // inicia uma comparação a partir da sugestão (não altera a equipe)
      const [cid, cidx] = cmpBtn.dataset.recCompare.split(':').map(Number);
      await getDetail(cid);
      cmp = { teamId: t.id, index: cidx, sel: { id: cid, shiny: false, iv100: false, form: null } };
      selectedSlot = cidx;
      renderTeams();
      const panel = document.getElementById('comparatorPanel');
      if (panel) panel.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' });
      return;
    }
    const show = tgt.closest?.('[data-rec-show]');
    if (show) { recOffset = Number(show.dataset.recShow); renderTeams(); return; }
    if (tgt.closest?.('#cmpPick')) {
      const idx = Number(document.getElementById('cmpMember')?.value || 0);
      P.open('compare', idx, async sel => {
        await getDetail(sel.id);
        cmp = { teamId: t.id, index: idx, sel };
        selectedSlot = idx;
        renderTeams();
      });
      return;
    }
    if (tgt.closest?.('#cmpCancel')) { cmp = null; renderTeams(); return; }
    if (tgt.closest?.('#cmpConfirm')) {
      if (!cmp || cmp.teamId !== t.id) return;
      const { index, sel } = cmp;
      cmp = null;
      await P.applySelection(t, index, sel);
      return;
    }
    // seleção de slot preenchido (ignora cliques em botões)
    const slot = tgt.closest?.('#teamArea .slot.filled');
    if (slot && !tgt.closest('button')) {
      const i = Number(slot.dataset.slotIndex);
      selectedSlot = selectedSlot === i ? null : i;
      document.querySelectorAll('#teamArea .slot.filled').forEach((s, k) => { s.classList.toggle('selected', selectedSlot === k); s.setAttribute('aria-pressed', selectedSlot === k ? 'true' : 'false'); });
      const sel = document.getElementById('cmpMember'); if (sel && selectedSlot != null) sel.value = String(selectedSlot);
    }
  });
  // navegação por teclado nas abas da análise (←/→/Home/End)
  document.addEventListener('keydown', e => {
    const tab = e.target.closest?.('[data-ana-tab]');
    if (!tab || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    const tabs = [...tab.closest('.ana-tabs').querySelectorAll('[data-ana-tab]')];
    let i = tabs.indexOf(tab);
    i = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    e.preventDefault();
    tabs[i].focus();
    tabs[i].click();
    document.querySelector(`[data-ana-tab="${tabs[i].dataset.anaTab}"]`)?.focus();
  });
  document.addEventListener('change', e => {
    if (e.target.id === 'cmpMember') {
      const t = activeTeam(); if (!t) return;
      const i = Number(e.target.value);
      selectedSlot = i;
      if (cmp && cmp.teamId === t.id) cmp.index = i;
      renderTeams();
    }
  });

  // Remover: confirmação (as ações Limpar e Excluir já pedem confirmação no código original)
  document.addEventListener('click', async e => {
    const btn = e.target.closest?.('#teamArea [data-remove-member]');
    if (!btn || btn.dataset.confirmed === '1') return;
    e.preventDefault(); e.stopImmediatePropagation();
    const t = activeTeam(); const i = Number(btn.dataset.removeMember);
    const nm = t ? (t.memberForms?.[i]?.label || cap(state.list[t.members[i] - 1]?.name || 'Pokémon')) : 'Pokémon';
    const ok = await siteConfirm(`Remover ${nm} do slot ${String(i + 1).padStart(2, '0')} de "${t?.name || ''}"?`, { title: 'Remover Pokémon', confirmText: 'Remover', icon: '🗑️', danger: true });
    if (!ok) return;
    if (typeof btn.onclick === 'function') btn.onclick.call(btn);
  }, true);

  /* indicador discreto de salvamento (a persistência continua automática em save()) */
  const originalSave = save;
  let flashTimer = null;
  save = function () {
    const r = originalSave.apply(this, arguments);
    if (r !== false) {
      document.querySelectorAll('#teamArea .save-status').forEach(s => { s.textContent = '✓ Alterações salvas'; s.classList.add('flash'); });
      clearTimeout(flashTimer);
      flashTimer = setTimeout(() => document.querySelectorAll('#teamArea .save-status').forEach(s => { s.textContent = '✓ Salvo automaticamente'; s.classList.remove('flash'); }), 1800);
    }
    return r;
  };

  try { renderTeams(); } catch (e) { /* tela ainda não pronta */ }
})();
