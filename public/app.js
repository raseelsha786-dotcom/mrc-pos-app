* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: Arial, sans-serif;
  background: #f3f6fb;
  color: #1f2937;
}

button, input, select {
  font: inherit;
}

.app-shell {
  display: grid;
  grid-template-columns: 260px 1fr 360px;
  height: 100vh;
}

.sidebar,
.cart-panel {
  background: #ffffff;
  border-right: 1px solid #e5e7eb;
  padding: 20px;
}

.sidebar {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.sidebar h1,
.cart-panel h2,
.main-area h2 {
  margin: 0 0 16px 0;
}

.stats-box {
  display: grid;
  gap: 12px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 16px;
}

.stats-box small {
  display: block;
  color: #6b7280;
  margin-bottom: 4px;
}

.panel {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 16px;
}

.list {
  list-style: none;
  padding: 0;
  margin: 10px 0 0;
  display: grid;
  gap: 8px;
}

.list li {
  font-size: 14px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 8px 10px;
}

.main-area {
  padding: 20px;
  overflow: auto;
}

.topbar {
  display: flex;
  justify-content: space-between;
  align-items: end;
  gap: 16px;
  margin-bottom: 24px;
}

.field-label {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  text-transform: uppercase;
  color: #6b7280;
}

input, select {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #fff;
}

.customer-box {
  min-width: 220px;
}

.product-section {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  padding: 18px;
}

.section-header {
  margin-bottom: 16px;
}

.product-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
}

.product-card {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.product-card h4 {
  margin: 0;
}

.product-meta {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  color: #4b5563;
}

.add-btn {
  background: #2563eb;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 10px 12px;
  cursor: pointer;
}

.cart-panel {
  border-left: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.cart-items {
  flex: 1;
  display: grid;
  gap: 12px;
  overflow: auto;
}

.cart-item {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 12px;
}

.cart-item-top,
.cart-item-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.qty-box {
  display: flex;
  align-items: center;
  gap: 8px;
}

.qty-box button {
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 50%;
  background: #e5e7eb;
  cursor: pointer;
}

.totals {
  display: grid;
  gap: 8px;
  border-top: 1px solid #e5e7eb;
  padding-top: 12px;
}

.totals > div {
  display: flex;
  justify-content: space-between;
}

.grand-total {
  font-size: 1.2rem;
  color: #111827;
}

.checkout-controls {
  display: grid;
  gap: 12px;
}

.primary-btn {
  background: #16a34a;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 12px;
  cursor: pointer;
  font-weight: 700;
}

.empty-state {
  color: #6b7280;
  font-size: 14px;
  text-align: center;
  padding: 16px 8px;
  background: #f9fafb;
  border: 1px dashed #d1d5db;
  border-radius: 8px;
}

@media (max-width: 1100px) {
  .app-shell {
    grid-template-columns: 1fr;
    height: auto;
  }

  .main-area,
  .sidebar,
  .cart-panel {
    border: none;
  }

  .topbar {
    flex-direction: column;
    align-items: stretch;
  }
}
