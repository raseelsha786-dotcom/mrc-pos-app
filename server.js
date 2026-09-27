const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'data', 'db.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function readDb() {
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    return { settings: { storeName: 'MRC Market', currency: 'USD', taxRate: 10, discountRate: 0, receiptFooter: 'Thank you for shopping with MRC Market' }, products: [], orders: [] };
  }
}

function writeDb(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function calculateOrderTotals(items, taxRate, discountRate) {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discount = subtotal * (discountRate / 100);
  const tax = (subtotal - discount) * (taxRate / 100);
  const total = subtotal - discount + tax;

  return {
    subtotal: Number(subtotal.toFixed(2)),
    tax: Number(tax.toFixed(2)),
    discount: Number(discount.toFixed(2)),
    total: Number(total.toFixed(2))
  };
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'MRC POS backend is running' });
});

app.get('/api/settings', (req, res) => {
  const db = readDb();
  res.json(db.settings);
});

app.put('/api/settings', (req, res) => {
  const db = readDb();
  db.settings = { ...db.settings, ...req.body };
  writeDb(db);
  res.json(db.settings);
});

app.get('/api/products', (req, res) => {
  const db = readDb();
  res.json(db.products.filter((p) => p.active !== false));
});

app.post('/api/products', (req, res) => {
  const db = readDb();
  const { name, sku, barcode, category, price, cost, taxRate = 10, stock = 0 } = req.body;

  if (!name || !price) {
    return res.status(400).json({ message: 'Product name and price are required.' });
  }

  const newProduct = {
    id: `prod-${uuidv4()}`,
    name,
    sku: sku || `SKU-${Date.now()}`,
    barcode: barcode || '',
    category: category || 'General',
    price: Number(price),
    cost: Number(cost || 0),
    taxRate: Number(taxRate),
    stock: Number(stock),
    active: true,
    createdAt: new Date().toISOString()
  };

  db.products.push(newProduct);
  writeDb(db);
  res.status(201).json(newProduct);
});

app.get('/api/orders', (req, res) => {
  const db = readDb();
  res.json(db.orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

app.post('/api/orders', (req, res) => {
  const db = readDb();
  const { customerName = 'Walk-in Customer', paymentMethod = 'cash', items = [], discountRate = 0 } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Order must include at least one item.' });
  }

  const normalizedItems = items.map((item) => {
    const product = db.products.find((p) => p.id === item.productId);
    if (!product) {
      throw new Error(`Product not found: ${item.productId}`);
    }

    const quantity = Number(item.quantity || 1);
    if (quantity <= 0) {
      throw new Error(`Invalid quantity for ${product.name}`);
    }

    if (product.stock < quantity) {
      throw new Error(`Insufficient stock for ${product.name}`);
    }

    return {
      productId: product.id,
      name: product.name,
      quantity,
      price: Number(product.price)
    };
  });

  const taxRate = Number(db.settings?.taxRate || 10);
  const calculated = calculateOrderTotals(normalizedItems, taxRate, Number(discountRate));

  const order = {
    id: `ord-${uuidv4()}`,
    orderNumber: `ORD-${String(db.orders.length + 1001)}`,
    customerName,
    paymentMethod,
    items: normalizedItems,
    subtotal: calculated.subtotal,
    tax: calculated.tax,
    discount: calculated.discount,
    total: calculated.total,
    status: 'completed',
    createdAt: new Date().toISOString()
  };

  db.orders.push(order);

  normalizedItems.forEach((item) => {
    const product = db.products.find((p) => p.id === item.productId);
    if (product) {
      product.stock = Math.max(0, Number(product.stock) - Number(item.quantity));
    }
  });

  writeDb(db);
  res.status(201).json(order);
});

app.get('/api/dashboard', (req, res) => {
  const db = readDb();
  const today = new Date();
  const todayOrders = db.orders.filter((order) => {
    const orderDate = new Date(order.createdAt);
    return orderDate.toDateString() === today.toDateString();
  });

  const totalSales = todayOrders.reduce((sum, order) => sum + Number(order.total), 0);
  const totalOrders = todayOrders.length;
  const lowStock = db.products.filter((product) => product.stock <= 10).length;

  res.json({
    totalSales: Number(totalSales.toFixed(2)),
    totalOrders,
    lowStock,
    recentOrders: todayOrders.slice(-5).reverse()
  });
});

app.get('/api/stock/low', (req, res) => {
  const db = readDb();
  res.json(db.products.filter((product) => product.stock <= 10));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: err.message || 'Something went wrong.' });
});

app.listen(PORT, () => {
  console.log(`MRC POS backend running on http://localhost:${PORT}`);
});
