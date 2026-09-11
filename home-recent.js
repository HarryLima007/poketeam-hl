(() => {
  'use strict';

  const typeNames = typeof TYPE_PT !== 'undefined' ? TYPE_PT : {};
  const originalUpdateHome = typeof updateHome === 'function' ? updateHome : null;

  function recentEmptyHTML(){
    return `<div class="recent-empty-v2" aria-live="polite">
      <span class="recent-empty-mark" aria-hidden="true"><i></i></span>
      <div><strong>Sua jornada começa com uma busca.</strong><small>Os últimos Pokémon pesquisados aparecerão aqui.</small></div>
    </div>`;
  }

  function recentCardHTML(id){
    const p = state.list[id - 1] || {name:`#${id}`};
    const d = state.details.get(id);
    const types = d?.types || [];
    return `<button class="recent-poke-v2" data-recent="${id}" aria-label="Abrir ${cap(p.name)} na Pokédex">
      <span class="recent-art"><img loading="lazy" src="${sprite(id)}" alt=""></span>
      <span class="recent-copy">
        <small class="recent-number">#${pad(id)}</small>
        <strong>${cap(p.name)}</strong>
        <span class="recent-types">${types.length ? types.map(t=>`<i class="type ${t}">${typeNames[t] || cap(t)}</i>`).join('') : '<i class="recent-loading">carregando tipos…</i>'}</span>
      </span>
      <span class="recent-arrow" aria-hidden="true">→</span>
    </button>`;
  }

  function bindRecent(box){
    box.querySelectorAll('[data-recent]').forEach(b=>b.onclick=()=>openPokemon(+b.dataset.recent));
  }

  function renderRecentV2(){
    const box = document.querySelector('#recentList');
    if(!box) return;
    if(!recent.length){
      box.className = 'mini-list recent-list-v2 empty-state';
      box.innerHTML = recentEmptyHTML();
      return;
    }
    const ids = recent.slice(0,5);
    box.className = 'mini-list recent-list-v2';
    box.innerHTML = ids.map(recentCardHTML).join('');
    bindRecent(box);

    const missing = ids.filter(id=>!state.details.get(id)?.types?.length);
    if(missing.length){
      Promise.allSettled(missing.map(getDetail)).then(()=>{
        const current = recent.slice(0,5);
        if(current.length===ids.length && current.every((id,i)=>id===ids[i])){
          box.innerHTML = ids.map(recentCardHTML).join('');
          bindRecent(box);
        }
      });
    }
  }

  if(originalUpdateHome){
    updateHome = function(){
      const result = originalUpdateHome.apply(this, arguments);
      renderRecentV2();
      return result;
    };
  }

  document.addEventListener('click', e=>{
    if(e.target.closest?.('#modalContent [data-evo], #modalContent [data-special-open]')) requestAnimationFrame(renderRecentV2);
  });

  requestAnimationFrame(renderRecentV2);
})();
