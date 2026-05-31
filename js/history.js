const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby8BfjMgQQcpBkouhgq3Exa7tKclTx_ii5rbw8a3dnJV3w7i3EiUNqvrRIb7wYtuaPt/exec';

const MENU_PRICES = {
  '닭곰탕': 5, '떡볶이': 5, '밀크티': 4, '밀크티 + 🍦': 5,
  '팡팡 스파클링 에이드': 3, '아메리카노': 3,
  '베이커리 1팩': 4, '베이커리 2팩': 7, '돈까스': 25, '닭갈비': 30
};

let currentFilter = 'all';
let selectedItems = new Set();
let editingIndex = -1;
let editCart = {};

function getOrders() {
  return JSON.parse(localStorage.getItem('vision_orders') || '[]');
}

function saveOrders(orders) {
  localStorage.setItem('vision_orders', JSON.stringify(orders));
}

async function clearHistory() {
  const confirmed = await showConfirmModal('정말 주문 내역을 삭제하시겠습니까?\nClear all local order history?');
  if (!confirmed) return;
  const doubleConfirmed = await showConfirmModal('되돌릴 수 없습니다.\n정말 하시겠습니까?\nThis cannot be undone.\nAre you sure?');
  if (!doubleConfirmed) return;
  localStorage.removeItem('vision_orders');
  render();
}

function toggleItemFilterPanel() {
  document.getElementById('item-filter-panel').classList.toggle('hidden');
  updateFilterToggleStyle();
}

function toggleItemFilter(name) {
  if (selectedItems.has(name)) {
    selectedItems.delete(name);
  } else {
    selectedItems.add(name);
  }
  updateFilterToggleStyle();
  renderItemFilter();
  render();
}

function updateFilterToggleStyle() {
  const btn = document.getElementById('item-filter-toggle');
  const panel = document.getElementById('item-filter-panel');
  const isOpen = !panel.classList.contains('hidden');
  const hasFilters = selectedItems.size > 0;
  let style;
  if (isOpen) {
    style = 'bg-blue-900/10 ring-[3px] ring-inset ring-blue-900';
  } else if (hasFilters) {
    style = 'bg-white ring-[3px] ring-inset ring-blue-900';
  } else {
    style = 'bg-white border border-slate-200';
  }
  btn.className = `w-9 h-9 rounded-full text-sm font-bold active:scale-95 transition flex items-center justify-center ${style}`;
}

function selectAllItems() {
  Object.keys(MENU_PRICES).forEach(name => selectedItems.add(name));
  updateFilterToggleStyle();
  renderItemFilter();
  render();
}

function clearAllItems() {
  selectedItems.clear();
  updateFilterToggleStyle();
  renderItemFilter();
  render();
}

function filterOrders(filter) {
  currentFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(btn => {
    const text = btn.textContent.trim();
    const match = (filter === 'all' && text === 'All') || text === filter;
    btn.className = 'filter-btn px-4 py-2 rounded-full text-sm font-bold ' +
      (match ? 'bg-blue-900 text-white' : 'bg-white text-slate-700 border');
  });
  render();
}

function formatTime(isoString) {
  const d = new Date(isoString);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
}

function getRemovedItems(previousItemsStr, newCart) {
  const oldCart = {};
  previousItemsStr.split(', ').forEach(part => {
    const match = part.match(/^(\d+)x (.+)$/);
    if (match) oldCart[match[2]] = parseInt(match[1]);
  });
  const removed = [];
  for (const [name, oldQty] of Object.entries(oldCart)) {
    const newQty = newCart[name] ? newCart[name].qty : 0;
    if (oldQty > newQty) {
      removed.push({ name, qty: oldQty - newQty });
    }
  }
  return removed;
}

let confirmModalCallback = null;

function showConfirmModal(message) {
  document.getElementById('confirm-message').innerHTML = message.replace(/\n/g, '<br>');
  document.getElementById('confirm-modal').classList.remove('hidden');
  return new Promise(resolve => { confirmModalCallback = resolve; });
}

function confirmModalResolve(result) {
  document.getElementById('confirm-modal').classList.add('hidden');
  if (confirmModalCallback) {
    confirmModalCallback(result);
    confirmModalCallback = null;
  }
}

async function cancelOrder(index) {
  const confirmed = await showConfirmModal('Cancel this order?');
  if (!confirmed) return;
  const orders = getOrders();
  const order = orders[index];
  if (!order.history) order.history = [];
  order.history.push({
    action: 'cancelled',
    timestamp: new Date().toISOString(),
    previousItems: order.items,
    previousTotal: order.total
  });
  order.status = 'cancelled';
  order.total = 0;
  saveOrders(orders);
  syncToSheets({ ...order, action: 'cancel' });
  render();
}

function openEditModal(index) {
  editingIndex = index;
  const orders = getOrders();
  const order = orders[index];
  editCart = parseItems(order.items);
  renderEditModal();
  document.getElementById('edit-modal').classList.remove('hidden');
  document.getElementById('edit-order-id').textContent = '#' + order.orderNumber;
}

function closeEditModal() {
  document.getElementById('edit-modal').classList.add('hidden');
  editingIndex = -1;
}

function parseItems(itemString) {
  const cart = {};
  itemString.split(', ').forEach(part => {
    const match = part.match(/^(\d+)x (.+)$/);
    if (match) {
      const qty = parseInt(match[1]);
      const name = match[2];
      cart[name] = { qty, price: MENU_PRICES[name] || 0 };
    }
  });
  return cart;
}

function getEditDiscount() {
  if (editCart['돈까스'] && editCart['닭갈비']) {
    return Math.min(editCart['돈까스'].qty, editCart['닭갈비'].qty) * 5;
  }
  return 0;
}

function getEditTotal() {
  const subtotal = Object.values(editCart).reduce((sum, item) => sum + item.price * item.qty, 0);
  return subtotal - getEditDiscount();
}

function editDecrease(name) {
  if (!editCart[name]) return;
  editCart[name].qty -= 1;
  if (editCart[name].qty <= 0) delete editCart[name];
  renderEditModal();
}

function renderEditModal() {
  const container = document.getElementById('edit-items');
  if (Object.keys(editCart).length === 0) {
    container.innerHTML = '<div class="text-center text-slate-400 italic py-2">No items</div>';
  } else {
    container.innerHTML = Object.entries(editCart).map(([name, item]) => `
      <div class="flex justify-between items-center bg-slate-50 rounded-xl px-3 py-2">
        <div>
          <div class="font-bold text-slate-900 text-sm">${name}</div>
          <div class="text-xs text-slate-400">$${item.price} x ${item.qty} = $${item.price * item.qty}</div>
        </div>
        <div class="flex items-center gap-2">
          <button onclick="editDecrease('${name}')" class="w-8 h-8 rounded-full bg-red-100 text-red-600 font-black flex items-center justify-center">&minus;</button>
          <div class="font-black text-lg w-6 text-center">${item.qty}</div>
        </div>
      </div>
    `).join('');
  }
  document.getElementById('edit-total').textContent = `$${getEditTotal()}`;
}

function saveEdit() {
  const orders = getOrders();
  const order = orders[editingIndex];
  const newItems = Object.entries(editCart).map(([name, item]) => `${item.qty}x ${name}`).join(', ');
  const newTotal = getEditTotal();

  if (!order.history) order.history = [];

  if (Object.keys(editCart).length === 0) {
    order.history.push({
      action: 'cancelled',
      timestamp: new Date().toISOString(),
      previousItems: order.items,
      previousTotal: order.total
    });
    order.items = '';
    order.total = 0;
    order.status = 'cancelled';
    saveOrders(orders);
    syncToSheets({ ...order, action: 'cancel' });
  } else {
    const removed = getRemovedItems(order.items, editCart);
    if (removed.length === 0) {
      closeEditModal();
      return;
    }
    const remaining = {};
    removed.forEach(r => {
      if (editCart[r.name]) remaining[r.name] = editCart[r.name].qty;
    });
    order.history.push({
      action: 'removed',
      timestamp: new Date().toISOString(),
      removed: removed,
      remaining: remaining
    });
    const quantities = {};
    Object.entries(editCart).forEach(([name, item]) => {
      quantities[name] = item.qty;
    });
    const discount = (editCart['돈까스'] && editCart['닭갈비']) ? Math.min(editCart['돈까스'].qty, editCart['닭갈비'].qty) * 5 : 0;
    order.items = newItems;
    order.total = newTotal;
    saveOrders(orders);
    syncToSheets({ ...order, action: 'update', quantities: quantities, discount: discount || '' });
  }

  closeEditModal();
  render();
}

function syncToSheets(data) {
  navigator.sendBeacon(GOOGLE_SCRIPT_URL, JSON.stringify(data));
}

function renderItemFilter() {
  const container = document.getElementById('item-filter');
  const items = Object.keys(MENU_PRICES);
  container.innerHTML = items.map(name => {
    const active = selectedItems.has(name);
    return `<button onclick="toggleItemFilter('${name}')" class="px-3 py-1.5 rounded-lg text-xs font-bold active:scale-95 transition ${active ? 'bg-blue-900 text-white' : 'bg-white text-slate-700 border border-slate-200'}">${name}</button>`;
  }).join('');
}

function render() {
  const orders = getOrders();
  let filtered;
  if (currentFilter === 'Cancelled') {
    filtered = orders.filter(o => o.status === 'cancelled');
  } else if (currentFilter === 'all') {
    filtered = orders;
  } else {
    filtered = orders.filter(o => o.paymentMethod === currentFilter && o.status !== 'cancelled');
  }

  if (selectedItems.size > 0) {
    filtered = filtered.filter(o => {
      if (!o.items) return false;
      return [...selectedItems].every(item => o.items.includes(item));
    });
  }

  // Summary (exclude cancelled)
  const activeOrders = orders.filter(o => o.status !== 'cancelled');
  const totalSales = activeOrders.reduce((sum, o) => sum + o.total, 0);
  const zelleCount = activeOrders.filter(o => o.paymentMethod === 'Zelle').length;
  const cashCount = activeOrders.filter(o => o.paymentMethod === 'Cash').length;

  document.getElementById('total-orders').textContent = activeOrders.length;
  document.getElementById('total-sales').textContent = `$${totalSales}`;
  document.getElementById('payment-split').textContent = `${zelleCount} / ${cashCount}`;

  // List
  const list = document.getElementById('order-list');
  const empty = document.getElementById('empty-state');

  if (filtered.length === 0) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  list.innerHTML = filtered.map((order, i) => {
    const realIndex = orders.indexOf(order);
    const isCancelled = order.status === 'cancelled';
    const historyHtml = order.history && order.history.length > 0
      ? `<div class="mt-2 pt-2 border-t border-slate-100 space-y-1">
          ${order.history.map(h => {
            if (h.action === 'removed') {
              const parts = h.removed.map(r => {
                const remaining = (h.remaining && h.remaining[r.name]) || 0;
                let str = `<span class="line-through">${r.qty}x ${r.name}</span>`;
                if (remaining > 0) str += `, ${remaining}x ${r.name}`;
                return str;
              }).join(', ');
              return `<div class="text-xs text-slate-400"><span class="font-bold text-blue-400">updated</span> ${formatTime(h.timestamp)} — ${parts}</div>`;
            } else if (h.action === 'cancelled') {
              return `<div class="text-xs text-slate-400"><span class="font-bold text-red-400">cancelled</span> ${formatTime(h.timestamp)} — was: ${h.previousItems} ($${h.previousTotal})</div>`;
            }
            return '';
          }).join('')}
        </div>`
      : '';

    return `
      <div class="bg-white rounded-2xl p-4 shadow-sm border ${isCancelled ? 'border-red-200 opacity-60' : 'border-slate-200'}">
        <div class="flex justify-between items-start mb-2">
          <div>
            <div class="font-black text-slate-900">#${order.orderNumber}${isCancelled ? ' <span class="text-red-500 text-xs font-bold">CANCELLED</span>' : ''}</div>
            <div class="text-xs text-slate-400">${formatTime(order.timestamp)}</div>
          </div>
          <div class="flex items-center gap-2">
            <span class="px-2 py-1 rounded-full text-xs font-bold ${
              order.paymentMethod === 'Zelle' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'
            }">${order.paymentMethod}</span>
            <span class="font-black text-blue-900 text-lg">$${order.total}</span>
          </div>
        </div>
        <div class="text-sm text-slate-600">${order.items || '<span class="italic text-slate-400">No items</span>'}</div>
        ${historyHtml}
        ${!isCancelled ? `
          <div class="mt-2 flex justify-between text-xs">
            <button onclick="openEditModal(${realIndex})" class="text-blue-600 font-bold py-1 active:opacity-50">Edit</button>
            <button onclick="cancelOrder(${realIndex})" class="text-slate-400 font-bold py-1 active:opacity-50">Cancel</button>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

renderItemFilter();
render();
