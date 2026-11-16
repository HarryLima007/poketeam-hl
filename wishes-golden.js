/* PokéTeam — Desejos / Golden Collection (Pacote 03)
   Camada de apresentação sobre o sistema de favoritos existente (favorite-special-forms.js).
   - Fonte dos dados: as entradas já salvas em pt_favVariantsV2 (via o hook window.PTFavView chamado por renderFavs).
   - Filtros (Todos, Formas especiais, Shiny, Lendários), pesquisa (já existente) e ordenação (nome / nº da Pokédex)
     só alteram a EXIBIÇÃO: nenhum dado salvo é modificado.
   - Os contadores do card lateral são calculados a cada renderização a partir dos favoritos reais.
   - Não há data de adição salva, então não há ordenação por data. */
(() => {
  'use strict';
  const view = { filter: 'all', sort: 'num-asc' };
  const $ = id => document.getElementById(id);

  // "Lendários" = Lendários + Míticos (mesma convenção da referência visual e das listas já existentes no site)
  const isLegend = e => (typeof LEGENDARY !== 'undefined' && LEGENDARY.has(e.id)) || (typeof MYTHICAL !== 'undefined' && MYTHICAL.has(e.id));
  const nameOf = e => e.form?.label || (typeof cap === 'function' ? cap(state.list[e.id - 1]?.name || ('#' + e.id)) : String(e.id));

  function matches(e) {
    if (view.filter === 'special') return !!e.form;
    if (view.filter === 'shiny') return !!e.shiny;
    if (view.filter === 'legend') return isLegend(e);
    return true;
  }
  function apply(list) {
    const out = list.filter(matches);
    const byNum = (a, b) => a.id - b.id || (a.form ? 1 : 0) - (b.form ? 1 : 0) || (a.shiny ? 1 : 0) - (b.shiny ? 1 : 0);
    const byName = (a, b) => nameOf(a).localeCompare(nameOf(b), 'pt-BR', { sensitivity: 'base' }) || byNum(a, b);
    const cmp = { 'num-asc': byNum, 'num-desc': (a, b) => byNum(b, a), 'name-asc': byName, 'name-desc': (a, b) => byName(b, a) }[view.sort] || byNum;
    return out.sort(cmp);          // cópia filtrada: a lista salva não é reordenada
  }
  function emptyHTML(total, q) {
    if (!total) return '<div class="gc-empty"><b>Sua coleção está vazia</b><span>Favorite Pokémon na Pokédex (★) para vê-los aqui.</span></div>';
    return `<div class="gc-empty"><b>Nenhum favorito encontrado</b><span>${q ? 'Nada corresponde à busca com o filtro atual.' : 'Nenhum favorito nesta categoria.'} Ajuste a pesquisa ou escolha “Todos”.</span></div>`;
  }
  function after(all, shown) {
    const n = {
      total: all.length,
      special: all.filter(e => !!e.form).length,
      shiny: all.filter(e => !!e.shiny).length,
      legend: all.filter(isLegend).length
    };
    const set = (id, v) => { const el = $(id); if (el) el.textContent = String(v); };
    set('gcTotal', String(n.total).padStart(2, '0'));
    set('gcSpecial', n.special); set('gcShiny', n.shiny); set('gcLegend', n.legend);
    set('gcCntAll', n.total); set('gcCntSpecial', n.special); set('gcCntShiny', n.shiny); set('gcCntLegend', n.legend);
    const c = $('gcCount');
    if (c) c.textContent = n.total ? `Exibindo ${shown.length} de ${n.total} ${n.total === 1 ? 'favorito' : 'favoritos'}` : '';
  }
  window.PTFavView = { apply, emptyHTML, after };

  document.addEventListener('click', e => {
    const b = e.target.closest?.('[data-gc-filter]');
    if (!b) return;
    view.filter = b.dataset.gcFilter;
    document.querySelectorAll('[data-gc-filter]').forEach(x => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on)); });
    if (typeof renderFavs === 'function') renderFavs();
  });
  const sort = $('gcSort');
  if (sort) sort.addEventListener('change', () => { view.sort = sort.value; if (typeof renderFavs === 'function') renderFavs(); });
})();
