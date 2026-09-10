(() => {
  'use strict';

  const STORAGE_KEY='pt_favVariantsV2';
  let pendingFav=null;
  let modalFavContext=null;

  function cloneForm(form){
    if(!form)return null;
    return {
      category:form.category||'',
      index:Number.isFinite(Number(form.index))?Number(form.index):0,
      formName:form.formName||'',
      label:form.label||'',
      art:form.art||'',
      shinyArt:form.shinyArt||'',
      types:Array.isArray(form.types)?[...form.types]:[]
    };
  }

  function formLabel(id,form){
    const base=state.list[id-1]?.name||`pokemon-${id}`;
    return form?.label||specialFormLabel(form?.formName||'',base);
  }

  function displayName(entry){
    const base=state.list[entry.id-1]?.name||`pokemon-${entry.id}`;
    const name=entry.form?.label||cap(base);
    return `${name}${entry.shiny?' Shiny':''}`;
  }

  function displayImage(entry){
    if(entry.form){
      if(entry.shiny&&entry.form.shinyArt)return entry.form.shinyArt;
      if(entry.form.art)return entry.form.art;
    }
    return sprite(entry.id,entry.shiny);
  }

  function formPayload(id,category,index){
    if(!category||!['mega','gmax','transform'].includes(category))return null;
    const form=specialFormsFor(id,category)?.[index];
    if(!form)return null;
    return {
      category,
      index,
      formName:form.formName||'',
      label:formLabel(id,form),
      art:form.art||'',
      shinyArt:form.shinyArt||'',
      types:Array.isArray(form.types)?[...form.types]:[]
    };
  }

  function fromCard(card){
    if(!card)return null;
    const id=Number(card.dataset.id);
    const category=card.dataset.specialCategory||'';
    const index=Number(card.dataset.specialIndex||0);
    return {id,shiny:card.dataset.shiny==='1',form:formPayload(id,category,index)};
  }

  function fromModal(){
    if(modalFavContext)return {id:modalFavContext.id,shiny:modalFavContext.shiny,form:cloneForm(modalFavContext.form)};
    const modal=document.getElementById('modalContent');
    if(!modal)return null;
    const id=Number(((modal.querySelector('.num')?.textContent||'').match(/#(\d+)/)||[])[1]);
    if(!id)return null;
    const shiny=/Shiny:\s*ON/i.test(document.getElementById('shinyBtn')?.textContent||'');
    return {id,shiny,form:null};
  }

  function variantKey(entry){
    const form=entry.form;
    const formKey=form?`${form.category}:${form.formName||form.label||form.index}`:'base';
    return `${entry.id}|${entry.shiny?'s':'n'}|${formKey}`;
  }

  function normalizeEntry(raw){
    const id=Number(raw?.id);
    if(!id)return null;
    return {id,shiny:!!raw.shiny,form:cloneForm(raw.form)};
  }

  function readEntries(){
    try{
      const raw=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
      if(Array.isArray(raw))return raw.map(normalizeEntry).filter(Boolean);
    }catch{}
    return null;
  }

  function migrateLegacy(){
    let oldForms={};
    try{oldForms=JSON.parse(localStorage.getItem('pt_favForms')||'{}')||{}}catch{}
    return [...favs].map(id=>({id,shiny:!!favShiny[id],form:cloneForm(oldForms[id]||null)}));
  }

  let entries=readEntries();
  if(!entries){entries=migrateLegacy();persistEntries()}
  entries=[...new Map(entries.map(e=>[variantKey(e),e])).values()];

  function persistEntries(){
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(entries))}catch(err){console.warn('Falha ao salvar variantes dos Desejos',err)}
  }

  function syncLegacy(){
    favs.clear();
    Object.keys(favShiny).forEach(k=>delete favShiny[k]);
    const byId=new Map();
    entries.forEach(e=>{favs.add(e.id);if(!byId.has(e.id))byId.set(e.id,e)});
    byId.forEach((e,id)=>{favShiny[id]=!!e.shiny});
  }

  function preloadForm(entry){
    const form=entry?.form;
    if(!form?.category)return;
    const key=`${form.category}:${entry.id}:forms`;
    const forms=[...(specialArt.get(key)||[])];
    const index=Number.isFinite(Number(form.index))?Number(form.index):0;
    forms[index]={formName:form.formName||'',label:form.label||'',art:form.art||'',shinyArt:form.shinyArt||'',types:[...(form.types||[])]};
    specialArt.set(key,forms);
  }

  function hasVariant(entry){const key=variantKey(entry);return entries.some(e=>variantKey(e)===key)}

  function exactContext(id,shiny){
    if(pendingFav&&pendingFav.id===id)return {id,shiny:pendingFav.shiny,form:cloneForm(pendingFav.form)};
    if(modalFavContext&&modalFavContext.id===id)return {id,shiny:modalFavContext.shiny,form:cloneForm(modalFavContext.form)};
    return {id,shiny:!!shiny,form:null};
  }

  function refreshHomeCount(){const el=document.getElementById('homeFavs');if(el)el.textContent=entries.length}

  function patchDexStars(root=document){
    root.querySelectorAll?.('#dexResults .poke-card[data-id],#favResults .poke-card[data-id]').forEach(card=>{
      const ctx=fromCard(card),btn=card.querySelector('[data-fav]');
      if(btn&&ctx)btn.classList.toggle('on',hasVariant(ctx));
    });
  }

  function patchModalFavButton(){
    const btn=document.getElementById('modalFav');
    if(!btn||!modalFavContext)return;
    const on=hasVariant(modalFavContext);
    btn.classList.toggle('on',on);
    btn.textContent=on?'★ Favoritado':'★ Favoritar';
  }

  function patchRemoveDialog(entry){
    const name=displayName(entry);
    const image=displayImage(entry);
    const card=document.querySelector('#siteDialog .site-dialog-card');
    const icon=document.getElementById('siteDialogIcon');
    const title=document.getElementById('siteDialogTitle');
    const message=document.getElementById('siteDialogMessage');

    if(card)card.style.gridTemplateColumns='92px 1fr';
    if(icon){
      icon.style.width='92px';
      icon.style.height='92px';
      icon.style.padding='6px';
      icon.style.background='linear-gradient(160deg,#15223a,#0d1627)';
      icon.style.border='1px solid #345070';
      icon.innerHTML=`<img src="${image}" alt="${name}" style="width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 8px 10px rgba(0,0,0,.35))">`;
    }
    if(title){
      title.style.color='#f5f7fb';
      title.textContent='Remover dos Favoritos';
    }
    if(message){
      message.innerHTML=`<strong style="display:block;color:#fff;font-size:18px;margin-bottom:4px">${name}</strong><span>Deseja mesmo remover este Pokémon dos favoritos?</span>`;
    }
  }

  function ensureFavoriteRemoveStyle(){
    if(document.getElementById('favorite-card-remove-style'))return;
    const style=document.createElement('style');
    style.id='favorite-card-remove-style';
    style.textContent=`
      #wishes #favResults .poke-card{padding-bottom:58px}
      #wishes #favResults .fav-card-remove{position:absolute;left:12px;right:12px;bottom:12px;width:calc(100% - 24px);min-height:34px;padding:7px 10px;border-radius:10px;border:1px solid rgba(255,91,108,.45);background:rgba(104,28,39,.42);color:#ffb0b8;font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center;gap:6px;z-index:2}
      #wishes #favResults .fav-card-remove:hover{background:rgba(136,34,48,.72);border-color:rgba(255,116,130,.75);color:#fff;transform:translateY(-1px)}
    `;
    document.head.appendChild(style);
  }

  function favoriteCardHTML(entry){
    const p=state.list[entry.id-1]||{id:entry.id,name:`pokemon-${entry.id}`};
    let html;
    if(entry.form){
      preloadForm(entry);
      html=cardHTML(p,entry.shiny,{category:entry.form.category,formIndex:entry.form.index||0,form:entry.form});
    }else{
      html=cardHTML(p,entry.shiny);
    }
    const key=encodeURIComponent(variantKey(entry));
    const label=displayName(entry).replace(/"/g,'&quot;');
    return html.replace('</article>',`<button class="fav-card-remove" type="button" data-remove-favorite="${key}" aria-label="Remover ${label} dos favoritos">🗑 Remover</button></article>`);
  }

  syncLegacy();persistEntries();entries.forEach(preloadForm);ensureFavoriteRemoveStyle();

  toggleFav=async function(id,shiny=false){
    const ctx=exactContext(Number(id),shiny),key=variantKey(ctx);
    const index=entries.findIndex(e=>variantKey(e)===key);
    let added=false;
    if(index>=0){
      const current=entries[index];
      const confirmPromise=siteConfirm('Deseja mesmo remover este Pokémon dos favoritos?',{
        title:'Remover dos Favoritos',confirmText:'Remover',icon:'⭐',danger:true
      });
      patchRemoveDialog(current);
      const ok=await confirmPromise;
      if(!ok){
        pendingFav=null;
        requestAnimationFrame(()=>{patchDexStars();patchModalFavButton()});
        return false;
      }
      entries.splice(index,1);
    }else{
      entries.push({id:ctx.id,shiny:!!ctx.shiny,form:cloneForm(ctx.form)});
      added=true;
    }
    pendingFav=null;
    syncLegacy();persistEntries();
    store.set('favs',[...favs]);store.set('favShiny',favShiny);
    refreshHomeCount();
    if(document.getElementById('wishes')?.classList.contains('active'))renderFavs();
    requestAnimationFrame(()=>{patchDexStars();patchModalFavButton()});
    toast(added?'Adicionado aos desejos ⭐':'Removido dos desejos');
    return added;
  };

  renderFavs=function(){
    return preserveViewportDuring(()=>{
      const q=(document.getElementById('favSearch')?.value||'').trim().toLowerCase();
      const filtered=entries.filter(entry=>{
        const p=state.list[entry.id-1]||{id:entry.id,name:`pokemon-${entry.id}`};
        const display=entry.form?.label||cap(p.name),n=parseInt(q,10);
        return !q||display.toLowerCase().includes(q)||p.name.toLowerCase().includes(q)||(!Number.isNaN(n)&&entry.id===n);
      });
      const root=document.getElementById('favResults');if(!root)return;
      ensureFavoriteRemoveStyle();
      root.innerHTML=filtered.length?filtered.map(favoriteCardHTML).join(''):'<div class="empty-state">Sua lista de desejos está vazia.</div>';
      bindCards(root);patchDexStars(root);
    });
  };

  const originalUpdateHome=updateHome;
  updateHome=function(){const result=originalUpdateHome.apply(this,arguments);refreshHomeCount();return result};
  const originalRenderDex=renderDex;
  renderDex=async function(){const result=await originalRenderDex.apply(this,arguments);patchDexStars();return result};
  const originalOpenPokemon=openPokemon;
  openPokemon=async function(id,initialShiny=false,specialCategory=null,specialIndex=0){
    const form=specialCategory?formPayload(Number(id),specialCategory,Number(specialIndex||0)):null;
    modalFavContext={id:Number(id),shiny:!!initialShiny,form};
    const result=await originalOpenPokemon.apply(this,arguments);patchModalFavButton();return result;
  };

  document.addEventListener('click',async event=>{
    const removeBtn=event.target.closest?.('#favResults [data-remove-favorite]');
    if(removeBtn){
      event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
      let key='';
      try{key=decodeURIComponent(removeBtn.dataset.removeFavorite||'')}catch{key=removeBtn.dataset.removeFavorite||''}
      const entry=entries.find(e=>variantKey(e)===key);
      if(entry){
        pendingFav={id:entry.id,shiny:entry.shiny,form:cloneForm(entry.form)};
        await toggleFav(entry.id,entry.shiny);
      }
      return;
    }
    const cardFav=event.target.closest?.('.poke-card [data-fav]');
    if(cardFav){
      event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
      const card=cardFav.closest('.poke-card');
      pendingFav=fromCard(card);
      if(pendingFav)await toggleFav(pendingFav.id,pendingFav.shiny);
      return;
    }
    const modalFav=event.target.closest?.('#modalFav');
    if(modalFav){
      event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
      pendingFav=fromModal();
      if(pendingFav)await toggleFav(pendingFav.id,pendingFav.shiny);
      return;
    }
    if(event.target.closest?.('#shinyBtn')){
      requestAnimationFrame(()=>{
        if(modalFavContext){modalFavContext.shiny=/Shiny:\s*ON/i.test(document.getElementById('shinyBtn')?.textContent||'');patchModalFavButton()}
      });
    }
  },true);

  const clear=document.getElementById('clearFavs');
  if(clear)clear.onclick=async()=>{
    if(!entries.length)return;
    const ok=await siteConfirm('Remover todos os favoritos?',{title:'Limpar Desejos',confirmText:'Remover todos',icon:'⭐',danger:true});
    if(ok){entries=[];syncLegacy();persistEntries();store.set('favs',[]);store.set('favShiny',{});renderFavs();refreshHomeCount()}
  };
  const search=document.getElementById('favSearch');if(search)search.oninput=renderFavs;
  refreshHomeCount();
  requestAnimationFrame(()=>{patchDexStars();if(document.getElementById('wishes')?.classList.contains('active'))renderFavs()});
})();
