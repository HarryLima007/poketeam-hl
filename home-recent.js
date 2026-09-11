(() => {
  'use strict';

  const typeNames = typeof TYPE_PT !== 'undefined' ? TYPE_PT : {};
  const RECENT_VARIANTS_KEY='pt_recentVariantsV2';
  const originalUpdateHome = typeof updateHome === 'function' ? updateHome : null;

  function cloneForm(form){
    if(!form)return null;
    return {category:form.category||'',index:Number(form.index||0),formName:form.formName||'',label:form.label||'',art:form.art||'',shinyArt:form.shinyArt||'',types:Array.isArray(form.types)?[...form.types]:[]};
  }
  function formPayload(id,category,index){
    if(!category||!['mega','gmax','transform'].includes(category))return null;
    const form=specialFormsFor(id,category)?.[Number(index||0)];
    if(!form)return null;
    const base=state.list[id-1]?.name||`pokemon-${id}`;
    return {category,index:Number(index||0),formName:form.formName||'',label:form.label||specialFormLabel(form.formName||'',base),art:form.art||'',shinyArt:form.shinyArt||'',types:Array.isArray(form.types)?[...form.types]:[]};
  }
  function normalizeEntry(raw){
    const id=Number(typeof raw==='number'?raw:raw?.id);
    if(!id)return null;
    return {id,shiny:!!raw?.shiny,form:cloneForm(raw?.form)};
  }
  function entryKey(entry){
    const f=entry.form;
    return `${entry.id}|${entry.shiny?'s':'n'}|${f?`${f.category}:${f.formName||f.label||f.index}`:'base'}`;
  }
  function readVariantHistory(){
    try{
      const raw=JSON.parse(localStorage.getItem(RECENT_VARIANTS_KEY)||'null');
      if(Array.isArray(raw))return raw.map(normalizeEntry).filter(Boolean);
    }catch{}
    return (Array.isArray(recent)?recent:[]).map(id=>({id:Number(id),shiny:false,form:null})).filter(e=>e.id);
  }
  let recentVariants=readVariantHistory();
  function persistVariantHistory(){try{localStorage.setItem(RECENT_VARIANTS_KEY,JSON.stringify(recentVariants.slice(0,8)))}catch(err){console.warn('Falha ao salvar variantes recentes',err)}}
  function rememberVariant(entry){
    const normalized=normalizeEntry(entry);if(!normalized)return;
    const key=entryKey(normalized);
    recentVariants=[normalized,...recentVariants.filter(e=>entryKey(e)!==key)].slice(0,8);
    persistVariantHistory();
    requestAnimationFrame(renderRecentV2);
  }

  function recentEmptyHTML(){
    return `<div class="recent-empty-v2" aria-live="polite"><span class="recent-empty-mark" aria-hidden="true"><i></i></span><div><strong>Sua jornada começa com uma busca.</strong><small>Os últimos Pokémon pesquisados aparecerão aqui.</small></div></div>`;
  }
  function displayName(entry){
    const base=state.list[entry.id-1]?.name||`#${entry.id}`;
    const name=entry.form?.label||cap(base);
    return `${name}${entry.shiny?' Shiny':''}`;
  }
  function displayImage(entry){
    if(entry.form){if(entry.shiny&&entry.form.shinyArt)return entry.form.shinyArt;if(entry.form.art)return entry.form.art}
    return sprite(entry.id,entry.shiny);
  }
  function displayTypes(entry){
    if(entry.form?.types?.length)return entry.form.types;
    return state.details.get(entry.id)?.types||[];
  }
  function recentCardHTML(entry,index){
    const types=displayTypes(entry),name=displayName(entry),image=displayImage(entry);
    const badges=[];
    if(entry.form?.category==='mega')badges.push('<i class="recent-variant mega">MEGA</i>');
    else if(entry.form?.category==='gmax')badges.push('<i class="recent-variant gmax">GMAX</i>');
    else if(entry.form)badges.push('<i class="recent-variant form">FORMA</i>');
    if(entry.shiny)badges.push('<i class="recent-variant shiny">SHINY</i>');
    return `<button class="recent-poke-v2" data-recent-index="${index}" aria-label="Abrir ${name} na Pokédex"><span class="recent-art"><img loading="lazy" src="${image}" alt=""></span><span class="recent-copy"><small class="recent-number">#${pad(entry.id)}</small><strong>${name}</strong><span class="recent-types">${types.length?types.map(t=>`<i class="type ${t}">${typeNames[t]||cap(t)}</i>`).join(''):'<i class="recent-loading">carregando tipos…</i>'}${badges.join('')}</span></span><span class="recent-arrow" aria-hidden="true">→</span></button>`;
  }
  function openRecentEntry(entry){
    if(!entry)return;
    const f=entry.form;
    openPokemon(entry.id,entry.shiny,f?.category||null,Number(f?.index||0));
  }
  function bindRecent(box){box.querySelectorAll('[data-recent-index]').forEach(b=>b.onclick=()=>openRecentEntry(recentVariants[Number(b.dataset.recentIndex)]))}

  function ensureClearButton(){
    const panel=document.querySelector('#home .panel:has(#recentList)'),title=panel?.querySelector('.section-title');if(!title)return null;
    let button=title.querySelector('#clearRecentHistory');
    if(!button){
      button=document.createElement('button');button.id='clearRecentHistory';button.type='button';button.className='clear-recent-history';button.textContent='Limpar Histórico';button.setAttribute('aria-label','Limpar histórico de Pokémon pesquisados');title.appendChild(button);
      button.onclick=async()=>{
        if(!recentVariants.length&&!recent.length)return;
        const ok=typeof siteConfirm==='function'?await siteConfirm('Limpar todos os Pokémon pesquisados recentemente?',{title:'Limpar Histórico',confirmText:'Limpar',icon:'⌛',danger:true}):window.confirm('Limpar todos os Pokémon pesquisados recentemente?');
        if(!ok)return;
        recentVariants=[];recent=[];persistVariantHistory();store.set('recent',recent);renderRecentV2();if(typeof toast==='function')toast('Histórico limpo.');
      };
    }
    button.hidden=!recentVariants.length;return button;
  }

  function renderRecentV2(){
    const box=document.querySelector('#recentList');if(!box)return;ensureClearButton();
    if(!recentVariants.length){box.className='mini-list recent-list-v2 empty-state';box.innerHTML=recentEmptyHTML();return}
    const entries=recentVariants.slice(0,5);box.className='mini-list recent-list-v2';box.innerHTML=entries.map(recentCardHTML).join('');bindRecent(box);
    const missing=[...new Set(entries.filter(e=>!e.form&&!state.details.get(e.id)?.types?.length).map(e=>e.id))];
    if(missing.length)Promise.allSettled(missing.map(getDetail)).then(()=>{box.innerHTML=recentVariants.slice(0,5).map(recentCardHTML).join('');bindRecent(box)});
  }

  if(originalUpdateHome){updateHome=function(){const result=originalUpdateHome.apply(this,arguments);renderRecentV2();return result}}

  if(typeof openPokemon==='function'){
    const originalOpenPokemon=openPokemon;
    openPokemon=async function(id,initialShiny=false,specialCategory=null,specialIndex=0){
      const numericId=Number(id),form=specialCategory?formPayload(numericId,specialCategory,Number(specialIndex||0)):null;
      const result=await originalOpenPokemon.apply(this,arguments);
      rememberVariant({id:numericId,shiny:!!initialShiny,form});
      return result;
    };
  }

  document.addEventListener('click',e=>{
    if(e.target.closest?.('#shinyBtn')){
      requestAnimationFrame(()=>{
        const modal=document.getElementById('modalContent');
        const id=Number(((modal?.querySelector('.num')?.textContent||'').match(/#(\d+)/)||[])[1]);if(!id)return;
        const shiny=/Shiny:\s*ON/i.test(document.getElementById('shinyBtn')?.textContent||'');
        const title=(modal?.querySelector('h2')?.textContent||'').trim();
        let form=null;
        for(const category of ['mega','gmax','transform']){
          const forms=specialFormsFor(id,category)||[];
          const index=forms.findIndex(f=>(f.label||specialFormLabel(f.formName||'',state.list[id-1]?.name||'')).trim()===title);
          if(index>=0){form=formPayload(id,category,index);break}
        }
        rememberVariant({id,shiny,form});
      });
    }
  },true);

  persistVariantHistory();requestAnimationFrame(renderRecentV2);
})();
