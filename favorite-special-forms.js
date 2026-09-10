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
    entries.forEach(e=>{
      favs.add(e.id);
      if(!byId.has(e.id))byId.set(e.id,e);
    });
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

  function hasVariant(entry){
    const key=variantKey(entry);
    return entries.some(e=>variantKey(e)===key);
  }

  function exactContext(id,shiny){
    if(pendingFav&&pendingFav.id===id)return {id,shiny:pendingFav.shiny,form:cloneForm(pendingFav.form)};
    if(modalFavContext&&modalFavContext.id===id)return {id,shiny:modalFavContext.shiny,form:cloneForm(modalFavContext.form)};
    return {id,shiny:!!shiny,form:null};
  }

  function refreshHomeCount(){
    const el=document.getElementById('homeFavs');
    if(el)el.textContent=entries.length;
  }

  function patchDexStars(root=document){
    root.querySelectorAll?.('#dexResults .poke-card[data-id],#favResults .poke-card[data-id]').forEach(card=>{
      const ctx=fromCard(card);
      const btn=card.querySelector('[data-fav]');
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

  syncLegacy();
  persistEntries();
  entries.forEach(preloadForm);

  toggleFav=function(id,shiny=false){
    const ctx=exactContext(Number(id),shiny);
    const key=variantKey(ctx);
    const index=entries.findIndex(e=>variantKey(e)===key);
    let added=false;
    if(index>=0){
      entries.splice(index,1);
    }else{
      entries.push({id:ctx.id,shiny:!!ctx.shiny,form:cloneForm(ctx.form)});
      added=true;
    }
    pendingFav=null;
    syncLegacy();
    persistEntries();
    store.set('favs',[...favs]);
    store.set('favShiny',favShiny);
    refreshHomeCount();
    requestAnimationFrame(()=>{patchDexStars();patchModalFavButton()});
    toast(added?'Adicionado aos desejos ⭐':'Removido dos desejos');
    return added;
  };

  renderFavs=function(){
    return preserveViewportDuring(()=>{
      const q=(document.getElementById('favSearch')?.value||'').trim().toLowerCase();
      const filtered=entries.filter(entry=>{
        const p=state.list[entry.id-1]||{id:entry.id,name:`pokemon-${entry.id}`};
        const display=entry.form?.label||cap(p.name);
        const n=parseInt(q,10);
        return !q||display.toLowerCase().includes(q)||p.name.toLowerCase().includes(q)||(!Number.isNaN(n)&&entry.id===n);
      });
      const root=document.getElementById('favResults');
      if(!root)return;
      root.innerHTML=filtered.length?filtered.map(entry=>{
        const p=state.list[entry.id-1]||{id:entry.id,name:`pokemon-${entry.id}`};
        if(entry.form){
          preloadForm(entry);
          return cardHTML(p,entry.shiny,{category:entry.form.category,formIndex:entry.form.index||0,form:entry.form});
        }
        return cardHTML(p,entry.shiny);
      }).join(''):'<div class="empty-state">Sua lista de desejos está vazia.</div>';
      bindCards(root);
      patchDexStars(root);
    });
  };

  const originalUpdateHome=updateHome;
  updateHome=function(){
    const result=originalUpdateHome.apply(this,arguments);
    refreshHomeCount();
    return result;
  };

  const originalRenderDex=renderDex;
  renderDex=async function(){
    const result=await originalRenderDex.apply(this,arguments);
    patchDexStars();
    return result;
  };

  const originalOpenPokemon=openPokemon;
  openPokemon=async function(id,initialShiny=false,specialCategory=null,specialIndex=0){
    const form=specialCategory?formPayload(Number(id),specialCategory,Number(specialIndex||0)):null;
    modalFavContext={id:Number(id),shiny:!!initialShiny,form};
    const result=await originalOpenPokemon.apply(this,arguments);
    patchModalFavButton();
    return result;
  };

  document.addEventListener('click',event=>{
    const favBtn=event.target.closest?.('.poke-card [data-fav]');
    if(favBtn){pendingFav=fromCard(favBtn.closest('.poke-card'));return}
    if(event.target.closest?.('#modalFav')){pendingFav=fromModal();requestAnimationFrame(patchModalFavButton);return}
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

  const search=document.getElementById('favSearch');
  if(search)search.oninput=renderFavs;

  refreshHomeCount();
  requestAnimationFrame(()=>{patchDexStars();if(document.getElementById('wishes')?.classList.contains('active'))renderFavs()});
})();
