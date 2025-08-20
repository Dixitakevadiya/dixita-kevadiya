(function () {
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const $ = (sel, ctx = document) => ctx.querySelector(sel);

  let modal, modalDialog, modalCloseBtn, modalTitle, modalImage, modalDesc, modalPrice, customModaloptionsWrap, modalAddBtn;
  let activeProduct = null;          
  let activeVariantId = null;        
  let autoAddJacketHandle = null;    
  let focusTrapEls = [];

  // modal load init function when page load 
  function initModal() {
    modal = $('#product-modal');
    if (!modal) return;
    modalDialog = $('.modal_dialog', modal);
    modalCloseBtn = $('.modal_close', modal);
    modalTitle = $('.modal_title', modal);
    modalImage = $('.modal_image', modal);
    modalDesc = $('.js-modal-desc', modal);
    modalPrice = $('.js-modal-price', modal);
    customModaloptionsWrap = $('.js-modal-options', modal);
    modalAddBtn = $('.btn_text', modal);

    modalCloseBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal.classList.contains('modal--open')) closeModal(); });
  }

  function openModal() {
    modal.classList.add('modal--open');
    // focus trap
    focusTrapEls = $$('a, button, select, input, [tabindex]:not([tabindex="-1"])', modalDialog).filter(el => !el.disabled);
    document.querySelectorAll('.option-btn').forEach(btn => {
    const val = btn.getAttribute('data-option-value');
    btn.style.setProperty('--option-value', `${val}`);
  });
  modalAddBtn.textContent = 'Add to cart';
    if (focusTrapEls.length) focusTrapEls[0].focus();
    modal.addEventListener('keydown', trapTab);
  }
  function closeModal() {
    modal.classList.remove('modal--open');
    activeProduct = null;
    activeVariantId = null;
    modal.removeEventListener('keydown', trapTab);
  }
  function trapTab(e) {
    if (e.key !== 'Tab') return;
    const first = focusTrapEls[0], last = focusTrapEls[focusTrapEls.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  // ----- shopify store money -----
  const money = (cents, currency = (window.Shopify && Shopify.currency && Shopify.currency.active) || 'USD') => {
    const val = (cents || 0) / 100;
    try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(val); }
    catch { return `$${val.toFixed(2)}`; }
  };

  async function fetchJSON(url, opts) {
    const res = await fetch(url, opts);
    if (!res.ok) throw new Error(`Request failed ${res.status}`);
    return res.json();
  }

function buildOptions(product) {
  customModaloptionsWrap.innerHTML = '';
  if (!product.options || !product.variants) return;

  product.options.forEach((optName, idx) => {
    const group = document.createElement('div');
    group.className = 'option-group';
    if (optName.name.toLowerCase() === 'color') {
      // Render Color as buttons
      group.innerHTML = `<label>${optName.name}</label><div class="color-options"></div>`;
      const btnWrap = $('.color-options', group);
      const values = [...new Set(product.variants.map(v => v.options[idx]))];

      values.forEach(v => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'option-btn';
        btn.textContent = v;
        btn.dataset.optionValue = v;
        btn.dataset.optionIndex = idx;

        btn.addEventListener('click', () => {
          // clear active
          $$(`[data-option-index="${idx}"]`, group).forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          onOptionChange();
        });

        btnWrap.appendChild(btn);
      });
      customModaloptionsWrap.appendChild(group);
   } else {
      // Render other options as dropdown
      group.innerHTML = `
        <label>${optName.name}</label>
        <div class="select_wpr"><select data-option-index="${idx}"></select></div>
      `;
      const select = $('select', group);

      if (optName.name.toLowerCase() === 'size') {
        const placeholder = document.createElement('option');
        placeholder.value = "";
        placeholder.textContent = `Choose your ${optName.name}`;
        placeholder.disabled = true;
        placeholder.selected = true;
        select.appendChild(placeholder);
      }

      const values = [...new Set(product.variants.map(v => v.options[idx]))];
      values.forEach(v => {
        const option = document.createElement('option');
        option.value = v;
        option.textContent = v;
        select.appendChild(option);
      });

      select.addEventListener('change', onOptionChange);
      customModaloptionsWrap.appendChild(group);
    }

  });

  setVariantFromSelects(product);
}

  function onOptionChange() {
    let option_change = true;
    setVariantFromSelects(activeProduct, option_change);
  }

function setVariantFromSelects(product,option_change ) {
  const selectedValues = [];

  product.options.forEach((optName, idx) => {
    const btn = $(`.option-btn.active[data-option-index="${idx}"]`, customModaloptionsWrap);
    if (btn) {
      selectedValues.push(btn.dataset.optionValue);
    } else {
      const sel = $(`[data-option-index="${idx}"]`, customModaloptionsWrap);
      if (sel.value != '') selectedValues.push(sel.value);
    }
  });

  if (selectedValues.length === product.options.length) {
    const matchedVariant = product.variants.find(v =>
      v.options.every((opt, i) => opt === selectedValues[i])
    );
    return matchedVariant;
  } else {
    return null;
  }
  const variant_match = product.variants.find(v => v.options.every((val, i) => val === selectedValues[i]));
  if (variant_match) {
    activeVariantId = variant_match.id;
    modalPrice.textContent = money(variant_match.price);
    modalAddBtn.disabled = !variant_match.available;
    modalAddBtn.textContent = variant_match.available ? 'ADD TO CART' : 'Sold Out';
  } else {
    activeVariantId = null;
    modalPrice.textContent = money(product.price);
    modalAddBtn.disabled = true;
    modalAddBtn.textContent = 'Unavailable'; 
  }

  if(!option_change){
     modalAddBtn.textContent = 'Add to cart';
  }
}

  async function openProductPopupByHandle(handle, jacketHandleFromSection) {
    autoAddJacketHandle = jacketHandleFromSection || null;
    const product = await fetchJSON(`/products/${handle}.js`);
    activeProduct = product;
    console.log('product: ', product);
    
    modalTitle.textContent = product.title;
    const cleanDesc = product.description?.replace(/<[^>]*>?/gm, '').trim() || '';
    if(cleanDesc){
    const shortDesc = cleanDesc.split(' ').slice(0, 30).join(' ') + '...'; // ~3–4 lines
    modalDesc.textContent = shortDesc;
    }
    modalImage.innerHTML = product.images?.length
      ? `<img src="${product.images[0]}" alt="${product.title}">`
      : `<div style="aspect-ratio:1/1;"></div>`;
    modalPrice.textContent = money(product.price);
    buildOptions(product);

    modalAddBtn.onclick = onAddToCartClicked;
    openModal();
  }

    // Add to cart from grid popup
 async function onAddToCartClicked() {
  if (!activeProduct || !activeVariantId) return;
  const cartNotification = document.querySelector('cart-notification');

  let response = await fetchJSON('/cart/add.js?sections=cart-notification-product,cart-notification-button,cart-icon-bubble', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ id: activeVariantId, quantity: 1 })
  });

  //check gift condition
  const selects = $$('[data-option-index]', customModaloptionsWrap);
  const selected = selects.map(el => {
  if (el.tagName === 'SELECT') return el.value.toLowerCase();
  if (el.tagName === 'BUTTON' && el.classList.contains('active')) return el.dataset.optionValue.toLowerCase();
  return null;
  }).filter(Boolean);
  const hasBlack = selected.includes('black');
  const hasMedium = selected.includes('m');
  if (hasBlack && hasMedium && autoAddJacketHandle) {
    try {
      const jacket = await fetchJSON(`/products/${autoAddJacketHandle}.js`);
      const jacketVariant = jacket.variants.find(v => v.available) || jacket.variants[0];
      if (jacketVariant) {
        // 2. Add gift WITH SECTIONS so response includes both
        response = await fetchJSON('/cart/add.js?sections=cart-notification-product,cart-notification-button,cart-icon-bubble', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ id: jacketVariant.id, quantity: 1 })
        });
      }
    } catch (e) {
      console.warn('Auto-add jacket failed:', e);
    }
  }

    setTimeout(() => {
    closeModal();
    window.location.href = '/cart';
  }, 300);

}

  function initProductTiles() { 
  $$('.custom-grid').forEach(section => {
    const jacketHandle = section?.dataset?.autoAddJacketHandle || '';
    $$('.custom-product-grid', section).forEach(tile => {
      const handle = tile.getAttribute('data-handle');
      $$('.dot_pos', tile).forEach(dot => {
        dot.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation(); 
          if (handle) {
            openProductPopupByHandle(handle, jacketHandle);
          }
        });
      });
    });
  });
}

  document.addEventListener('DOMContentLoaded', () => {
    initModal();
    initProductTiles();
  });
})();