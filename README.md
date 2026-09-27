const state = {
  products: [],
  cart: [],
  dashboard: null,
  lowStock: []
};

const productGrid = document.getElementById('product-grid');
const cartItems = document.getElementById('cart-items');
const searchInput = document.getElementById('search-input');
const customerNameInput = document.getElementById('customer-name');
const discountPercentInput = document.getElementById('discount-percent');
const paymentMethodSelect = document.getElementById('payment-method');
const checkoutButton = document.getElementById('checkout-button');

async function fetchProducts() {
  const res = await fetch('/api/products');
  const products = await res.json();
  state.products = products;
  renderProducts();
}

async function fetchDashboard() {
  const res = await fetch('/api/dashboard');
  state.dashboard = await res.json();

  document.getElementById('today-sales').textContent = formatCurrency(state.dashboard.totalSales || 0);
  document.getElementById('today-orders').textContent = state.dashboard.totalOrders || 0;
  document.getElementById('low-stock').textContent = state.dashboard.lowStock || 0;

  const lowStockList = document.getElementById('low-stock-list');
  lowStockList.innerHTML = '';

  if (!state.dashboard.recentOrders?.length) {
    lowStockList.innerHTML = '<li>No low stock items</li>';
    return;
  }

  state.dashboard.recentOrders.forEach((order) => {
    const li = document.createElement('li');
    li.textContent = `${order.orderNumber} • ${formatCurrency(order.total)}`;
    lowStockList.appendChild(li);
  });
}

async function fetchLowStock() {
  const res = await fetch('/api/stock/low');
  state.lowStock = await res.json();
  const lowStockList = document.getElementById('low-stock-list');
  lowStockList.innerHTML = '';

  if (!state.lowStock.length) {
    lowStockList.innerHTML = '<li>No low stock items</li>';
    return;
  }

  state.lowStock.forEach((product) => {
    const li = document.createElement('li');
    li.textContent = `${product.name} (${product.stock})`;
    lowStockList.appendChild(li);
  });
}

function renderProducts() {
  const value = searchInput.value.trim().toLowerCase();

  const filtered = state.products.filter((product) => {
    return (
      product.name.toLowerCase().includes(value) ||
      product.sku.toLowerCase().includes(value) ||
      (product.barcode || '').includes(value)
    );
  });

  productGrid.innerHTML = '';

  if (!filtered.length) {
    productGrid.innerHTML = '<div class="empty-state">No products found</div>';
    return;
  }

  filtered.forEach((product) => {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
      <h4>${product.name}</h4>
      <div class="product-meta">
        <span>${product.category}</span>
        <span>Stock: ${product.stock}</span>
      </div>
      <div class="product-meta">
        <strong>${formatCurrency(product.price)}</strong>
        <span>${product.sku}</span>
      </div>
      <button class="add-btn" data-id="${product.id}">Add to Cart</button>
    `;
    productGrid.appendChild(card);
  });

  productGrid.querySelectorAll('.add-btn').forEach((button) => {
    button.addEventListener('click', () => addToCart(button.dataset.id));
  });
}

function addToCart(productId) {
  const selected = state.products.find((product) => product.id === productId);
  if (!selected) return;

  const existing = state.cart.find((item) => item.productId === productId);
  if (existing) {
    existing.quantity += 1;
  } else {
    state.cart.push({ productId: selected.id, name: selected.name, quantity: 1, price: selected.price });
  }

  renderCart();
}

function renderCart() {
  cartItems.innerHTML = '';

  if (!state.cart.length) {
    cartItems.innerHTML = '<div class="empty-state">Your cart is empty</div>';
    updateTotals();
    return;
  }

  state.cart.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'cart-item';
    row.innerHTML = `
      <div class="cart-item-top">
        <strong>${item.name}</strong>
        <span>${formatCurrency(item.quantity * item.price)}</span>
      </div>
      <div class="cart-item-controls">
        <div class="qty-box">
          <button data-action="decrement" data-product-id="${item.productId}">-</button>
          <span>${item.quantity}</span>
          <button data-action="increment" data-product-id="${item.productId}">+</button>
        </div>
        <button class="remove-btn" data-product-id="${item.productId}">Remove</button>
      </div>
    `;
    cartItems.appendChild(row);
  });

  cartItems.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', () => handleQuantity(button));
  });

  cartItems.querySelectorAll('.remove-btn').forEach((button) => {
    button.addEventListener('click', () => removeFromCart(button.dataset.productId));
  });

  updateTotals();
}

function handleQuantity(button) {
  const productId = button.dataset.productId;
  const action = button.dataset.action;
  const item = state.cart.find((entry) => entry.productId === productId);

  if (!item) return;

  if (action === 'increment') item.quantity += 1;
  if (action === 'decrement') {
    item.quantity -= 1;
    if (item.quantity <= 0) {
      state.cart = state.cart.filter((entry) => entry.productId !== productId);
    }
  }

  renderCart();
}

function removeFromCart(productId) {
  state.cart = state.cart.filter((item) => item.productId !== productId);
  renderCart();
}

function updateTotals() {
  const subtotal = state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discountPercent = Number(discountPercentInput.value || 0);
  const discount = subtotal * (discountPercent / 100);
  const taxRate = 10;
  const tax = (subtotal - discount) * (taxRate / 100);
  const total = subtotal - discount + tax;

  document.getElementById('subtotal').textContent = formatCurrency(subtotal);
  document.getElementById('discount').textContent = formatCurrency(discount);
  document.getElementById('tax').textContent = formatCurrency(tax);
  document.getElementById('total').textContent = formatCurrency(total);
}

async function completeSale() {
  if (!state.cart.length) {
    alert('Cart is empty.');
    return;
  }

  const payload = {
    customerName: customerNameInput.value || 'Walk-in Customer',
    paymentMethod: paymentMethodSelect.value,
    discountRate: Number(discountPercentInput.value || 0),
    items: state.cart.map((item) => ({
      productId: item.productId,
      quantity: item.quantity
    }))
  };

  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || 'Unable to complete sale.');
    }

    state.cart = [];
    renderCart();
    await fetchProducts();
    await fetchDashboard();
    await fetchLowStock();
    alert(`Sale completed: ${data.orderNumber} | Total: ${formatCurrency(data.total)}`);
  } catch (error) {
    alert(error.message);
  }
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(value || 0);
}

searchInput.addEventListener('input', renderProducts);
discountPercentInput.addEventListener('input', updateTotals);
checkoutButton.addEventListener('click', completeSale);

(async function init() {
  await fetchProducts();
  await fetchDashboard();
  await fetchLowStock();
  renderCart();
})();
