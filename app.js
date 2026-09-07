'use strict';
const API='https://pokeapi.co/api/v2'; const MAX=1025;
const REGIONS=[['Kanto',1,151],['Johto',152,251],['Hoenn',252,386],['Sinnoh',387,493],['Unova',494,649],['Kalos',650,721],['Alola',722,809],['Galar',810,898],['Hisui',899,905],['Paldea',906,1025]];
const UB=new Set([793,794,795,796,797,798,799,803,804,805,806]);
const STARTERS=new Set([1,2,3,4,5,6,7,8,9,152,153,154,155,156,157,158,159,160,252,253,254,255,256,257,258,259,260,387,388,389,390,391,392,393,394,395,495,496,497,498,499,500,501,502,503,650,651,652,653,654,655,656,657,658,722,723,724,725,726,727,728,729,730,810,811,812,813,814,815,816,817,818,906,907,908,909,910,911,912,913,914]);
// Species with a known Mega Evolution as of Sep 2026, including Legends: Z-A + Mega Dimension.
const MEGA=new Set([3,6,9,15,18,26,36,65,71,80,94,115,121,127,130,142,150,154,160,181,208,212,214,229,248,254,257,260,282,302,303,306,308,310,319,323,334,354,359,362,373,376,380,381,384,428,445,448,460,475,531,719,9,18,26,36,71,121,149,154,160,227,358,359,398,445,448,478,485,491,500,530,545,560,604,609,623,652,655,658,668,670,678,687,689,691,701,718,740,768,780,801,807,870,952,970,978,998]);
const GMAX=new Set([3,6,9,12,25,52,68,94,99,131,133,143,569,809,812,815,818,823,826,834,839,841,842,844,849,851,858,861,869,879,884,892]);
const LEGENDARY=new Set([144,145,146,150,243,244,245,249,250,377,378,379,380,381,382,383,384,480,481,482,483,484,485,486,487,488,638,639,640,641,642,643,644,645,646,716,717,718,772,773,785,786,787,788,789,790,791,792,800,888,889,890,891,892,894,895,896,897,898,905,1001,1002,1003,1004,1007,1008,1024]);
const MYTHICAL=new Set([151,251,385,386,489,490,491,492,493,494,647,648,649,719,720,721,801,802,807,808,809,893,1025]);
const TYPES=['normal','fire','water','electric','grass','ice','fighting','poison','ground','flying','psychic','bug','rock','ghost','dragon','dark','steel','fairy'];
const TYPE_PT={normal:'Normal',fire:'Fogo',water:'Água',electric:'Elétrico',grass:'Planta',ice:'Gelo',fighting:'Lutador',poison:'Veneno',ground:'Terra',flying:'Voador',psychic:'Psíquico',bug:'Inseto',rock:'Pedra',ghost:'Fantasma',dragon:'Dragão',dark:'Sombrio',steel:'Aço',fairy:'Fada'};
const TYPE_CHART={
 normal:{rock:.5,ghost:0,steel:.5},
 fire:{fire:.5,water:.5,grass:2,ice:2,bug:2,rock:.5,dragon:.5,steel:2},
 water:{fire:2,water:.5,grass:.5,ground:2,rock:2,dragon:.5},
 electric:{water:2,electric:.5,grass:.5,ground:0,flying:2,dragon:.5},
 grass:{fire:.5,water:2,grass:.5,poison:.5,ground:2,flying:.5,bug:.5,rock:2,dragon:.5,steel:.5},
 ice:{fire:.5,water:.5,grass:2,ice:.5,ground:2,flying:2,dragon:2,steel:.5},
 fighting:{normal:2,ice:2,poison:.5,flying:.5,psychic:.5,bug:.5,rock:2,ghost:0,dark:2,steel:2,fairy:.5},
 poison:{grass:2,poison:.5,ground:.5,rock:.5,ghost:.5,steel:0,fairy:2},
 ground:{fire:2,electric:2,grass:.5,poison:2,flying:0,bug:.5,rock:2,steel:2},
 flying:{electric:.5,grass:2,fighting:2,bug:2,rock:.5,steel:.5},
 psychic:{fighting:2,poison:2,psychic:.5,dark:0,steel:.5},
 bug:{fire:.5,grass:2,fighting:.5,poison:.5,flying:.5,psychic:2,ghost:.5,dark:2,steel:.5,fairy:.5},
 rock:{fire:2,ice:2,fighting:.5,ground:.5,flying:2,bug:2,steel:.5},
 ghost:{normal:0,psychic:2,ghost:2,dark:.5},
 dragon:{dragon:2,steel:.5,fairy:0},
 dark:{fighting:.5,psychic:2,ghost:2,dark:.5,fairy:.5},
 steel:{fire:.5,water:.5,electric:.5,ice:2,rock:2,steel:.5,fairy:2},
 fairy:{fire:.5,fighting:2,poison:.5,dragon:2,dark:2,steel:.5}
};
const state={list:[],details:new Map(),species:new Map(),activeCategory:'all',activeRegion:'all',activeTeam:null,rouletteVisible:[],dexShiny:false};
const specialArt=new Map();
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
// Dados do usuário ficam no localStorage; cache da PokéAPI fica apenas na sessão.
try{for(let i=localStorage.length-1;i>=0;i--){const k=localStorage.key(i);if(k?.startsWith('pt_cache_'))localStorage.removeItem(k)}}catch(e){console.warn('Falha ao limpar cache antigo',e)}
const store={
  get(k,d){try{return JSON.parse(localStorage.getItem('pt_'+k))??d}catch(e){console.warn('Falha ao ler '+k,e);return d}},
  set(k,v){try{localStorage.setItem('pt_'+k,JSON.stringify(v));return true}catch(e){console.error('Falha ao salvar '+k,e);return false}}
};
const cache={
  get(k,d){try{return JSON.parse(sessionStorage.getItem('pt_cache_'+k))??d}catch{return d}},
  set(k,v){try{sessionStorage.setItem('pt_cache_'+k,JSON.stringify(v))}catch{}}
};
let favs=new Set(store.get('favs',[])),
    favShiny=store.get('favShiny',{}),
    teams=store.get('teams',[]),
    rouletteRaw=store.get('roulette',[]),
    recent=store.get('recent',[]);
const roulette=new Set((Array.isArray(rouletteRaw)?rouletteRaw:[]).map(v=>{
  if(typeof v==='number')return `${v}:n`;
  const s=String(v);
  if(/^\d+:(?:n|s|n100|s100)$/.test(s))return s;
  if(/^\d+$/.test(s))return `${s}:n`;
  return null;
}).filter(Boolean));
teams=teams.map(t=>{
  const members=Array.isArray(t.members)?t.members:[];
  const memberShiny=Array.isArray(t.memberShiny)?t.memberShiny.slice(0,members.length):[];
  const memberIV100=Array.isArray(t.memberIV100)?t.memberIV100.slice(0,members.length):[];
  while(memberShiny.length<members.length)memberShiny.push(false);
  while(memberIV100.length<members.length)memberIV100.push(false);
  return {...t,members,memberShiny,memberIV100};
});
const cap=s=>s? s.replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase()):''; const pad=n=>String(n).padStart(4,'0');
function regionOf(id){return REGIONS.find(r=>id>=r[1]&&id<=r[2])?.[0]||'—'}
function sprite(id,shiny=false){return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${shiny?'shiny/':''}${id}.png`}
function specialFormCandidates(name,category){
  if(category==='mega'){
    if(name==='charizard')return ['charizard-mega-x','charizard-mega-y'];
    if(name==='mewtwo')return ['mewtwo-mega-x','mewtwo-mega-y'];
    if(name==='raichu')return ['raichu-mega-x','raichu-mega-y'];
    if(name==='garchomp')return ['garchomp-mega','garchomp-mega-z'];
    if(name==='absol')return ['absol-mega','absol-mega-z'];
    if(name==='lucario')return ['lucario-mega','lucario-mega-z'];
    if(name==='tatsugiri')return ['tatsugiri-curly-mega','tatsugiri-droopy-mega','tatsugiri-stretchy-mega','tatsugiri-mega-curly','tatsugiri-mega-droopy','tatsugiri-mega-stretchy'];
    if(name==='magearna')return ['magearna-mega','magearna-original-mega','magearna-mega-original'];
    return [`${name}-mega`];
  }
  if(category==='gmax'){
    if(name.startsWith('urshifu'))return ['urshifu-single-strike-gmax','urshifu-rapid-strike-gmax'];
    return [`${name}-gmax`];
  }
  return [];
}
async function getSpecialForms(id,category){
  const key=`${category}:${id}:forms`;
  if(specialArt.has(key))return specialArt.get(key);
  const d=state.details.get(id)||await getDetail(id);
  const name=d?.name||state.list[id-1]?.name||'';
  const forms=[];
  for(const formName of specialFormCandidates(name,category)){
    try{
      const p=await fetchJSON(`${API}/pokemon/${formName}`,`special_form_v2_${formName}`);
      const art=p?.sprites?.other?.['official-artwork']?.front_default
        ||p?.sprites?.other?.home?.front_default
        ||p?.sprites?.front_default||'';
      const shinyArt=p?.sprites?.other?.['official-artwork']?.front_shiny
        ||p?.sprites?.other?.home?.front_shiny
        ||p?.sprites?.front_shiny||'';
      if(art&&!forms.some(f=>f.art===art))forms.push({formName,art,shinyArt,types:(p.types||[]).sort((a,b)=>a.slot-b.slot).map(x=>x.type.name)});
    }catch(e){console.warn('special form unavailable',formName)}
  }
  specialArt.set(key,forms);
  return forms;
}
async function ensureSpecialCategoryArt(list,category){
  if(!['mega','gmax'].includes(category)||!list.length)return;
  await Promise.allSettled(list.map(p=>getSpecialForms(p.id,category)));
}
function specialFormsFor(id,category=state.activeCategory){
  return specialArt.get(`${category}:${id}:forms`)||[];
}
function specialFormLabel(formName,baseName){
  const tail=formName.replace(baseName+'-','').split('-').map(cap).join(' ');
  return `${cap(baseName)} ${tail.replace('Gmax','Gigantamax').replace('Mega X','Mega X').replace('Mega Y','Mega Y')}`;
}
function dexCardSprite(id,shiny=false,formIndex=0){
  if(['mega','gmax'].includes(state.activeCategory)){
    const f=specialFormsFor(id)[formIndex];
    if(f)return shiny&&f.shinyArt?f.shinyArt:f.art;
  }
  return sprite(id,shiny);
}
function toast(t){const e=$('#toast');e.textContent=t;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),1800)}
function siteConfirm(message,{title='Confirmar ação',confirmText='Confirmar',cancelText='Cancelar',icon='⚠️',danger=false}={}){
  return new Promise(resolve=>{
    const modal=$('#siteDialog');
    $('#siteDialogTitle').textContent=title;
    $('#siteDialogMessage').textContent=message;
    $('#siteDialogIcon').textContent=icon;
    $('#siteDialogConfirm').textContent=confirmText;
    $('#siteDialogCancel').textContent=cancelText;
    $('#siteDialogConfirm').classList.toggle('danger',!!danger);
    $('#siteDialogConfirm').classList.toggle('primary',!danger);
    modal.classList.remove('hidden');
    const cleanup=result=>{
      modal.classList.add('hidden');
      $('#siteDialogConfirm').onclick=null;
      $('#siteDialogCancel').onclick=null;
      modal.onclick=null;
      document.removeEventListener('keydown',esc);
      resolve(result);
    };
    const esc=e=>{if(e.key==='Escape')cleanup(false)};
    $('#siteDialogConfirm').onclick=()=>cleanup(true);
    $('#siteDialogCancel').onclick=()=>cleanup(false);
    modal.onclick=e=>{if(e.target===modal)cleanup(false)};
    document.addEventListener('keydown',esc);
  });
}
function safe(fn){try{return fn()}catch(e){console.error(e);toast('Algo deu errado, mas o restante do site continua funcionando.')}}
function save(){const ok=[store.set('favs',[...favs]),store.set('favShiny',favShiny),store.set('teams',teams),store.set('roulette',[...roulette]),store.set('recent',recent)].every(Boolean);if(!ok)toast('Não foi possível salvar seus dados.');updateHome();return ok}
function go(page){document.body.dataset.page=page;$$('.page').forEach(x=>x.classList.toggle('active',x.id===page));$$('#nav button').forEach(x=>x.classList.toggle('active',x.dataset.page===page));window.scrollTo({top:0,behavior:'smooth'});if(page==='wishes')renderFavs();if(page==='teams')renderTeams();if(page==='roulette'){renderPicker();drawWheel()}if(page==='home')updateHome()}
$$('[data-page]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.page)));
function setupSelects(){
  const opts='<option value="all">Todas as regiões</option>'+REGIONS.map(r=>`<option value="${r[0]}">${r[0]} — #${r[1]}–#${r[2]}</option>`).join('');
  $('#regionFilter').innerHTML=opts;
  $('#rouletteRegion').innerHTML=opts;
  const cats=[['all','🔹 Todos'],['legendary','🟡 Lendários'],['mythical','🔵 Míticos'],['ub','🟣 Ultra Beasts'],['starter','🌱 Iniciais Regionais'],['mega','💥 Mega Evoluções'],['gmax','⚡ Gigantamax']];
  $('#categoryFilters').innerHTML=cats.map(([v,l])=>`<button data-cat="${v}" class="${v==='all'?'active':''}">${l}</button>`).join('');
  $$('[data-cat]').forEach(b=>b.onclick=()=>{state.activeCategory=b.dataset.cat;$$('[data-cat]').forEach(x=>x.classList.toggle('active',x===b));renderDex()});
  $('#rouletteCategories').innerHTML=cats.map(([v,l])=>`<button data-roulette-cat="${v}" class="${v==='all'?'active':''}">${l}</button>`).join('');
  $$('[data-roulette-cat]').forEach(b=>b.onclick=()=>{$$('[data-roulette-cat]').forEach(x=>x.classList.toggle('active',x===b));renderPicker()});
  $('#rouletteType').innerHTML='<option value="all">Todos os tipos</option>'+TYPES.map(t=>`<option value="${t}">${TYPE_PT[t]}</option>`).join('');
}
async function fetchJSON(url,key){const cached=cache.get(key,null);if(cached)return cached;const c=new AbortController(),timer=setTimeout(()=>c.abort(),12000);try{const r=await fetch(url,{signal:c.signal});if(!r.ok)throw new Error(r.status);const j=await r.json();cache.set(key,j);return j}finally{clearTimeout(timer)}}
async function initData(){
  const savedList=store.get('pokedexList',null);
  state.list=Array.isArray(savedList)&&savedList.length===MAX
    ? savedList
    : Array.from({length:MAX},(_,i)=>({id:i+1,name:`pokemon-${i+1}`}));
  $('#loadStatus').textContent=Array.isArray(savedList)&&savedList.length===MAX
    ? 'Pokédex carregada • atualizando dados…'
    : 'Pokédex disponível • carregando nomes…';
  renderDex();
  renderPicker();
  try{
    const data=await fetchJSON(`${API}/pokemon?limit=${MAX}&offset=0`,'list_v3');
    const fresh=data.results.slice(0,MAX).map((p,i)=>({id:i+1,name:p.name}));
    if(fresh.length===MAX){
      state.list=fresh;
      store.set('pokedexList',fresh);
      $('#loadStatus').textContent=`${state.list.length} espécies carregadas • detalhes progressivos`;
      renderDex();
      renderPicker();
    }
    progressiveDetails();
  }catch(e){
    console.error(e);
    $('#dexMessage').classList.remove('hidden');
    $('#dexMessage').textContent='A Pokédex está disponível com dados locais; a PokéAPI será tentada novamente ao recarregar.';
    $('#loadStatus').textContent='Pokédex local disponível';
  }
}
async function getDetail(id){if(state.details.has(id))return state.details.get(id);try{const p=await fetchJSON(`${API}/pokemon/${id}`,'pokemon_'+id);const d={id,name:p.name,types:p.types.sort((a,b)=>a.slot-b.slot).map(x=>x.type.name),forms:p.forms?.map(x=>x.name)||[]};state.details.set(id,d);return d}catch(e){console.warn('detail failed',id,e);return {id,name:state.list[id-1]?.name||`#${id}`,types:[],forms:[]}}}
async function getSpecies(id){if(state.species.has(id))return state.species.get(id);try{const s=await fetchJSON(`${API}/pokemon-species/${id}`,'species_'+id);state.species.set(id,s);return s}catch(e){console.warn('species failed',id,e);return null}}
async function progressiveDetails(){let next=1,workers=10;async function worker(){while(next<=MAX){const id=next++;await getDetail(id);if(id%25===0){if($('#pokedex').classList.contains('active'))renderDex();if($('#roulette').classList.contains('active')&&$('#rouletteType')?.value!=='all')renderPicker();}}}await Promise.allSettled(Array.from({length:workers},worker));$('#loadStatus').textContent='Pokédex pronta • dados em cache';renderDex();renderPicker()}
function matchesSearch(p,q){if(!q)return true;q=q.trim().toLowerCase();const n=parseInt(q,10);return p.name.toLowerCase().includes(q)||(!Number.isNaN(n)&&p.id===n)}
async function ensureCategoryFlags(ids){if(!['legendary','mythical'].includes(state.activeCategory))return;const missing=ids.filter(id=>!state.species.has(id));let i=0;async function w(){while(i<missing.length){await getSpecies(missing[i++])}}await Promise.allSettled(Array.from({length:8},w))}
function categoryMatch(p){if(state.activeCategory==='all')return true;if(state.activeCategory==='ub')return UB.has(p.id);if(state.activeCategory==='starter')return STARTERS.has(p.id);if(state.activeCategory==='mega')return MEGA.has(p.id);if(state.activeCategory==='gmax')return GMAX.has(p.id);if(state.activeCategory==='legendary')return LEGENDARY.has(p.id);if(state.activeCategory==='mythical')return MYTHICAL.has(p.id);return true}
let dexToken=0;async function renderDex(){const token=++dexToken,q=$('#dexSearch').value;const base=state.list.filter(p=>matchesSearch(p,q)&&(state.activeRegion==='all'||regionOf(p.id)===state.activeRegion));const list=base.filter(categoryMatch).sort((a,b)=>a.id-b.id);if(state.activeCategory!=='all'&&list.length){await Promise.allSettled(list.map(p=>getDetail(p.id)))}if(['mega','gmax'].includes(state.activeCategory)&&list.length){await ensureSpecialCategoryArt(list,state.activeCategory)}if(token!==dexToken)return;$('#dexResults').innerHTML=list.length?REGIONS.map(r=>{const arr=list.filter(p=>regionOf(p.id)===r[0]);if(!arr.length)return '';const cards=['mega','gmax'].includes(state.activeCategory)?arr.flatMap(p=>{const forms=specialFormsFor(p.id);return forms.length?forms.map((f,i)=>cardHTML(p,state.dexShiny,{category:state.activeCategory,formIndex:i,form:f})):[]}):arr.map(p=>cardHTML(p,state.dexShiny));return cards.length?`<section class="region-section"><div class="region-title"><h2>${r[0]}</h2><span>${cards.length} forma${cards.length===1?'':'s'}</span></div><div class="card-grid">${cards.join('')}</div></section>`:''}).join(''):'<div class="empty-state">Nenhum Pokémon encontrado.</div>';bindCards($('#dexResults'))}
function cardHTML(p,shiny=false,special=null){
  const d=state.details.get(p.id),baseTypes=d?.types||[],baseName=d?.name||p.name||`#${p.id}`;
  const types=special?.form?.types?.length?special.form.types:baseTypes;
  const name=special?.form?specialFormLabel(special.form.formName,baseName):cap(baseName);
  const img=special?.form?(shiny&&special.form.shinyArt?special.form.shinyArt:special.form.art):sprite(p.id,shiny);
  const attrs=special?.form?` data-special-category="${special.category}" data-special-index="${special.formIndex}"`:'';
  return `<article class="poke-card" data-id="${p.id}" data-shiny="${shiny?'1':'0'}"${attrs}><div class="card-actions"><button class="fav ${favs.has(p.id)?'on':''}" data-fav="${p.id}" aria-label="Favoritar">★</button><button data-add="${p.id}" aria-label="Adicionar ao time">＋</button></div><span class="num">#${pad(p.id)}</span><img loading="lazy" src="${img}" onerror="this.src='${sprite(p.id,shiny)}';this.onerror=null" alt="${name}"><h3>${name}${shiny?' ✨':''}</h3><div class="types">${types.length?types.map(t=>`<span class="type ${t}">${TYPE_PT[t]||t}</span>`).join(''):'<span class="muted">carregando tipos…</span>'}</div></article>`;
}
function bindCards(root){root.querySelectorAll('.poke-card').forEach(c=>c.onclick=e=>{if(e.target.closest('button'))return;openPokemon(+c.dataset.id,c.dataset.shiny==='1',c.dataset.specialCategory||null,Number(c.dataset.specialIndex||0))});root.querySelectorAll('[data-fav]').forEach(b=>b.onclick=e=>{e.stopPropagation();const card=b.closest('.poke-card');toggleFav(+b.dataset.fav,card?.dataset.shiny==='1');b.classList.toggle('on',favs.has(+b.dataset.fav))});root.querySelectorAll('[data-add]').forEach(b=>b.onclick=e=>{e.stopPropagation();const card=b.closest('.poke-card');addToTeam(+b.dataset.add,card?.dataset.shiny==='1')})}
function toggleFav(id,shiny=false){if(favs.has(id)){favs.delete(id);delete favShiny[id]}else{favs.add(id);favShiny[id]=!!shiny}save();toast(favs.has(id)?'Adicionado aos desejos ⭐':'Removido dos desejos')}
async function openPokemon(id,initialShiny=false,specialCategory=null,specialIndex=0){const modal=$('#modal');if(modal.classList.contains('hidden'))modal.dataset.returnScroll=String(window.scrollY);const returnScroll=Number(modal.dataset.returnScroll||window.scrollY);const d=await getDetail(id),s=await getSpecies(id);const special=specialCategory?specialFormsFor(id,specialCategory)[specialIndex]:null;recent=[id,...recent.filter(x=>x!==id)].slice(0,8);save();let evo='<span class="muted">Evolução indisponível.</span>';if(s?.evolution_chain?.url){try{const chain=await fetchJSON(s.evolution_chain.url,'evo_'+s.evolution_chain.url.split('/').filter(Boolean).pop());const paths=[];function walk(node,path=[]){const nid=+(node.species.url.match(/\/(\d+)\/$/)||[])[1];const np=[...path,{id:nid,name:node.species.name}];if(!node.evolves_to.length)paths.push(np);else node.evolves_to.forEach(n=>walk(n,np))}walk(chain.chain);evo=paths.map(path=>`<div class="evo">${path.map((x,i)=>`${i?'→':''}<button data-evo="${x.id}"><img loading="lazy" data-evo-img="${x.id}" src="${sprite(x.id,false)}">${cap(x.name)}</button>`).join('')}</div>`).join('')}catch(e){console.warn(e)}}let specialSection='';
const evoSpecies=new Map();
if(s?.evolution_chain?.url){
  try{
    const chainForSpecial=await fetchJSON(s.evolution_chain.url,'evo_'+s.evolution_chain.url.split('/').filter(Boolean).pop());
    (function collect(node){
      const sid=+(node.species.url.match(/\/(\d+)\/$/)||[])[1];
      if(sid)evoSpecies.set(sid,node.species.name);
      node.evolves_to.forEach(collect);
    })(chainForSpecial.chain);
  }catch(e){console.warn('Falha ao coletar formas especiais da linha evolutiva',e)}
}
if(!evoSpecies.size)evoSpecies.set(id,d.name);
const specialGroups=[];
for(const [sid,sname] of evoSpecies){
  const cats=[];
  if(MEGA.has(sid))cats.push('mega');
  if(GMAX.has(sid))cats.push('gmax');
  for(const cat of cats){
    const fs=await getSpecialForms(sid,cat);
    if(fs.length){
      specialGroups.push(`<div class="special-form-group"><h4>${cat==='mega'?'💥 Mega Evoluções':'⚡ Gigantamax'} de ${cap(sname)}</h4><div class="special-form-grid">${fs.map((f,i)=>`<button class="special-form-card" data-special-id="${sid}" data-special-open="${cat}" data-special-index="${i}"><img loading="lazy" data-special-img="1" data-normal-src="${f.art}" data-shiny-src="${f.shinyArt||f.art}" src="${initialShiny&&(f.shinyArt||f.art)?(f.shinyArt||f.art):f.art}" alt="${specialFormLabel(f.formName,sname)}"><span><strong>${specialFormLabel(f.formName,sname)}</strong><small>${f.types.map(t=>TYPE_PT[t]||t).join(' / ')}</small></span></button>`).join('')}</div></div>`);
    }
  }
}
if(specialGroups.length)specialSection=`<h3>Formas Especiais da Linha Evolutiva</h3><div class="special-forms-panel">${specialGroups.join('')}</div>`;
const forms=d.forms?.map(cap).join(', ')||'Forma padrão';const modalTypes=special?.types?.length?special.types:d.types;const modalName=special?specialFormLabel(special.formName,d.name):cap(d.name);const modalImg=special?(initialShiny&&special.shinyArt?special.shinyArt:special.art):sprite(id,initialShiny);$('#modalContent').innerHTML=`<div class="detail-top"><img id="detailImg" src="${modalImg}"><div><span class="num">#${pad(id)} • ${regionOf(id)}</span><h2>${modalName}</h2><div class="types">${modalTypes.map(t=>`<span class="type ${t}">${TYPE_PT[t]||t}</span>`).join('')}</div><p class="muted">${special?'Forma especial selecionada':'Formas registradas: '+forms}</p><div class="detail-actions"><button id="shinyBtn">✨ Shiny: ${initialShiny?'ON':'OFF'}</button><button id="modalFav" class="fav ${favs.has(id)?'on':''}">★ Favoritar</button><button id="modalAdd" class="primary">＋ Adicionar ao time</button></div></div></div><h3>Linha Evolutiva</h3>${evo}${specialSection}`;modal.classList.remove('charmander-rgb');modal.classList.add('pokemon-rgb');const typePalette={normal:['#a8a77a','#e5e2c7','#7f8064'],fire:['#f0442e','#ff9d32','#ffd35a'],water:['#2589e8','#63b9ff','#195fc1'],electric:['#f2c91c','#fff36a','#d99b00'],grass:['#35a853','#7bdc75','#1f7a3b'],ice:['#55cfd0','#b8f4f1','#3b9da8'],fighting:['#c53b32','#f06a4f','#7e201f'],poison:['#9b4bb0','#dc78e5','#682a7d'],ground:['#c9934d','#e5c57b','#8a5c2d'],flying:['#7aa6e8','#b9d2ff','#6f69b5'],psychic:['#ed4f83','#ff94b6','#a92f66'],bug:['#91a51c','#c8d94a','#596d13'],rock:['#b69b45','#ddc979','#766426'],ghost:['#6a57a5','#9d8bd4','#3e326c'],dragon:['#6245e8','#9a7cff','#3327a0'],dark:['#5b4a42','#9a8073','#2f2724'],steel:['#8fa5b5','#d1dce4','#607583'],fairy:['#e978a7','#ffb6d2','#ad4777']};const ts=special?.types?.length?special.types:(d.types||[]);const p1=typePalette[ts[0]]||['#36a8ff','#8ad8ff','#1d69c7'];const p2=typePalette[ts[1]]||p1;modal.style.setProperty('--poke-c1',p1[0]);modal.style.setProperty('--poke-c2',p1[1]);modal.style.setProperty('--poke-c3',p2[0]);modal.style.setProperty('--poke-c4',p2[1]);modal.style.setProperty('--poke-glow',p1[0]);modal.classList.remove('hidden');requestAnimationFrame(()=>window.scrollTo({top:returnScroll,left:0,behavior:'auto'}));let shiny=!!initialShiny;$('#shinyBtn').onclick=()=>{shiny=!shiny;$('#detailImg').src=special?(shiny&&special.shinyArt?special.shinyArt:special.art):sprite(id,shiny);document.querySelectorAll('[data-evo-img]').forEach(img=>img.src=sprite(+img.dataset.evoImg,shiny));document.querySelectorAll('[data-special-img]').forEach(img=>{img.src=shiny?(img.dataset.shinySrc||img.dataset.normalSrc):img.dataset.normalSrc});$('#shinyBtn').textContent=`✨ Shiny: ${shiny?'ON':'OFF'}`};$('#modalFav').onclick=()=>{toggleFav(id,shiny);$('#modalFav').classList.toggle('on',favs.has(id));$('#modalFav').textContent=favs.has(id)?'★ Favoritado':'★ Favoritar'};$('#modalAdd').onclick=()=>addToTeam(id,shiny);document.querySelectorAll('[data-special-open]').forEach(b=>b.onclick=()=>openPokemon(Number(b.dataset.specialId||id),shiny,b.dataset.specialOpen,Number(b.dataset.specialIndex||0)));$$('[data-evo]').forEach(b=>b.onclick=()=>openPokemon(+b.dataset.evo,shiny))}
function closePokemonModal(){const modal=$('#modal'),y=Number(modal.dataset.returnScroll||window.scrollY);modal.classList.add('hidden');requestAnimationFrame(()=>window.scrollTo({top:y,left:0,behavior:'auto'}))}$('#closeModal').onclick=closePokemonModal;$('#modal').onclick=e=>{if(e.target.id==='modal')closePokemonModal()};
function updateHome(){ $('#homeFavs').textContent=favs.size;$('#homeTeams').textContent=teams.length;$('#homeRoulette').textContent=roulette.size;const box=$('#recentList');if(!recent.length){box.className='mini-list empty-state';box.textContent='Nenhum Pokémon pesquisado ainda.';return}box.className='mini-list';box.innerHTML=recent.map(id=>{const p=state.list[id-1]||{name:`#${id}`};return `<button class="mini-poke" data-recent="${id}"><img src="${sprite(id)}">${cap(p.name)}</button>`}).join('');$$('[data-recent]').forEach(b=>b.onclick=()=>openPokemon(+b.dataset.recent))}
function renderFavs(){const q=$('#favSearch').value.toLowerCase();const arr=[...favs].sort((a,b)=>a-b).map(id=>state.list[id-1]||{id,name:`pokemon-${id}`}).filter(p=>matchesSearch(p,q));$('#favResults').innerHTML=arr.length?arr.map(p=>cardHTML(p,!!favShiny[p.id])).join(''):'<div class="empty-state">Sua lista de desejos está vazia.</div>';bindCards($('#favResults'))}
$('#clearFavs').onclick=async()=>{if(!favs.size)return;const ok=await siteConfirm('Remover todos os favoritos?',{title:'Limpar Desejos',confirmText:'Remover todos',icon:'⭐',danger:true});if(ok){favs.clear();save();renderFavs()}};$('#favSearch').oninput=renderFavs;
function defensiveMultiplier(attackType,defenderTypes){
  return defenderTypes.reduce((m,t)=>m*(TYPE_CHART[attackType]?.[t]??1),1);
}
function teamMetricsFromTypes(typeSets){
  if(!typeSets.length)return {score:0,covered:[],uncovered:TYPES.slice(),shared:[],defensiveCovered:0};
  const rows=TYPES.map(type=>{const values=typeSets.map(types=>defensiveMultiplier(type,types));return {type,weak:values.filter(v=>v>1).length,resist:values.filter(v=>v>0&&v<1).length,immune:values.filter(v=>v===0).length,max:Math.max(...values)}});
  const shared=rows.filter(x=>x.weak>=2).sort((a,b)=>b.weak-a.weak||b.max-a.max);
  const elementTypes=[...new Set(typeSets.flat())];
  const covered=TYPES.filter(defType=>elementTypes.some(atk=>(TYPE_CHART[atk]?.[defType]??1)>1));
  const uncovered=TYPES.filter(type=>!covered.includes(type));
  const defensiveCovered=rows.filter(x=>x.resist>0||x.immune>0).length;
  const sharedBurden=shared.reduce((sum,x)=>sum+(x.weak-1),0);
  const score=Math.max(0,Math.min(100,Math.round((covered.length/TYPES.length)*50+(defensiveCovered/TYPES.length)*30+Math.max(0,20-Math.min(20,sharedBurden*4)))));
  return {score,covered,uncovered,shared,defensiveCovered,rows,elementTypes};
}
function recommendationFilterMatch(p,filter){
  if(filter==='all')return true;
  if(filter==='no-legend')return !LEGENDARY.has(p.id)&&!MYTHICAL.has(p.id);
  if(filter==='legendary')return LEGENDARY.has(p.id);
  if(filter==='mythical')return MYTHICAL.has(p.id);
  if(filter.startsWith('region:'))return regionOf(p.id)===filter.slice(7);
  return true;
}
function synergyLabel(gain,newCoverage,resists,immunes){
  const value=gain+newCoverage.length*2+resists.length*2+immunes.length*3;
  if(value>=18)return 'Excelente';
  if(value>=10)return 'Muito boa';
  if(value>=5)return 'Boa';
  return 'Complementar';
}
function computeTeamRecommendations(t,filter='all',limit=8){
  if(t.members.length>=6)return [];
  const currentTypes=t.members.map(id=>state.details.get(id)?.types).filter(Boolean);
  if(currentTypes.length!==t.members.length)return [];
  const base=teamMetricsFromTypes(currentTypes);
  const existing=new Set(t.members);
  return state.list.filter(p=>!existing.has(p.id)&&recommendationFilterMatch(p,filter)&&state.details.get(p.id)?.types?.length).map(p=>{
    const types=state.details.get(p.id).types;
    const next=teamMetricsFromTypes([...currentTypes,types]);
    const newCoverage=next.covered.filter(x=>!base.covered.includes(x));
    const fixedWeaknesses=base.shared.filter(w=>!next.shared.some(n=>n.type===w.type&&n.weak>=w.weak));
    const resistsWeaknesses=base.shared.filter(w=>defensiveMultiplier(w.type,types)>0&&defensiveMultiplier(w.type,types)<1);
    const immunesWeaknesses=base.shared.filter(w=>defensiveMultiplier(w.type,types)===0);
    const gain=next.score-base.score;
    const diversityGain=new Set([...base.elementTypes,...types]).size-base.elementTypes.length;
    const utility=gain*100+newCoverage.length*16+fixedWeaknesses.length*14+resistsWeaknesses.length*8+immunesWeaknesses.length*12+diversityGain*6;
    const synergy=synergyLabel(gain,newCoverage,resistsWeaknesses,immunesWeaknesses);
    return {p,types,nextScore:next.score,gain,newCoverage,fixedWeaknesses,resistsWeaknesses,immunesWeaknesses,diversityGain,synergy,utility};
  }).sort((a,b)=>b.utility-a.utility||b.nextScore-a.nextScore||a.p.id-b.p.id).slice(0,limit);
}
function teamRecommendationsHTML(t){
  if(!t.members.length||t.members.length>=6)return '';
  const missing=t.members.some(id=>!state.details.get(id)?.types?.length);
  if(missing)return '<div class="team-recommendations"><h3>💡 Recomendações para o próximo membro</h3><p class="muted">Carregando dados para gerar recomendações…</p></div>';
  const filter=state.teamRecFilter||'no-legend';
  const recs=computeTeamRecommendations(t,filter,8);
  const regionOptions=REGIONS.map(r=>`<option value="region:${r[0]}" ${filter===`region:${r[0]}`?'selected':''}>${r[0]}</option>`).join('');
  return `<div class="team-recommendations">
    <div class="recommendations-head"><div><span class="eyebrow">ASSISTENTE DE EQUIPE</span><h3>💡 Recomendações para o próximo membro</h3></div>
      <select id="teamRecFilter"><option value="no-legend" ${filter==='no-legend'?'selected':''}>Sem Lendários/Míticos</option><option value="all" ${filter==='all'?'selected':''}>Todos</option><option value="legendary" ${filter==='legendary'?'selected':''}>Lendários</option><option value="mythical" ${filter==='mythical'?'selected':''}>Míticos</option>${regionOptions}</select>
    </div>
    <p class="muted">Base universal: considera apenas tipos elementais, fraquezas, resistências, imunidades, diversidade e complementaridade entre Pokémon.</p>
    <div class="recommendation-grid">${recs.length?recs.map(r=>{
      const reasons=[];
      if(r.immunesWeaknesses.length)reasons.push(`anula ${r.immunesWeaknesses.map(x=>TYPE_PT[x.type]).join(', ')}`);
      else if(r.resistsWeaknesses.length)reasons.push(`resiste a ${r.resistsWeaknesses.map(x=>TYPE_PT[x.type]).join(', ')}`);
      if(r.newCoverage.length)reasons.push(`cobre +${r.newCoverage.length} tipos`);
      if(r.diversityGain>0)reasons.push('aumenta diversidade elemental');
      if(!reasons.length&&r.gain>0)reasons.push(`+${r.gain} equilíbrio`);
      return `<article class="recommendation-card"><img src="${sprite(r.p.id,false)}"><div class="rec-main"><b>#${pad(r.p.id)} ${cap(r.p.name)}</b><div class="types">${r.types.map(type=>`<span class="type ${type}">${TYPE_PT[type]}</span>`).join('')}</div><small>${reasons.slice(0,2).join(' • ')||'Complementa os tipos atuais'}</small><span class="synergy-badge">Sinergia: ${r.synergy}</span></div><div class="rec-score"><span>Nova nota</span><strong>${r.nextScore}/100</strong><button data-rec-add="${r.p.id}">Adicionar</button></div></article>`;
    }).join(''):'<div class="empty-state">Nenhum candidato disponível com este filtro.</div>'}</div>
    <p class="analysis-note">Base universal do PokéTeam: somente tipagem elemental, fraquezas, resistências, imunidades, cobertura e sinergia. Moves, Nature, EVs/IVs, abilities, itens e mecânicas específicas não entram nas recomendações.</p>
  </div>`;
}
function teamAnalysisHTML(t){
  if(!t.members.length)return '<div class="team-analysis empty-analysis"><h3>🛡️ Análise de tipos</h3><p>Adicione Pokémon para analisar defesa, cobertura ofensiva e equilíbrio do time.</p></div>';
  const missing=t.members.filter(id=>!state.details.get(id)?.types?.length);
  if(missing.length)return '<div class="team-analysis"><h3>🛡️ Análise de tipos</h3><p class="muted">Carregando tipos dos Pokémon…</p></div>';

  const members=t.members.map(id=>state.details.get(id));
  const rows=TYPES.map(type=>{
    const values=members.map(d=>defensiveMultiplier(type,d.types));
    return {type,weak:values.filter(v=>v>1).length,resist:values.filter(v=>v>0&&v<1).length,immune:values.filter(v=>v===0).length,max:Math.max(...values)};
  });
  const shared=rows.filter(x=>x.weak>=2).sort((a,b)=>b.weak-a.weak||b.max-a.max);
  const immunities=rows.filter(x=>x.immune>0).sort((a,b)=>b.immune-a.immune);
  const resistances=rows.filter(x=>x.resist>0).sort((a,b)=>b.resist-a.resist);

  const elementTypes=[...new Set(members.flatMap(d=>d.types))];
  const offensive=TYPES.map(defType=>{
    const attackers=elementTypes.filter(atk=>(TYPE_CHART[atk]?.[defType]??1)>1);
    return {type:defType,attackers};
  });
  const covered=offensive.filter(x=>x.attackers.length);
  const uncovered=offensive.filter(x=>!x.attackers.length);
  const defensiveCovered=rows.filter(x=>x.resist>0||x.immune>0).length;
  const sharedBurden=shared.reduce((sum,x)=>sum+(x.weak-1),0);

  const offensiveScore=(covered.length/TYPES.length)*50;
  const defensiveScore=(defensiveCovered/TYPES.length)*30;
  const weaknessScore=Math.max(0,20-Math.min(20,sharedBurden*4));
  const balanceScore=Math.max(0,Math.min(100,Math.round(offensiveScore+defensiveScore+weaknessScore)));

  const badge=(x,kind,count)=>`<span class="analysis-pill ${kind}"><span class="type ${x.type}">${TYPE_PT[x.type]}</span><b>${count}</b></span>`;
  const typeBadge=(type,kind='coverage')=>`<span class="analysis-pill ${kind}"><span class="type ${type}">${TYPE_PT[type]}</span></span>`;
  const scoreLabel=balanceScore>=80?'Muito equilibrado':balanceScore>=65?'Bom equilíbrio':balanceScore>=50?'Equilíbrio médio':'Precisa de ajustes';

  return `<div class="team-analysis">
    <div class="analysis-head">
      <div><span class="eyebrow">VISÃO GERAL DO TIME</span><h3>⚔️ Análise do time</h3></div>
      <span class="analysis-count">${t.members.length}/6 Pokémon</span>
    </div>

    <div class="balance-card">
      <div><span class="eyebrow">EQUILÍBRIO</span><strong>${balanceScore}/100</strong><small>${scoreLabel}</small></div>
      <div class="balance-bar"><span style="width:${balanceScore}%"></span></div>
      <p>Indicador heurístico baseado em cobertura elemental, resistências/imunidades e fraquezas compartilhadas.</p>
    </div>

    <div class="analysis-section"><h4>⚠️ Fraquezas compartilhadas</h4>
      <div class="analysis-pills">${shared.length?shared.map(x=>badge(x,'weak',x.weak+' vulneráveis')).join(''):'<span class="muted">Nenhuma fraqueza compartilhada por 2 ou mais membros.</span>'}</div>
    </div>

    <div class="analysis-section"><h4>🚫 Imunidades</h4>
      <div class="analysis-pills">${immunities.length?immunities.map(x=>badge(x,'immune',x.immune+' imune'+(x.immune>1?'s':''))).join(''):'<span class="muted">Nenhuma imunidade no time.</span>'}</div>
    </div>

    <div class="analysis-section"><h4>🛡️ Resistências</h4>
      <div class="analysis-pills">${resistances.length?resistances.map(x=>badge(x,'resist',x.resist+' resistente'+(x.resist>1?'s':''))).join(''):'<span class="muted">Nenhuma resistência identificada.</span>'}</div>
    </div>

    <div class="analysis-section offensive-section">
      <div class="coverage-head"><h4>🎯 Cobertura elemental</h4><b>${covered.length}/${TYPES.length} tipos</b></div>
      <p class="muted">Mostra contra quais tipos a combinação elemental natural do time oferece vantagem geral.</p>
      <div class="coverage-block"><span class="coverage-label">Super efetivo contra</span><div class="analysis-pills">${covered.map(x=>typeBadge(x.type,'coverage')).join('')}</div></div>
      <div class="coverage-block"><span class="coverage-label">Sem cobertura elemental</span><div class="analysis-pills">${uncovered.length?uncovered.map(x=>typeBadge(x.type,'uncovered')).join(''):'<span class="muted">Cobertura completa dos 18 tipos.</span>'}</div></div>
    </div>

    <div class="analysis-section"><h4>⚔️ Tipos elementais disponíveis</h4>
      <div class="analysis-pills">${elementTypes.map(type=>typeBadge(type,'elemental')).join('')}</div>
    </div>

    <p class="analysis-note">Base universal do PokéTeam: esta análise usa apenas tipos elementais, fraquezas, resistências, imunidades e complementaridade. Mecânicas específicas de jogos são ignoradas.</p>
  </div>`;
}
function ensureTeamDetails(t){
  const missing=[...new Set(t.members.filter(id=>!state.details.get(id)?.types?.length))];
  if(!missing.length)return;
  Promise.allSettled(missing.map(getDetail)).then(()=>{if(state.activeTeam===t.id&&$('#teams').classList.contains('active'))renderTeams()});
}
function renderTeams(){
  if(!teams.length){$('#teamTabs').innerHTML='';$('#teamArea').innerHTML='<div class="panel empty-state">Você ainda não criou equipes. Clique em “+ Criar equipe”.</div>';return}
  if(!teams.some(t=>t.id===state.activeTeam))state.activeTeam=teams[0].id;
  $('#teamTabs').innerHTML=teams.map(t=>`<button data-team="${t.id}" class="${t.id===state.activeTeam?'active':''}">${t.name}</button>`).join('');
  $$('[data-team]').forEach(b=>b.onclick=()=>{state.activeTeam=+b.dataset.team;renderTeams()});
  const t=teams.find(x=>x.id===state.activeTeam);
  const slots=Array.from({length:6},(_,i)=>{
    const id=t.members[i];
    if(!id)return '<div class="slot empty-slot"><span class="empty-plus">＋</span><span>Adicionar<br>Pokémon</span></div>';
    const shiny=!!t.memberShiny?.[i],iv100=!!t.memberIV100?.[i],p=state.list[id-1]||{name:`#${id}`},d=state.details.get(id);
    return `<div class="slot filled"><img src="${sprite(id,shiny)}"><h4>${cap(p.name)}${shiny?' ✨':''}${iv100?' 💯':''}</h4><small>#${pad(id)} ${d?.types?.join(' / ')||''}${iv100?' • IV 100%':''}</small><button data-remove-member="${i}">Remover</button></div>`
  }).join('');
  $('#teamArea').innerHTML=`<div class="team-card"><div class="team-head"><h2>${t.name}</h2><div><button id="renameTeam">Renomear</button> <button id="clearTeam">Limpar</button> <button id="deleteTeam" class="danger">Excluir</button></div></div><div class="team-slots">${slots}</div>${teamAnalysisHTML(t)}${teamRecommendationsHTML(t)}</div>`;
  $$('[data-remove-member]').forEach(b=>b.onclick=()=>{const i=+b.dataset.removeMember;t.members.splice(i,1);t.memberShiny?.splice(i,1);t.memberIV100?.splice(i,1);save();renderTeams()});
  $('#renameTeam').onclick=()=>{
    const modal=$('#teamChooser'),content=$('#teamChooserContent');
    content.innerHTML=`<div class="team-create-form"><span class="eyebrow">TEAM BUILDER</span><h2>Renomear equipe</h2><label for="teamNameInput">Nome da equipe</label><input id="teamNameInput" type="text" maxlength="40" value="${t.name.replace(/"/g,'&quot;')}" autocomplete="off"><div class="team-create-actions"><button id="cancelTeamCreate">Cancelar</button><button id="confirmTeamCreate" class="primary">Salvar nome</button></div></div>`;
    modal.classList.remove('hidden');
    const input=$('#teamNameInput'),submit=()=>{const name=input.value.trim();if(!name){toast('Digite um nome para a equipe.');return}t.name=name.slice(0,40);save();closeTeamChooser();renderTeams()};
    $('#confirmTeamCreate').onclick=submit;$('#cancelTeamCreate').onclick=closeTeamChooser;input.focus();input.select();input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();submit()}};
  };
  $('#clearTeam').onclick=async()=>{const ok=await siteConfirm(`Remover todos os Pokémon de "${t.name}"?`,{title:'Limpar equipe',confirmText:'Limpar equipe',icon:'🧹',danger:true});if(ok){t.members=[];t.memberShiny=[];t.memberIV100=[];save();renderTeams()}};
  $('#deleteTeam').onclick=async()=>{const ok=await siteConfirm(`Excluir definitivamente a equipe "${t.name}"?`,{title:'Excluir equipe',confirmText:'Excluir equipe',icon:'🗑️',danger:true});if(ok){teams=teams.filter(x=>x.id!==t.id);state.activeTeam=teams[0]?.id||null;save();renderTeams()}};
  if($('#teamRecFilter'))$('#teamRecFilter').onchange=e=>{state.teamRecFilter=e.target.value;renderTeams()};
  $$('[data-rec-add]').forEach(b=>b.onclick=()=>openTeamChooser(+b.dataset.recAdd,false));
  ensureTeamDetails(t);
}
function createTeamNamed(name){
  const clean=(name||'').trim().slice(0,40);
  if(!clean)return null;
  const team={id:Date.now()+Math.floor(Math.random()*1000),name:clean,members:[],memberShiny:[],memberIV100:[]};
  teams.push(team);state.activeTeam=team.id;save();renderTeams();return team;
}
function teamNameFormHTML(title='Criar nova equipe'){
  return `<div class="team-create-form">
    <span class="eyebrow">TEAM BUILDER</span>
    <h2>${title}</h2>
    <label for="teamNameInput">Nome da equipe</label>
    <input id="teamNameInput" type="text" maxlength="40" value="Equipe ${teams.length+1}" autocomplete="off">
    <div class="team-create-actions">
      <button id="cancelTeamCreate">Cancelar</button>
      <button id="confirmTeamCreate" class="primary">Criar equipe</button>
    </div>
  </div>`;
}
function bindTeamNameForm(onCreated){
  const input=$('#teamNameInput');
  const submit=()=>{
    const name=input?.value?.trim();
    if(!name){toast('Digite um nome para a equipe.');input?.focus();return}
    const t=createTeamNamed(name);
    if(t)onCreated?.(t);
  };
  $('#confirmTeamCreate').onclick=submit;
  $('#cancelTeamCreate').onclick=closeTeamChooser;
  input?.focus();input?.select();
  input?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();submit()}});
}
function createTeam(){
  const modal=$('#teamChooser'),content=$('#teamChooserContent');
  if(!modal||!content){toast('Não foi possível abrir o criador de equipe.');return null}
  content.innerHTML=teamNameFormHTML();
  modal.classList.remove('hidden');
  bindTeamNameForm(()=>closeTeamChooser());
  return null;
}
async function commitAddToTeam(team,id,shiny=false,iv100=false){
  if(!team)return false;
  if(team.members.length>=6){toast(`${team.name} está cheia (6/6).`);return false}
  const already=team.members.some((memberId,i)=>memberId===id&&!!team.memberShiny?.[i]===!!shiny&&!!team.memberIV100?.[i]===!!iv100);
  if(already){
    const name=`${cap(state.list[id-1]?.name||'Pokémon')}${shiny?' Shiny':''}${iv100?' 100% IV':''}`;
    const ok=await siteConfirm(`${name} já está nesta equipe. Deseja mesmo adicionar outra cópia?`,{title:'Pokémon repetido',confirmText:'Adicionar outra cópia',icon:'⚔️'});
    if(!ok)return false;
  }
  team.memberShiny=Array.isArray(team.memberShiny)?team.memberShiny:[];
  team.memberIV100=Array.isArray(team.memberIV100)?team.memberIV100:[];
  while(team.memberShiny.length<team.members.length)team.memberShiny.push(false);
  while(team.memberIV100.length<team.members.length)team.memberIV100.push(false);
  team.members.push(id);team.memberShiny.push(!!shiny);team.memberIV100.push(!!iv100);state.activeTeam=team.id;save();
  try{renderTeams()}catch(e){console.error('Falha ao atualizar a tela de Times após adicionar Pokémon',e)}
  toast(`${cap(state.list[id-1]?.name||'Pokémon')}${shiny?' ✨':''}${iv100?' 💯':''} adicionado a ${team.name}`);
  return true;
}
function closeTeamChooser(){const el=$('#teamChooser');if(el)el.classList.add('hidden')}
function openTeamChooser(id,shiny=false,iv100=false){
  const modal=$('#teamChooser'),content=$('#teamChooserContent');
  if(!modal||!content){const fallback=teams.find(t=>t.members.length<6);if(fallback)return commitAddToTeam(fallback,id,shiny,iv100);toast('Não foi possível abrir o seletor de equipes.');return false}
  const p=state.list[id-1]||{name:`#${id}`};
  modal.dataset.pendingPokemonId=String(id);
  modal.dataset.pendingShiny=shiny?'1':'0';
  modal.dataset.pendingIV100=iv100?'1':'0';
  const list=teams.length?teams.map(t=>{
    const full=t.members.length>=6;
    return `<button class="team-choice ${full?'full':''}" data-team-choice="${t.id}" ${full?'disabled':''}>
      <span><b>${t.name}</b><small>${t.members.length}/6 Pokémon${full?' • equipe cheia':''}</small></span>
      <strong>${full?'Cheia':'Adicionar'}</strong>
    </button>`;
  }).join(''):'<div class="empty-state">Você ainda não criou nenhuma equipe.</div>';
  content.innerHTML=`<div class="team-chooser-head"><img src="${sprite(id,shiny)}"><div><span class="eyebrow">ADICIONAR AO TIME</span><h2>${cap(p.name)}${shiny?' ✨':''}${iv100?' 💯':''}</h2><p>${iv100?'IV 100% • ':''}Escolha uma equipe ou crie uma nova.</p></div></div><div class="team-choice-list">${list}</div><button id="chooserCreateTeam" class="primary">＋ Criar nova equipe</button>`;
  modal.classList.remove('hidden');
  $('#chooserCreateTeam').onclick=()=>{
    content.innerHTML=teamNameFormHTML('Criar equipe para '+cap(p.name));
    bindTeamNameForm(async t=>{if(await commitAddToTeam(t,id,shiny,iv100))closeTeamChooser()});
  };
  return true;
}
function addToTeam(id,shiny=false,iv100=false){return openTeamChooser(id,shiny,iv100)}
$('#newTeam').onclick=createTeam;
$('#closeTeamChooser').onclick=closeTeamChooser;
$('#teamChooser').onclick=async e=>{
  if(e.target.id==='teamChooser'){closeTeamChooser();return}
  const choice=e.target.closest?.('[data-team-choice]');
  if(!choice||choice.disabled)return;
  const t=teams.find(x=>String(x.id)===String(choice.dataset.teamChoice));
  const id=+$('#teamChooser').dataset.pendingPokemonId;
  const shiny=$('#teamChooser').dataset.pendingShiny==='1';
  const iv100=$('#teamChooser').dataset.pendingIV100==='1';
  if(!t||!id){toast('Não foi possível identificar a equipe ou o Pokémon.');return}
  choice.disabled=true;
  try{
    if(await commitAddToTeam(t,id,shiny,iv100))closeTeamChooser();
  }finally{
    if(document.body.contains(choice))choice.disabled=t.members.length>=6;
  }
};

const ROULETTE_TYPE_COLORS={normal:'#858b91',fire:'#e75d47',water:'#4d83cf',electric:'#d7b630',grass:'#4c9b5f',ice:'#68b9c3',fighting:'#b44a42',poison:'#9651a5',ground:'#b98555',flying:'#738fc5',psychic:'#d85d91',bug:'#7f9a35',rock:'#9e8b58',ghost:'#5e5d99',dragon:'#5e55b8',dark:'#4c4655',steel:'#6f8c9b',fairy:'#d77fb5'};
const rouletteImages=new Map();
const rouletteKey=(id,shiny=false,iv100=false)=>`${id}:${shiny?(iv100?'s100':'s'):(iv100?'n100':'n')}`;
function parseRouletteKey(key){
  const m=String(key).match(/^(\d+):(n|s|n100|s100)$/);
  if(!m)return null;
  return {id:+m[1],shiny:m[2][0]==='s',iv100:m[2].endsWith('100')};
}
function rouletteVariantLabel(entry){
  return `${entry.shiny?'✨ Shiny':'Normal'}${entry.iv100?' 💯 IV 100%':''}`;
}
function rouletteCategoryMatch(p,cat){
  if(cat==='all')return true;
  if(cat==='ub')return UB.has(p.id);
  if(cat==='starter')return STARTERS.has(p.id);
  if(cat==='mega')return MEGA.has(p.id);
  if(cat==='gmax')return GMAX.has(p.id);
  if(cat==='legendary')return LEGENDARY.has(p.id);
  if(cat==='mythical')return MYTHICAL.has(p.id);
  return true;
}
function rouletteFiltered(){
  const q=$('#rouletteSearch').value,reg=$('#rouletteRegion').value,type=$('#rouletteType').value;
  const cat=$('[data-roulette-cat].active')?.dataset.rouletteCat||'all';
  return state.list.filter(p=>{
    if(!matchesSearch(p,q))return false;
    if(reg!=='all'&&regionOf(p.id)!==reg)return false;
    if(!rouletteCategoryMatch(p,cat))return false;
    if(type!=='all'){
      const d=state.details.get(p.id);
      if(!d?.types?.includes(type))return false;
    }
    return true;
  });
}
function formatRouletteProbability(n){
  if(!n)return 'Selecione Pokémon para começar.';
  const pct=100/n,digits=pct>=10?2:pct>=1?3:4;
  return `1 em ${n.toLocaleString('pt-BR')} — ${pct.toLocaleString('pt-BR',{maximumFractionDigits:digits})}% para cada opção`;
}
function updateRouletteSummary(){
  const n=roulette.size;
  $('#rouletteCount').textContent=`${n.toLocaleString('pt-BR')} opção${n===1?'':'ões'} selecionada${n===1?'':'s'}`;
  $('#probabilityText').textContent=formatRouletteProbability(n);
  $('#rouletteSummary').textContent=n?`${n.toLocaleString('pt-BR')} entradas participando • Normal, 100% IV, Shiny e Shiny 100% IV contam separadamente • chances iguais`:'';
}
function activeRouletteVariants(){
  const defs=[
    ['variantNormal',false,false],
    ['variantNormal100',false,true],
    ['variantShiny',true,false],
    ['variantShiny100',true,true]
  ];
  return defs.filter(([id])=>$('#'+id)?.checked).map(([,shiny,iv100])=>({shiny,iv100}));
}
function selectedVariantCount(id){
  return [rouletteKey(id,false,false),rouletteKey(id,false,true),rouletteKey(id,true,false),rouletteKey(id,true,true)].filter(k=>roulette.has(k)).length;
}
function rouletteCatalogPreviewShiny(){
  const variants=activeRouletteVariants();
  return variants.length>0&&variants.every(v=>v.shiny);
}
function toggleCatalogPokemon(id){
  const variants=activeRouletteVariants();
  if(!variants.length){toast('Escolha pelo menos uma variante.');return}
  const keys=variants.map(v=>rouletteKey(id,v.shiny,v.iv100));
  const allSelected=keys.every(k=>roulette.has(k));
  keys.forEach(k=>allSelected?roulette.delete(k):roulette.add(k));
  save();renderPicker();drawWheel();
}
function renderPicker(){
  const arr=rouletteFiltered(),previewShiny=rouletteCatalogPreviewShiny();
  state.rouletteVisible=arr.map(x=>x.id);
  updateRouletteSummary();
  const grouped=REGIONS.map(([region])=>[region,arr.filter(p=>regionOf(p.id)===region)]).filter(([,items])=>items.length);
  $('#roulettePicker').innerHTML=grouped.length?grouped.map(([region,items])=>{
    const selected=items.reduce((sum,p)=>sum+selectedVariantCount(p.id),0);
    return `<section class="roulette-region-group roulette-region-static" data-roulette-region="${region}">
      <div class="roulette-region-header"><span><b>${region}</b><small>${items.length} Pokémon</small></span><em>${selected?selected+' opções escolhidas':'Todos exibidos'}</em></div>
      <div class="roulette-card-grid">${items.map(p=>{
        const d=state.details.get(p.id),types=d?.types||[],count=selectedVariantCount(p.id),name=d?.name||p.name||`#${p.id}`;
        const badges=[
          roulette.has(rouletteKey(p.id,false,false))?'<i>Normal</i>':'',
          roulette.has(rouletteKey(p.id,false,true))?'<i>💯</i>':'',
          roulette.has(rouletteKey(p.id,true,false))?'<i>✨</i>':'',
          roulette.has(rouletteKey(p.id,true,true))?'<i>✨💯</i>':''
        ].filter(Boolean).join('');
        return `<button class="roulette-poke-card ${count?'selected':''}" data-catalog-pokemon="${p.id}" title="Adicionar ou remover variantes ativas">
          <img loading="lazy" src="${sprite(p.id,previewShiny)}" alt="${cap(name)}${previewShiny?' Shiny':''}">
          <span class="catalog-poke-num">#${pad(p.id)}</span>
          <strong>${cap(name)}</strong>
          <small>${types.length?types.map(t=>TYPE_PT[t]).join(' / '):region}</small>
          <span class="catalog-selected-badges">${badges||'<i class="add-mark">＋ Adicionar</i>'}</span>
        </button>`;
      }).join('')}</div>
    </section>`;
  }).join(''):'<div class="empty-state">Nenhum Pokémon corresponde aos filtros atuais.</div>';
  document.querySelectorAll('[data-catalog-pokemon]').forEach(card=>card.onclick=()=>toggleCatalogPokemon(Number(card.dataset.catalogPokemon)));
}
function renderProbability(){updateRouletteSummary()}
function roulettePrimaryType(id){return state.details.get(id)?.types?.[0]||'normal'}
function getRouletteImage(id,shiny,iv100=false){
  const key=rouletteKey(id,shiny,iv100);
  if(rouletteImages.has(key))return rouletteImages.get(key);
  const img=new Image();img.crossOrigin='anonymous';img.src=sprite(id,shiny);img.onload=()=>{if(!spinning)drawWheel()};rouletteImages.set(key,img);return img;
}
function drawWheel(){
  const canvas=$('#wheel');if(!canvas)return;
  const ctx=canvas.getContext('2d'),entries=[...roulette].map(parseRouletteKey).filter(Boolean),n=entries.length,w=canvas.width,c=w/2,r=c-10;
  ctx.clearRect(0,0,w,w);
  if(!n){ctx.fillStyle='#172033';ctx.beginPath();ctx.arc(c,c,r,0,Math.PI*2);ctx.fill();ctx.fillStyle='#9aa7bd';ctx.font='700 22px system-ui';ctx.textAlign='center';ctx.fillText('Selecione Pokémon',c,c);return}
  const visual=n>72?entries.slice(0,72):entries,vn=visual.length;
  for(let i=0;i<vn;i++){
    const entry=visual[i],id=entry.id,a0=-Math.PI/2+i*2*Math.PI/vn,a1=-Math.PI/2+(i+1)*2*Math.PI/vn,mid=(a0+a1)/2;
    ctx.beginPath();ctx.moveTo(c,c);ctx.arc(c,c,r,a0,a1);ctx.closePath();ctx.fillStyle=ROULETTE_TYPE_COLORS[roulettePrimaryType(id)]||'#56627a';ctx.fill();ctx.strokeStyle='#0b1020';ctx.lineWidth=2;ctx.stroke();
    if(vn<=12){
      const img=getRouletteImage(id,entry.shiny,entry.iv100);
      if(img.complete&&img.naturalWidth){ctx.save();ctx.translate(c,c);ctx.rotate(mid);ctx.drawImage(img,r*.54,-27,54,54);ctx.restore()}
      ctx.save();ctx.translate(c,c);ctx.rotate(mid);ctx.textAlign='right';ctx.fillStyle='white';ctx.font='800 12px system-ui';ctx.shadowColor='#000';ctx.shadowBlur=4;ctx.fillText(`${cap(state.list[id-1]?.name||id)}${entry.shiny?' ✨':''}${entry.iv100?' 💯':''}`,r-10,4);ctx.restore();
    }else if(vn<=30){
      ctx.save();ctx.translate(c,c);ctx.rotate(mid);ctx.textAlign='right';ctx.fillStyle='white';ctx.font='800 10px system-ui';ctx.shadowColor='#000';ctx.shadowBlur=3;ctx.fillText(`${cap(state.list[id-1]?.name||id)}${entry.shiny?' ✨':''}${entry.iv100?' 💯':''}`,r-8,3);ctx.restore();
    }
  }
  ctx.beginPath();ctx.arc(c,c,48,0,Math.PI*2);ctx.fillStyle='#f5f7fb';ctx.fill();ctx.strokeStyle='#0b1020';ctx.lineWidth=10;ctx.stroke();ctx.fillStyle='#101624';ctx.textAlign='center';ctx.font='800 14px system-ui';ctx.fillText(n>72?`${n.toLocaleString('pt-BR')} opções`:`${n} opção${n===1?'':'ões'}`,c,c+5);
}
let spinning=false,rotation=0,spinTimer=null;
function resetSpinState(){spinning=false;const btn=$('#spin');if(btn){btn.disabled=false;btn.textContent='GIRAR ROLETA'}}
$('#spin').onclick=()=>{
  if(spinning)return;
  const entries=[...roulette].map(parseRouletteKey).filter(Boolean);
  if(!entries.length){toast('Selecione pelo menos 1 opção.');return}
  spinning=true;$('#spin').disabled=true;$('#spin').textContent='GIRANDO…';
  const idx=Math.floor(Math.random()*entries.length),winner=entries[idx],n=entries.length;
  let target;if(n<=72){const slice=360/n;target=360-(idx*slice+slice/2)}else target=Math.random()*360;
  rotation+=360*7+target;$('#wheel').style.transform=`rotate(${rotation}deg)`;$('#spinResult').innerHTML='<div class="result-box">🎡 Girando…</div>';
  clearTimeout(spinTimer);
  spinTimer=setTimeout(async()=>{
    resetSpinState();
    try{
      const p=state.list[winner.id-1]||{name:`#${winner.id}`},d=await getDetail(winner.id);
      $('#spinResult').innerHTML=`<div class="result-box roulette-result"><b>🎉 RESULTADO</b><img src="${sprite(winner.id,winner.shiny)}"><h2>${cap(p.name)}${winner.shiny?' ✨':''}${winner.iv100?' 💯':''}</h2><div class="roulette-variant-badge">${rouletteVariantLabel(winner)}</div><div class="types">${(d.types||[]).map(t=>`<span class="type ${t}">${TYPE_PT[t]||t}</span>`).join('')}</div><p>#${pad(winner.id)} • ${regionOf(winner.id)}<br>${formatRouletteProbability(n)}</p><div class="result-actions"><button id="rouletteViewDex">📖 Ver na Pokédex</button><button id="rouletteFav">⭐ Favoritar</button><button id="rouletteAddTeam">⚔️ Adicionar ao time</button></div></div>`;
      $('#rouletteViewDex').onclick=()=>{go('pokedex');openPokemon(winner.id,winner.shiny)};
      $('#rouletteFav').onclick=()=>{if(!favs.has(winner.id)){toggleFav(winner.id,winner.shiny)}else if(!!favShiny[winner.id]!==winner.shiny){favs.delete(winner.id);delete favShiny[winner.id];toggleFav(winner.id,winner.shiny);toast('Variante dos Desejos atualizada ⭐')}else toast('Esta variante já está nos Desejos ⭐')};
      $('#rouletteAddTeam').onclick=()=>openTeamChooser(winner.id,winner.shiny,winner.iv100);
    }catch(e){console.error('roulette result failed',e);$('#spinResult').innerHTML='<div class="result-box">O resultado foi sorteado, mas houve erro ao carregar os detalhes. Você pode girar novamente.</div>'}
  },4600);
};
$('#rouletteSearch').oninput=renderPicker;
$('#rouletteRegion').onchange=renderPicker;
$('#rouletteType').onchange=renderPicker;
['variantNormal','variantNormal100','variantShiny','variantShiny100'].forEach(id=>{
  $('#'+id).onchange=()=>renderPicker();
});
$('#addVisibleVariants').onclick=()=>{
  const variants=activeRouletteVariants();
  if(!variants.length){toast('Escolha pelo menos uma variante.');return}
  state.rouletteVisible.forEach(id=>variants.forEach(v=>roulette.add(rouletteKey(id,v.shiny,v.iv100))));
  save();renderPicker();drawWheel();
};
$('#removeVisible').onclick=()=>{state.rouletteVisible.forEach(id=>{
  roulette.delete(rouletteKey(id,false,false));roulette.delete(rouletteKey(id,false,true));
  roulette.delete(rouletteKey(id,true,false));roulette.delete(rouletteKey(id,true,true));
});save();renderPicker();drawWheel()};
$('#clearRoulette').onclick=()=>{roulette.clear();save();renderPicker();drawWheel();$('#spinResult').innerHTML='';resetSpinState()};
$('#dexShinyToggle').onclick=()=>{
  state.dexShiny=!state.dexShiny;
  const b=$('#dexShinyToggle');
  b.classList.toggle('active',state.dexShiny);
  b.setAttribute('aria-pressed',state.dexShiny?'true':'false');
  const status=b.querySelector('em');if(status)status.textContent=state.dexShiny?'ON':'OFF';
  renderDex();
};
let debounce;$('#dexSearch').oninput=()=>{clearTimeout(debounce);debounce=setTimeout(renderDex,120)};$('#regionFilter').onchange=e=>{state.activeRegion=e.target.value;$('#pokedex').animate?.([{opacity:.5},{opacity:1}],{duration:220});renderDex()};
window.addEventListener('error',e=>console.error('Non-fatal UI error:',e.error||e.message));window.addEventListener('unhandledrejection',e=>{console.error('Non-fatal promise error:',e.reason);e.preventDefault()});
// Inicialização resiliente: a Pokédex deve carregar mesmo que outra área falhe.
document.body.dataset.page='home';
(async function boot(){
  try{setupSelects()}catch(e){console.error('setupSelects failed',e)}
  try{await initData()}catch(e){console.error('initData failed',e);state.list=Array.from({length:MAX},(_,i)=>({id:i+1,name:`pokemon-${i+1}`}));try{renderDex()}catch(err){console.error(err)}}
  try{updateHome()}catch(e){console.error('updateHome failed',e)}
  try{renderTeams()}catch(e){console.error('renderTeams failed',e)}
  try{drawWheel()}catch(e){console.error('drawWheel failed',e)}
})();
