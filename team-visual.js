/* PokéTeam — página Times: indicadores Ataque / Defesa / Equilíbrio do card Estratégia.
   Métricas derivadas SOMENTE de dados que o site já usa (tipos elementais e a tabela de tipos),
   com as mesmas funções da "Análise do time" (teamMetricsFromTypes):
   - Ataque:     % dos 18 tipos contra os quais algum tipo do time é super efetivo (cobertura elemental).
   - Defesa:     % dos 18 tipos atacantes a que pelo menos um membro resiste ou é imune.
   - Equilíbrio: a mesma nota 0-100 exibida em "Análise do time".
   Não usa estatísticas de base, movimentos, natureza ou itens (dados não disponíveis no site).
   Reage a adicionar, remover, trocar e limpar Pokémon porque todas as ações chamam renderTeams(). */
(() => {
  'use strict';
  if (typeof renderTeams !== 'function' || typeof teamMetricsFromTypes !== 'function' || typeof teams === 'undefined') return;

  const box = () => document.getElementById('strategyMeters');
  let last = { attack: 0, defense: 0, balance: 0 };

  function compute() {
    const t = teams.find(x => x.id === state.activeTeam);
    if (!t || !t.members.length) return null;
    const sets = t.members.map(id => state.details.get(id)?.types).filter(a => Array.isArray(a) && a.length);
    if (sets.length !== t.members.length) return undefined; // tipos ainda carregando
    const m = teamMetricsFromTypes(sets);
    const n = TYPES.length;
    return {
      attack: Math.round(m.covered.length / n * 100),
      defense: Math.round(m.defensiveCovered / n * 100),
      balance: m.score,
      notes: {
        attack: `${m.covered.length}/${n} tipos com vantagem elemental`,
        defense: `${m.defensiveCovered}/${n} tipos com resistência ou imunidade no time`,
        balance: `Nota ${m.score}/100 (a mesma de "Análise do time")`
      }
    };
  }

  function update() {
    const root = box();
    if (!root) return;
    const v = compute();
    let vals = last, state_ = 'ready', notes = null;
    if (v === null) { vals = { attack: 0, defense: 0, balance: 0 }; state_ = 'empty'; }
    else if (v === undefined) { state_ = 'loading'; }
    else { vals = v; notes = v.notes; last = { attack: v.attack, defense: v.defense, balance: v.balance }; }
    root.dataset.state = state_;
    const empty = 'Adicione Pokémon ao time para calcular';
    [['attack', 'Ataque'], ['defense', 'Defesa'], ['balance', 'Equilíbrio']].forEach(([key, label]) => {
      const m = root.querySelector(`[data-meter="${key}"]`);
      if (!m) return;
      const bar = m.querySelector('.meter-bar');
      const pct = Math.max(0, Math.min(100, vals[key] || 0));
      m.querySelector('i').style.width = pct + '%';
      bar.setAttribute('aria-valuenow', String(pct));
      bar.setAttribute('aria-valuetext', state_ === 'empty' ? 'sem dados' : pct + '%');
      m.title = state_ === 'empty' ? `${label}: ${empty}` : state_ === 'loading' ? `${label}: carregando tipos…` : `${label}: ${notes[key]}`;
    });
  }

  const original = renderTeams;
  renderTeams = function () {
    const r = original.apply(this, arguments);
    try { update(); } catch (e) { console.warn('Falha ao atualizar indicadores do time', e); }
    return r;
  };
  try { update(); } catch (e) { /* ainda sem dados */ }
})();
