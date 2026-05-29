// =========================
// CONFIG
// =========================
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby8BfjMgQQcpBkouhgq3Exa7tKclTx_ii5rbw8a3dnJV3w7i3EiUNqvrRIb7wYtuaPt/exec';

const MENU_ITEMS = [
  { name: '닭곰탕', emoji: '🍲', price: 5 },
  { name: '떡볶이', emoji: '🌶️', price: 5 },
  { name: '밀크티', emoji: '🧋', price: 4 },
  { name: '밀크티 + 🍦', emoji: '🧋', price: 5 },
  { name: '팡팡 스파클링 에이드', emoji: '🥤', price: 3 },
  { name: '아메리카노', emoji: '☕', price: 3, subtitle: 'Ice / Hot' },
  { name: '베이커리 1팩', emoji: '🍪', price: 4, subtitle: '쿠키(5) / 크로아상 / 스콘' },
  { name: '베이커리 2팩', emoji: '🍪🍪', price: 7, cartEmoji: '<span style="display:inline-grid;line-height:1;position:relative;top:-2.5px">🍪<br>🍪</span>' },
];

const MEALKIT_ITEMS = [
  { name: '돈까스', emoji: '🐷', price: 25 },
  { name: '닭갈비', emoji: '🐔', price: 30 },
];

const EMOJI_MAP = {};
[...MENU_ITEMS, ...MEALKIT_ITEMS].forEach(item => { EMOJI_MAP[item.name] = item.cartEmoji || item.emoji; });

let cart = JSON.parse(sessionStorage.getItem('vision_cart') || '{}');
let currentOrderId = sessionStorage.getItem('vision_orderId') || generateOrderId();
let cashierName = localStorage.getItem('vision_cashier') || '';

function generateOrderId() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

function promptCashierName() {
  document.getElementById('cashier-input').value = cashierName;
  document.getElementById('cashier-save-btn').textContent = cashierName ? 'Save' : 'Start';
  document.getElementById('cashier-modal').classList.remove('hidden');
  document.getElementById('cashier-input').focus();
}

function saveCashierName() {
  const name = document.getElementById('cashier-input').value.trim();
  if (!name) return;
  const hasKorean = /[가-힣]/.test(name);
  const minLength = hasKorean ? 2 : 5;
  if (name.length < minLength) {
    alert(hasKorean ? '이름을 2자 이상 입력해주세요.' : 'Please enter at least 5 characters.');
    return;
  }
  cashierName = name;
  localStorage.setItem('vision_cashier', cashierName);
  document.getElementById('cashier-display').textContent = 'Cashier: ' + cashierName;
  document.getElementById('cashier-modal').classList.add('hidden');
}

function persistCart() {
  sessionStorage.setItem('vision_cart', JSON.stringify(cart));
  sessionStorage.setItem('vision_orderId', currentOrderId);
}

// =========================
// RENDER MENU
// =========================
function renderMenu() {
  const grid = document.getElementById('menu-grid');
  grid.innerHTML = MENU_ITEMS.map(item => `
    <button onclick="addToCart('${item.name}', ${item.price}, this)" class="menu-btn relative">
      <div class="price absolute top-3 right-3">$${item.price}</div>
      <div class="text-3xl mb-2">${item.emoji}</div>
      <div class="font-bold text-slate-900">${item.name}</div>
      ${item.subtitle ? `<div class="text-xs text-slate-400 mt-1">${item.subtitle}</div>` : ''}
    </button>
  `).join('');

  const mealkitGrid = document.getElementById('mealkit-grid');
  mealkitGrid.innerHTML = MEALKIT_ITEMS.map(item => `
    <button onclick="addToCart('${item.name}', ${item.price}, this)" class="menu-btn relative">
      <div class="price absolute top-3 right-3">$${item.price}</div>
      <div class="text-3xl mb-2">${item.emoji}</div>
      <div class="font-bold text-slate-900">${item.name}</div>
    </button>
  `).join('');
}

// =========================
// CART
// =========================
function addToCart(name, price, btnEl) {
  if (cart[name]) {
    cart[name].qty += 1;
  } else {
    cart[name] = { price, qty: 1 };
  }
  const wasCollapsed = cartState === 'collapsed';
  const wasEmpty = Object.keys(cart).length === 1 && cart[name].qty === 1;
  if (wasEmpty && wasCollapsed) {
    cartState = 'normal';
  }
  updateUI();
  if (cartState === 'normal') {
    snapToContent();
  }
  if (btnEl) {
    requestAnimationFrame(() => {
      const rect = btnEl.getBoundingClientRect();
      const headerBottom = document.querySelector('header').offsetHeight;
      const cartTop = window.innerHeight - lastSnapTarget;
      if (rect.bottom > cartTop) {
        window.scrollBy({ top: rect.bottom - cartTop + 16, behavior: 'smooth' });
      } else if (rect.top < headerBottom) {
        window.scrollBy({ top: rect.top - headerBottom - 16, behavior: 'smooth' });
      }
    });
  }
}

let animating = false;

function decreaseItem(name) {
  if (!cart[name]) return;
  if (animating) return;
  const wasRemoved = cart[name].qty === 1;

  if (wasRemoved) {
    animating = true;
    const items = document.getElementById('cart-items');
    const itemEl = [...items.children].find(el => el.textContent.includes(name));
    if (itemEl) {
      const section = document.getElementById('cart-section');
      const currentH = section.offsetHeight;
      const itemPrice = cart[name].price;

      // Pre-calculate target height without this item
      itemEl.style.display = 'none';
      delete cart[name];
      // Hide discount row if it would disappear
      const discountEl = [...items.children].find(el => el.textContent.includes('밀키트 세트 할인'));
      const discountWillDisappear = discountEl && getDiscount() === 0;
      if (discountWillDisappear) discountEl.style.display = 'none';
      const targetContentH = getContentHeight();
      cart[name] = { price: itemPrice, qty: 1 };
      itemEl.style.display = '';
      if (discountWillDisappear) discountEl.style.display = '';

      let targetH;
      if (Object.keys(cart).length <= 1) {
        targetH = Math.min(targetContentH, NORMAL_HEIGHT);
      } else if (currentH > NORMAL_HEIGHT) {
        targetH = Math.max(Math.min(targetContentH, getFullHeight()), NORMAL_HEIGHT);
      } else {
        targetH = Math.min(targetContentH, NORMAL_HEIGHT);
      }

      // Animate item collapse + cart resize at the same time
      const h = itemEl.offsetHeight;
      itemEl.style.transition = 'opacity 0.15s ease, height 0.3s ease, margin 0.3s ease, padding 0.3s ease';
      itemEl.style.opacity = '0';
      itemEl.style.height = h + 'px';
      itemEl.style.overflow = 'hidden';
      section.style.transition = 'height 0.3s cubic-bezier(0.32, 0.72, 0, 1)';
      requestAnimationFrame(() => {
        itemEl.style.height = '0px';
        itemEl.style.marginTop = '0px';
        itemEl.style.marginBottom = '0px';
        itemEl.style.paddingTop = '0px';
        itemEl.style.paddingBottom = '0px';
        section.style.height = targetH + 'px';
      });
      setTimeout(() => {
        delete cart[name];
        section.style.transition = '';
        updateUI();
        if (Object.keys(cart).length === 0) {
          cartState = 'normal';
        }
        lastSnapTarget = targetH;
        requestAnimationFrame(updateBottomPadding);
        animating = false;
      }, 320);
      return;
    }
  }

  cart[name].qty -= 1;
  const section = document.getElementById('cart-section');
  const wasAboveNormal = section.offsetHeight > NORMAL_HEIGHT;
  updateUI();
  if (!wasAboveNormal && cartState === 'normal') {
    snapToContent();
  }
}

function clearCart() {
  cart = {};
  if (cartState === 'full') {
    cartState = 'normal';
  }
  updateUI();
  if (cartState !== 'collapsed') {
    snapToContent();
  }
}

function getDiscount() {
  if (cart['돈까스'] && cart['닭갈비']) {
    return Math.min(cart['돈까스'].qty, cart['닭갈비'].qty) * 5;
  }
  return 0;
}

function getTotal() {
  const subtotal = Object.values(cart).reduce((sum, item) => sum + item.price * item.qty, 0);
  return subtotal - getDiscount();
}

// =========================
// UI — Drawer drag system
// =========================
let cartState = 'collapsed';

const COLLAPSED_HEIGHT = 70;
const NORMAL_HEIGHT = 280;

function getViewportHeight() {
  return (window.visualViewport ? window.visualViewport.height : window.innerHeight);
}

function getFullHeight() {
  return Math.round(getViewportHeight() * 0.85);
}

function getContentHeight() {
  const section = document.getElementById('cart-section');
  const details = document.getElementById('cart-details');
  const items = document.getElementById('cart-items');
  const prevHeight = section.style.height;
  const wasHidden = details.classList.contains('hidden');
  const prevOverflow = items.style.overflow;
  details.classList.remove('hidden');
  items.style.overflow = 'visible';
  section.style.height = 'auto';
  const h = section.scrollHeight;
  section.style.height = prevHeight;
  items.style.overflow = prevOverflow;
  if (wasHidden) details.classList.add('hidden');
  return h;
}

function cartNeedsFullMode() {
  const itemCount = Object.keys(cart).length + (getDiscount() > 0 ? 1 : 0);
  return itemCount > 2;
}

function getSnapPoints() {
  const isEmpty = Object.keys(cart).length === 0;
  if (isEmpty) return [COLLAPSED_HEIGHT];
  const contentH = getContentHeight();
  if (cartNeedsFullMode()) {
    return [COLLAPSED_HEIGHT, Math.min(contentH, NORMAL_HEIGHT), Math.min(contentH, getFullHeight())];
  }
  return [COLLAPSED_HEIGHT, Math.min(contentH, NORMAL_HEIGHT)];
}

function snapToNearest(height) {
  const points = getSnapPoints();
  let closest = points[0];
  let minDist = Math.abs(height - points[0]);
  for (let i = 1; i < points.length; i++) {
    const dist = Math.abs(height - points[i]);
    if (dist < minDist) {
      minDist = dist;
      closest = points[i];
    }
  }
  return closest;
}

function setCartHeight(h) {
  const section = document.getElementById('cart-section');
  const details = document.getElementById('cart-details');
  section.style.height = h + 'px';
  if (h <= COLLAPSED_HEIGHT) {
    cartState = 'collapsed';
  } else {
    details.classList.remove('hidden');
    cartState = h >= (NORMAL_HEIGHT + getFullHeight()) / 2 ? 'full' : 'normal';
  }
}

let hideListener = null;

function snapCart(targetHeight) {
  const section = document.getElementById('cart-section');
  const details = document.getElementById('cart-details');
  if (hideListener) {
    section.removeEventListener('transitionend', hideListener);
    hideListener = null;
  }
  lastSnapTarget = targetHeight;
  const currentH = section.offsetHeight;
  section.classList.remove('dragging');
  section.offsetHeight;
  setCartHeight(targetHeight);
  if (targetHeight <= COLLAPSED_HEIGHT) {
    if (Math.abs(currentH - targetHeight) < 2) {
      details.classList.add('hidden');
    } else {
      hideListener = function() {
        section.removeEventListener('transitionend', hideListener);
        hideListener = null;
        if (cartState === 'collapsed') {
          details.classList.add('hidden');
        }
      };
      section.addEventListener('transitionend', hideListener);
    }
  }
  requestAnimationFrame(updateBottomPadding);
}

// Drag handling
let dragStartY = 0;
let dragStartHeight = 0;
let dragMaxHeight = 0;
let isDragging = false;

function onDragStart(e) {
  if (confirmMode) { e.preventDefault(); return; }
  const isEmpty = Object.keys(cart).length === 0;
  if (isEmpty) {
    if (cartState === 'collapsed') {
      snapToContent();
    } else {
      snapCart(COLLAPSED_HEIGHT);
    }
    e.preventDefault();
    return;
  }
  const section = document.getElementById('cart-section');
  section.classList.add('dragging');
  isDragging = true;
  dragStartY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
  dragStartHeight = section.offsetHeight;
  dragMaxHeight = cartNeedsFullMode() ? Math.min(getContentHeight(), getFullHeight()) : Math.min(getContentHeight(), NORMAL_HEIGHT);
  e.preventDefault();
}

function onDragMove(e) {
  if (!isDragging) return;
  const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
  const delta = dragStartY - clientY;
  const newHeight = Math.max(COLLAPSED_HEIGHT, Math.min(dragMaxHeight, dragStartHeight + delta));
  const section = document.getElementById('cart-section');
  section.style.height = newHeight + 'px';
}

function onDragEnd() {
  if (!isDragging) return;
  isDragging = false;
  const section = document.getElementById('cart-section');
  const currentHeight = section.offsetHeight;
  const target = snapToNearest(currentHeight);
  snapCart(target);
}

function initDrag() {
  const handle = document.getElementById('cart-handle');
  handle.addEventListener('mousedown', onDragStart);
  handle.addEventListener('touchstart', onDragStart, { passive: false });
  document.addEventListener('mousemove', onDragMove);
  document.addEventListener('touchmove', onDragMove, { passive: false });
  document.addEventListener('mouseup', onDragEnd);
  document.addEventListener('touchend', onDragEnd);
}

function snapToContent() {
  const section = document.getElementById('cart-section');
  const currentH = section.offsetHeight;
  section.classList.add('dragging');
  const h = Math.min(getContentHeight() + 4, NORMAL_HEIGHT);
  const target = Math.max(h, COLLAPSED_HEIGHT);
  section.style.height = currentH + 'px';
  section.offsetHeight;
  section.classList.remove('dragging');
  snapCart(target);
}


function updateUI() {
  const cartItems = document.getElementById('cart-items');
  const totalEl = document.getElementById('cart-total');
  const orderEl = document.getElementById('order-number');
  const badge = document.getElementById('cart-badge');

  orderEl.innerText = `#${currentOrderId}`;
  const total = getTotal();
  const itemCount = Object.values(cart).reduce((sum, item) => sum + item.qty, 0);

  if (itemCount > 0) {
    badge.textContent = itemCount;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }

  if (total === 0) {
    cartItems.innerHTML = '<div class="text-center text-slate-400 italic py-2">Cart is empty</div>';
  } else {
    let html = Object.entries(cart).map(([name, item]) => `
      <div class="flex justify-between items-center bg-slate-50 rounded-xl px-3 py-2">
        <div class="flex items-center gap-2">
          <span class="w-8 text-center text-lg shrink-0">${EMOJI_MAP[name] || ''}</span>
          <div>
            <div class="font-bold text-slate-900 text-sm">${name}</div>
            <div class="text-xs text-slate-400">$${item.price} x ${item.qty} = $${item.price * item.qty}</div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button onclick="decreaseItem('${name}')" class="qty-btn bg-red-100 text-red-600">&minus;</button>
          <div class="font-black text-lg w-6 text-center">${item.qty}</div>
          <button onclick="addToCart('${name}', ${item.price})" class="qty-btn bg-blue-100 text-blue-700">+</button>
        </div>
      </div>
    `).join('');

    const discount = getDiscount();
    if (discount > 0) {
      html += `
        <div class="flex justify-between items-center bg-green-50 rounded-xl px-3 py-2 border border-green-200">
          <div class="font-bold text-green-700 text-sm">밀키트 세트 할인</div>
          <div class="font-black text-green-700">-$${discount}</div>
        </div>
      `;
    }
    cartItems.innerHTML = html;
  }

  totalEl.innerText = `$${total}`;
  persistCart();

  requestAnimationFrame(updateBottomPadding);
}

// =========================
// QR MODAL
// =========================
function showQR() {
  document.getElementById('qr-section').classList.remove('hidden');
}

function hideQR() {
  document.getElementById('qr-section').classList.add('hidden');
}

// =========================
// TOAST
// =========================
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2200);
}

// =========================
// PAYMENT
// =========================

let submitting = false;
let pendingMethod = '';
let confirmMode = false;

function enterConfirmMode(method) {
  const total = getTotal();
  if (total === 0) return;
  pendingMethod = method;
  confirmMode = true;

  document.getElementById('payment-buttons').classList.add('hidden');
  document.getElementById('confirm-buttons').classList.remove('hidden');

  const submitBtn = document.getElementById('confirm-submit-btn');
  submitBtn.textContent = `Submit ${method} Order`;
  submitBtn.className = `flex-1 py-4 rounded-2xl font-black text-base shadow-lg active:scale-95 transition text-white ${method === 'Zelle' ? 'bg-green-600' : 'bg-slate-800'}`;

  const totalEl = document.getElementById('cart-total');
  totalEl.classList.add('bg-yellow-200');

  renderCartConfirmation();

  document.getElementById('confirm-overlay').classList.remove('hidden');

  cartState = 'full';
  const contentH = Math.min(getContentHeight() + 4, getFullHeight());
  snapCart(contentH);
}

function exitConfirmMode() {
  confirmMode = false;
  pendingMethod = '';
  document.getElementById('payment-buttons').classList.remove('hidden');
  document.getElementById('confirm-buttons').classList.add('hidden');
  document.getElementById('cart-total').classList.remove('bg-yellow-200');
  document.getElementById('confirm-overlay').classList.add('hidden');
  updateUI();
}

function renderCartConfirmation() {
  const cartItems = document.getElementById('cart-items');
  let html = Object.entries(cart).map(([name, item]) => `
    <div class="flex justify-between items-center bg-slate-50 rounded-xl px-3 py-2" style="min-height: 54px;">
      <div class="flex items-center gap-2">
        <span class="w-8 text-center text-lg shrink-0">${EMOJI_MAP[name] || ''}</span>
        <div>
          <div class="font-bold text-slate-900 text-sm">${name}</div>
          <div class="text-xs text-slate-400">$${item.price} x ${item.qty} = $${item.price * item.qty}</div>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <div class="w-[38px]"></div>
        <div class="font-black text-lg w-6 text-center">${item.qty}</div>
        <div class="w-[38px]"></div>
      </div>
    </div>
  `).join('');

  const discount = getDiscount();
  if (discount > 0) {
    html += `
      <div class="flex justify-between items-center bg-green-50 rounded-xl px-3 py-2 border border-green-200">
        <div class="font-bold text-green-700 text-sm">밀키트 세트 할인</div>
        <div class="font-black text-green-700">-$${discount}</div>
      </div>
    `;
  }
  cartItems.innerHTML = html;
}

function confirmPayment(method) {
  const total = getTotal();
  if (total === 0 || submitting) return;
  submitting = true;

  const items = Object.entries(cart).map(([name, item]) => `${item.qty}x ${name}`);
  const quantities = {};
  Object.entries(cart).forEach(([name, item]) => {
    quantities[name] = item.qty;
  });

  const discount = getDiscount();
  const orderData = {
    timestamp: new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
    orderNumber: currentOrderId,
    cashier: cashierName,
    paymentMethod: method,
    items: items.join(', '),
    total: total,
    quantities: quantities,
    discount: discount || ''
  };

  const history = JSON.parse(localStorage.getItem('vision_orders') || '[]');
  history.unshift(orderData);
  localStorage.setItem('vision_orders', JSON.stringify(history));

  navigator.sendBeacon(GOOGLE_SCRIPT_URL, JSON.stringify(orderData));

  showToast(`#${currentOrderId} - $${total} (${method})`);

  currentOrderId = generateOrderId();
  confirmMode = false;
  pendingMethod = '';
  document.getElementById('cart-total').classList.remove('bg-yellow-200');
  document.getElementById('payment-buttons').classList.remove('hidden');
  document.getElementById('confirm-buttons').classList.add('hidden');
  document.getElementById('confirm-overlay').classList.add('hidden');
  cart = {};
  updateUI();
  snapCart(COLLAPSED_HEIGHT);
  submitting = false;
}

// =========================
// BOTTOM PADDING
// =========================
let lastSnapTarget = COLLAPSED_HEIGHT;

function updateBottomPadding() {
  const padding = cartState === 'collapsed' ? COLLAPSED_HEIGHT + 16 : Math.min(lastSnapTarget, NORMAL_HEIGHT) + 16;
  document.body.style.paddingBottom = padding + 'px';
}

// INIT
renderMenu();
updateUI();
initDrag();
if (Object.keys(cart).length > 0) {
  snapToContent();
} else {
  snapCart(COLLAPSED_HEIGHT);
}
if (cashierName) {
  document.getElementById('cashier-display').textContent = 'Cashier: ' + cashierName;
} else {
  promptCashierName();
}
window.addEventListener('resize', () => {
  updateBottomPadding();
});
