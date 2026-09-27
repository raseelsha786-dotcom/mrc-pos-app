const state = {
  products: [],
  cart: [],
  dashboard: null,
  lowStock: [],
  authToken: localStorage.getItem('mrc-token') || '',
  userName: localStorage.getItem('mrc-user-name') || 'Admin'
};

const appShell = document.getElementById('app-shell');
const authModal = document.getElementById('auth-modal');
const loginButton = document.getElementById('login-button');
const logoutButton = document.getElementById('logout-button');
const productGrid = document.getElementById('product-grid');
const cartItems = document.getElementById('cart-items');
const searchInput = document.getElementById('search-input');
const customerNameInput = document.getElementById('customer-name');
const discountPercentInput = document.getElementById('discount-percent');
const paymentMethodSelect = document.getElementById('payment-method');
const checkoutButton = document.getElementById('checkout-button');
const inventoryList = document.getElementById('inventory-list');
const userNameDisplay = document.getElementById('user-name');

const tabButtons = document.querySelectorAll('.tab-button[data-tab]');
const views = {
  pos: document.getElementById('pos-view'),
  products: document.getElementById('products-view')
};

function setAuthState() {
  if (state.authToken) {
    authModal.classList.add('hidden');
    appShell.classList.remove('hidden');
    userNameDisplay.textContent = state.userName;
  } else {
    authModal.classList.remove('hidden');
    appShell.classList.add('hidden');
  }
}

async function login() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value.trim();

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Login failed.');

    state.authToken = data.token;
    state.userName = data.user.name || data.user.username;
    localStorage.setItem('mrc-token', data.token);
    localStorage.setItem('mrc-user-name', state.userName);
    setAuthState();
    await initDashboard();
  } catch (error) {
    alert(error.message);
  }
}

function logout() {
  state.authToken = '';
  localStorage.removeItem('mrc-token');
  localStorage.removeItem('mrc-user-name');
  state.userName = 'Admin';
  setAuthState();
}

async function fetchProducts() {
  const res = await fetch('/api/products', {
    headers: { Authorization: `Bearer ${state.authToken}` }
  });

  if (res.status === 401) {
    logout();
    return;
  }

  const products = await res.json();
  state.products = products;
  renderProducts();
  renderInventory();
}

async function fetchDashboard() {
  const res = await fetch('/api/dashboard', {
    headers: { Authorization: `Bearer ${state.authToken}` }
  });

  if (res.status === 401) {
    logout();
    return;
  }

  state.dashboard = await res.json();

  document.getElementById('today-sales').textContent = formatCurrency(state.dashboard.totalSales || 0);
  document.getElementById('today-orders').textContent = state.dashboard.totalOrders || 0;
  document.getElementById('low-stock').textContent = state.dashboard.lowStock || 0;

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

async function fetchLowStock() {
  const res = await fetch('/api/stock/low', {
    headers: { Authorization: `Bearer ${state.authToken}` }
  });

  if (res.status === 401) {
    logout();
    return;
  }

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

function renderInventory() {
  inventoryList.innerHTML = '';

  state.products.forEach((product) => {
    const item = document.createElement('div');
    item.className = 'inventory-item';
    item.innerHTML = `
      <div>
        <strong>${product.name}</strong><br />
        <small>${product.stock} in stock</small>
      </div>
      <div class="inventory-actions">
        <input type="number" data-id="${product.id}" value="0" min="-9999" max="9999" />
        <button class="small-btn" data-adjust="${product.id}">Adjust</button>
      </div>
    `;
    inventoryList.appendChild(item);
  });

  inventoryList.querySelectorAll('[data-adjust]').forEach((button) => {
    button.addEventListener('click', async () => {
      const input = inventoryList.querySelector(`input[data-id='${button.dataset.adjust}']`);
      const adjustment = Number(input.value || 0);
      if (!adjustment) return;

      try {
        const res = await fetch(`/api/products/${button.dataset.adjust}/stock-adjust`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${state.authToken}`
          },
          body: JSON.stringify({ adjustment })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Stock update failed');
        input.value = 0;
        await fetchProducts();
        await fetchDashboard();
        await fetchLowStock();
      } catch (error) {
        alert(error.message);
      }
    });
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
        <button class="small-btn" data-product-id="${item.productId}">Remove</button>
      </div>
    `;
    cartItems.appendChild(row);
  });

  cartItems.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', () => handleQuantity(button));
  });

  cartItems.querySelectorAll('[data-product-id]').forEach((button) => {
    if (button.classList.contains('small-btn')) {
      button.addEventListener('click', () => removeFromCart(button.dataset.productId));
    }
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
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.authToken}`
      },
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

async function handleProductSubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.target);
  const payload = Object.fromEntries(formData.entries());

  try {
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.authToken}`
      },
      body: JSON.stringify({
        ...payload,
        price: Number(payload.price),
        cost: Number(payload.cost || 0),
        taxRate: Number(payload.taxRate || 10),
        stock: Number(payload.stock || 0)
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Unable to save product');
    event.target.reset();
    await fetchProducts();
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

function setActiveTab(tab) {
  Object.entries(views).forEach(([key, view]) => {
    view.classList.toggle('hidden', key !== tab);
  });

  tabButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === tab);
  });
}

async function initDashboard() {
  if (!state.authToken) return;
  await fetchProducts();
  await fetchDashboard();
  await fetchLowStock();
  renderCart();
}

loginButton.addEventListener('click', login);
logoutButton.addEventListener('click', logout);
searchInput.addEventListener('input', renderProducts);
discountPercentInput.addEventListener('input', updateTotals);
checkoutButton.addEventListener('click', completeSale);
document.getElementById('product-form').addEventListener('submit', handleProductSubmit);
tabButtons.forEach((button) => {
  button.addEventListener('click', () => setActiveTab(button.dataset.tab));
});

setAuthState();
if (state.authToken) {
  initDashboard();
}

window.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !state.authToken) {
    login();
  }
});
