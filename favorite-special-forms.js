(() => {
  'use strict';

  let pendingFavForm = null;
  let favForms = {};
  try{
    const saved = JSON.parse(localStorage.getItem('pt_favForms') || '{}');
    favForms = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
  }catch{
    favForms = {};
  }

  function persistFavForms(){
    try{ localStorage.setItem('pt_favForms', JSON.stringify(favForms)); }
    catch(err){ console.warn('Falha ao salvar formas favoritas', err); }
  }

  function labelForForm(id, form){
    const baseName = state.list[id - 1]?.name || `pokemon-${id}`;
    return form?.label || specialFormLabel(form?.formName || '', baseName);
  }

  function formPayload(id, category, index){
    if(!category || !['mega','gmax','transform'].includes(category)) return null;
    const form = specialFormsFor(id, category)?.[index];
    if(!form) return null;
    return {
      category,
      index,
      formName: form.formName || '',
      label: labelForForm(id, form),
      art: form.art || '',
      shinyArt: form.shinyArt || '',
      types: Array.isArray(form.types) ? [...form.types] : []
    };
  }

  function formFromCard(card){
    if(!card) return null;
    const id = Number(card.dataset.id);
    return formPayload(id, card.dataset.specialCategory || '', Number(card.dataset.specialIndex || 0));
  }

  function formFromModal(){
    const modal = document.getElementById('modalContent');
    if(!modal) return null;
    const specialText = [...modal.querySelectorAll('.muted')].some(el => /Forma especial selecionada/i.test(el.textContent || ''));
    if(!specialText) return null;

    const id = Number(((modal.querySelector('.num')?.textContent || '').match(/#(\d+)/) || [])[1]);
    const title = (modal.querySelector('h2')?.textContent || '').trim();
    if(!id || !title) return null;

    for(const category of ['mega','gmax','transform']){
      const forms = specialFormsFor(id, category) || [];
      for(let index = 0; index < forms.length; index++){
        const form = forms[index];
        if(form && labelForForm(id, form).trim() === title) return formPayload(id, category, index);
      }
    }

    const types = [...modal.querySelectorAll('.detail-top .type')].map(el =>
      [...el.classList].find(c => c !== 'type') || ''
    ).filter(Boolean);
    return {
      category: 'transform',
      index: 0,
      formName: title.toLowerCase().replace(/\s+/g, '-'),
      label: title,
      art: modal.querySelector('#detailImg')?.src || '',
      shinyArt: '',
      types
    };
  }

  function preloadStoredForm(id, form){
    if(!form?.category) return;
    const key = `${form.category}:${id}:forms`;
    const forms = [...(specialArt.get(key) || [])];
    const index = Number.isFinite(Number(form.index)) ? Number(form.index) : 0;
    forms[index] = {
      formName: form.formName || '',
      label: form.label || '',
      art: form.art || '',
      shinyArt: form.shinyArt || '',
      types: Array.isArray(form.types) ? [...form.types] : []
    };
    specialArt.set(key, forms);
  }

  function patchFavoriteCards(){
    let changed = false;
    Object.keys(favForms).forEach(id => {
      if(!favs.has(Number(id))){ delete favForms[id]; changed = true; }
    });
    if(changed) persistFavForms();

    document.querySelectorAll('#favResults .poke-card[data-id]').forEach(card => {
      const id = Number(card.dataset.id);
      const form = favForms[id];
      if(!form) return;

      preloadStoredForm(id, form);
      const shiny = !!favShiny[id];
      const img = card.querySelector('img');
      const title = card.querySelector('h3');
      const types = card.querySelector('.types');
      const index = Number.isFinite(Number(form.index)) ? Number(form.index) : 0;

      card.dataset.specialCategory = form.category;
      card.dataset.specialIndex = String(index);
      if(img) img.src = shiny && form.shinyArt ? form.shinyArt : (form.art || sprite(id, shiny));
      if(title) title.textContent = `${form.label || cap(state.list[id - 1]?.name || `#${id}`)}${shiny ? ' ✨' : ''}`;
      if(types && Array.isArray(form.types) && form.types.length){
        types.innerHTML = form.types.map(type => `<span class="type ${type}">${TYPE_PT[type] || cap(type)}</span>`).join('');
      }
    });
  }

  document.addEventListener('click', event => {
    const fav = event.target.closest?.('#dexResults [data-fav]');
    if(fav){
      pendingFavForm = formFromCard(fav.closest('.poke-card'));
      return;
    }
    if(event.target.closest?.('#modalFav')){
      pendingFavForm = formFromModal();
      return;
    }
  }, true);

  if(typeof toggleFav === 'function'){
    const originalToggleFav = toggleFav;
    toggleFav = function(id, shiny = false){
      const wasFavorite = favs.has(id);
      const selectedForm = pendingFavForm ? {...pendingFavForm, types:[...(pendingFavForm.types || [])]} : null;
      const result = originalToggleFav.call(this, id, shiny);

      if(!wasFavorite && favs.has(id)){
        if(selectedForm) favForms[id] = selectedForm;
        else delete favForms[id];
      }else if(wasFavorite && !favs.has(id)){
        delete favForms[id];
      }
      pendingFavForm = null;
      persistFavForms();
      requestAnimationFrame(patchFavoriteCards);
      return result;
    };
  }

  if(typeof renderFavs === 'function'){
    const originalRenderFavs = renderFavs;
    renderFavs = function(){
      const result = originalRenderFavs.apply(this, arguments);
      requestAnimationFrame(patchFavoriteCards);
      return result;
    };
  }

  Object.entries(favForms).forEach(([id, form]) => preloadStoredForm(Number(id), form));
  requestAnimationFrame(patchFavoriteCards);
})();
