(() => {
  'use strict';

  const variants = [
    {key:'n', label:'Normal', shiny:false, iv100:false, cls:'normal'},
    {key:'n100', label:'100% IV', shiny:false, iv100:true, cls:'iv'},
    {key:'s', label:'Shiny', shiny:true, iv100:false, cls:'shiny'},
    {key:'s100', label:'Shiny 100%', shiny:true, iv100:true, cls:'shiny100'}
  ];

  function keyFor(id, variant){
    return rouletteKey(id, variant.shiny, variant.iv100);
  }

  function syncVariantButtons(card){
    const id = Number(card.dataset.catalogPokemon);
    card.querySelectorAll('[data-card-variant]').forEach(btn => {
      const variant = variants.find(v => v.key === btn.dataset.cardVariant);
      if(!variant) return;
      const active = roulette.has(keyFor(id, variant));
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
      btn.title = `${active ? 'Remover' : 'Adicionar'} ${variant.label}`;
    });
  }

  function toggleVariant(id, variant, card){
    const key = keyFor(id, variant);
    if(roulette.has(key)) roulette.delete(key);
    else roulette.add(key);
    save();
    refreshRouletteCatalogCard(id);
    syncVariantButtons(card);
    drawWheel();
  }

  function enhanceCard(card){
    if(card.dataset.variantControlsReady === '1'){
      syncVariantButtons(card);
      return;
    }
    card.dataset.variantControlsReady = '1';
    card.onclick = null;
    card.removeAttribute('title');

    const controls = document.createElement('span');
    controls.className = 'card-variant-controls';
    controls.setAttribute('aria-label', 'Variantes do Pokémon');

    variants.forEach(variant => {
      const btn = document.createElement('span');
      btn.className = `card-variant-option ${variant.cls}`;
      btn.dataset.cardVariant = variant.key;
      btn.setAttribute('role', 'button');
      btn.setAttribute('tabindex', '0');
      btn.textContent = variant.label;

      const activate = event => {
        event.preventDefault();
        event.stopPropagation();
        toggleVariant(Number(card.dataset.catalogPokemon), variant, card);
      };
      btn.addEventListener('click', activate);
      btn.addEventListener('keydown', event => {
        if(event.key === 'Enter' || event.key === ' '){
          activate(event);
        }
      });
      controls.appendChild(btn);
    });

    card.appendChild(controls);
    syncVariantButtons(card);
  }

  function enhanceAll(){
    document.querySelectorAll('#roulettePicker [data-catalog-pokemon]').forEach(enhanceCard);
    const hint = document.querySelector('#roulette .catalog-hint');
    if(hint) hint.textContent = 'Clique em uma variante dentro de cada Pokémon para adicionar ou remover da roleta.';
  }

  function normalizeDeg(value){
    return ((value % 360) + 360) % 360;
  }

  function readRotateDeg(el){
    const match = el?.style?.transform?.match(/rotate\((-?[\d.]+)deg\)/i);
    return match ? Number(match[1]) : 0;
  }

  function installSpinSyncFix(){
    const spinButton = document.getElementById('spin');
    const wheel = document.getElementById('wheel');
    if(!spinButton || !wheel || typeof spinButton.onclick !== 'function') return;
    if(spinButton.dataset.pointerSyncFixed === '1') return;

    const originalSpin = spinButton.onclick;
    spinButton.dataset.pointerSyncFixed = '1';

    spinButton.onclick = function(event){
      const before = readRotateDeg(wheel);
      const entryCount = [...roulette].map(parseRouletteKey).filter(Boolean).length;

      originalSpin.call(this, event);

      if(entryCount < 1 || entryCount > 72) return;

      const rawAfter = readRotateDeg(wheel);
      if(!Number.isFinite(rawAfter) || rawAfter === before) return;

      const fullTurns = 360 * 7;
      const targetAngle = normalizeDeg(rawAfter - before - fullTurns);
      const currentAngle = normalizeDeg(before);
      const extraToTarget = normalizeDeg(targetAngle - currentAngle);
      const correctedAfter = before + fullTurns + extraToTarget;

      rotation = correctedAfter;
      wheel.style.transform = `rotate(${correctedAfter}deg)`;
    };
  }

  function start(){
    const picker = document.getElementById('roulettePicker');
    if(picker){
      enhanceAll();
      const observer = new MutationObserver(() => requestAnimationFrame(enhanceAll));
      observer.observe(picker, {childList:true, subtree:true});
    }
    installSpinSyncFix();
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
