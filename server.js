const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'data', 'db.json');
const JWT_SECRET = process.env.JWT_SECRET || 'mrc-pos-secret';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function readDb() {
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    return {
      settings: {
        storeName: 'MRC Market',
        currency: 'USD',
        taxRate: 10,
        discountRate: 0,
        receiptFooter: 'Thank you for shopping with MRC Market'
      },
      users: [
        { id: 'user-admin', username: 'admin', password: 'admin123', role: 'admin', name: 'System Admin' },
        { id: 'user-cashier', username: 'cashier', password: 'cash123', role: 'cashier', name: 'Store Cashier' }
      ],
      products: [],
      orders: []
    };
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

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Access token required.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'MRC POS backend is running' });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const db = readDb();
  const user = db.users.find((entry) => entry.username === username && entry.password === password);

  if (!user) {
    return res.status(401).json({ message: 'Invalid username or password.' });
  }

  const token = jwt.sign({
    id: user.id,
    username: user.username,
    role: user.role,
    name: user.name
  }, JWT_SECRET, { expiresIn: '8h' });

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      name: user.name
    }
  });
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

app.get('/api/settings', (req, res) => {
  const db = readDb();
  res.json(db.settings);
});

app.put('/api/settings', authenticateToken, (req, res) => {
  const db = readDb();
  db.settings = { ...db.settings, ...req.body };
  writeDb(db);
  res.json(db.settings);
});

app.get('/api/products', authenticateToken, (req, res) => {
  const db = readDb();
  res.json(db.products.filter((p) => p.active !== false));
});

app.post('/api/products', authenticateToken, (req, res) => {
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

app.put('/api/products/:id', authenticateToken, (req, res) => {
  const db = readDb();
  const productIndex = db.products.findIndex((product) => product.id === req.params.id);

  if (productIndex === -1) {
    return res.status(404).json({ message: 'Product not found.' });
  }

  db.products[productIndex] = {
    ...db.products[productIndex],
    ...req.body,
    price: Number(req.body.price || db.products[productIndex].price),
    stock: Number(req.body.stock ?? db.products[productIndex].stock),
    taxRate: Number(req.body.taxRate ?? db.products[productIndex].taxRate)
  };

  writeDb(db);
  res.json(db.products[productIndex]);
});

app.delete('/api/products/:id', authenticateToken, (req, res) => {
  const db = readDb();
  db.products = db.products.filter((product) => product.id !== req.params.id);
  writeDb(db);
  res.json({ success: true, message: 'Product removed.' });
});

app.post('/api/products/:id/stock-adjust', authenticateToken, (req, res) => {
  const db = readDb();
  const product = db.products.find((entry) => entry.id === req.params.id);
  if (!product) return res.status(404).json({ message: 'Product not found.' });

  const adjustment = Number(req.body.adjustment || 0);
  product.stock = Math.max(0, Number(product.stock) + adjustment);
  writeDb(db);
  res.json(product);
});

app.get('/api/orders', authenticateToken, (req, res) => {
  const db = readDb();
  res.json(db.orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

app.post('/api/orders', authenticateToken, (req, res) => {
  const db = readDb();
  const { customerName = 'Walk-in Customer', paymentMethod = 'cash', items = [], discountRate = 0 } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Order must include at least one item.' });
  }

  try {
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
  } catch (error) {
    res.status(400).json({ message: error.message || 'Unable to create order.' });
  }
});

app.get('/api/dashboard', authenticateToken, (req, res) => {
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

app.get('/api/stock/low', authenticateToken, (req, res) => {
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
