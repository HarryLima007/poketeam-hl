(() => {
  'use strict';

  let pendingTeamForm = null;

  function normalizeTeamForms(team){
    if(!team) return [];
    const size = Array.isArray(team.members) ? team.members.length : 0;
    const forms = Array.isArray(team.memberForms) ? team.memberForms.slice(0, size) : [];
    while(forms.length < size) forms.push(null);
    team.memberForms = forms;
    return forms;
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
    const category = card.dataset.specialCategory || '';
    const index = Number(card.dataset.specialIndex || 0);
    return formPayload(id, category, index);
  }

  function formFromModal(){
    const modal = document.getElementById('modalContent');
    if(!modal) return null;
    const specialText = [...modal.querySelectorAll('.muted')].some(el => /Forma especial selecionada/i.test(el.textContent || ''));
    if(!specialText) return null;

    const numText = modal.querySelector('.num')?.textContent || '';
    const id = Number((numText.match(/#(\d+)/) || [])[1]);
    const title = (modal.querySelector('h2')?.textContent || '').trim();
    if(!id || !title) return null;

    for(const category of ['mega','gmax','transform']){
      const forms = specialFormsFor(id, category) || [];
      for(let i = 0; i < forms.length; i++){
        const form = forms[i];
        if(labelForForm(id, form).trim() === title) return formPayload(id, category, i);
      }
    }

    const types = [...modal.querySelectorAll('.detail-top .type')].map(el => {
      const classes = [...el.classList].filter(c => c !== 'type');
      return classes[0] || '';
    }).filter(Boolean);
    return {
      category: 'transform',
      formName: title.toLowerCase().replace(/\s+/g, '-'),
      label: title,
      art: modal.querySelector('#detailImg')?.src || '',
      shinyArt: '',
      types
    };
  }

  function patchTeamChooserPreview(){
    if(!pendingTeamForm) return;
    const chooser = document.getElementById('teamChooser');
    const head = document.querySelector('#teamChooserContent .team-chooser-head');
    if(!chooser || !head || chooser.classList.contains('hidden')) return;

    const shiny = chooser.dataset.pendingShiny === '1';
    const iv100 = chooser.dataset.pendingIV100 === '1';
    const img = head.querySelector('img');
    const title = head.querySelector('h2');
    const desc = head.querySelector('p');
    const label = pendingTeamForm.label || pendingTeamForm.formName || 'Forma especial';
    const formTag = pendingTeamForm.category === 'mega' ? 'Mega Evolução' : pendingTeamForm.category === 'gmax' ? 'Gigantamax' : 'Forma especial';

    if(img){
      img.src = shiny && pendingTeamForm.shinyArt ? pendingTeamForm.shinyArt : (pendingTeamForm.art || img.src);
      img.alt = label;
    }
    if(title) title.textContent = `${label}${shiny ? ' ✨' : ''}${iv100 ? ' 💯' : ''}`;
    if(desc) desc.textContent = `${formTag}${iv100 ? ' • IV 100%' : ''} • Escolha uma equipe ou crie uma nova.`;
  }

  document.addEventListener('click', event => {
    const add = event.target.closest?.('#dexResults [data-add]');
    if(add){
      pendingTeamForm = formFromCard(add.closest('.poke-card'));
      requestAnimationFrame(patchTeamChooserPreview);
      return;
    }
    if(event.target.closest?.('#modalAdd')){
      pendingTeamForm = formFromModal();
      requestAnimationFrame(patchTeamChooserPreview);
      return;
    }
    if(event.target.closest?.('#closeTeamChooser, #cancelTeamCreate')) pendingTeamForm = null;
  }, true);

  if(typeof openTeamChooser === 'function'){
    const originalOpenTeamChooser = openTeamChooser;
    openTeamChooser = function(){
      const result = originalOpenTeamChooser.apply(this, arguments);
      requestAnimationFrame(patchTeamChooserPreview);
      return result;
    };
  }

  if(typeof commitAddToTeam === 'function'){
    const originalCommitAddToTeam = commitAddToTeam;
    commitAddToTeam = async function(team, id, shiny = false, iv100 = false){
      normalizeTeamForms(team);
      const before = team?.members?.length || 0;
      const selectedForm = pendingTeamForm ? {...pendingTeamForm, types:[...(pendingTeamForm.types || [])]} : null;
      const result = await originalCommitAddToTeam.call(this, team, id, shiny, iv100);
      if(result && team && team.members.length === before + 1){
        normalizeTeamForms(team);
        team.memberForms[team.members.length - 1] = selectedForm;
        save();
        try{ renderTeams(); }catch(err){ console.error('Falha ao renderizar forma especial no time', err); }
      }
      pendingTeamForm = null;
      return result;
    };
  }

  function patchTeamSlots(){
    const team = teams.find(t => t.id === state.activeTeam);
    if(!team) return;
    const forms = normalizeTeamForms(team);
    const slots = [...document.querySelectorAll('#teamArea .team-slots .slot.filled')];

    slots.forEach((slot, index) => {
      const id = team.members[index];
      const form = forms[index];
      const shiny = !!team.memberShiny?.[index];
      const iv100 = !!team.memberIV100?.[index];

      if(form){
        const img = slot.querySelector('img');
        const title = slot.querySelector('h4');
        const info = slot.querySelector('small');
        if(img) img.src = shiny && form.shinyArt ? form.shinyArt : (form.art || sprite(id, shiny));
        if(title) title.textContent = `${form.label || cap(state.list[id - 1]?.name || `#${id}`)}${shiny ? ' ✨' : ''}${iv100 ? ' 💯' : ''}`;
        if(info){
          const typeText = (form.types || []).map(type => TYPE_PT[type] || cap(type)).join(' / ');
          const formTag = form.category === 'mega' ? 'Mega' : form.category === 'gmax' ? 'Gigantamax' : 'Forma especial';
          info.textContent = `#${pad(id)}${typeText ? ' • ' + typeText : ''} • ${formTag}${iv100 ? ' • IV 100%' : ''}`;
        }
      }

      const remove = slot.querySelector('[data-remove-member]');
      if(remove){
        remove.onclick = () => {
          const i = Number(remove.dataset.removeMember);
          team.members.splice(i, 1);
          team.memberShiny?.splice(i, 1);
          team.memberIV100?.splice(i, 1);
          team.memberForms?.splice(i, 1);
          save();
          renderTeams();
        };
      }
    });
  }

  if(typeof renderTeams === 'function'){
    const originalRenderTeams = renderTeams;
    renderTeams = function(){
      const result = originalRenderTeams.apply(this, arguments);
      requestAnimationFrame(patchTeamSlots);
      return result;
    };
  }

  try{
    teams.forEach(normalizeTeamForms);
    requestAnimationFrame(patchTeamSlots);
  }catch(err){
    console.error('Falha ao inicializar suporte a formas especiais nos times', err);
  }
})();
