import 'dotenv/config';
import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import { db, nextId } from './db.js';

const app = express();
const port = Number(process.env.PORT || 4010);

app.use(cors());
app.use(express.json());

const ok = (res, data) => res.json(data);
const hashPassword = (password, salt = crypto.randomBytes(16).toString('hex')) => {
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex');
  return `${salt}:${hash}`;
};
const verifyPassword = (password, storedHash) => {
  const [salt, hash] = String(storedHash || '').split(':');
  if (!salt || !hash) return false;
  const candidate = hashPassword(password, salt).split(':')[1];
  if (candidate.length !== hash.length) return false;
  return crypto.timingSafeEqual(Buffer.from(candidate, 'hex'), Buffer.from(hash, 'hex'));
};

const todayDate = () => new Date().toISOString().slice(0, 10);
const monthStart = (value) => `${value.slice(0, 7)}-01`;
const addDays = (value, days) => {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
};
const addMonths = (value, months) => {
  const [year, month] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1 + months, 1));
  return date.toISOString().slice(0, 10);
};
const dateStart = (value) => new Date(`${value}T00:00:00.000Z`);
const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function getDateRange(query) {
  const period = ['month', 'range'].includes(query.period) ? query.period : 'day';
  const baseDate = query.date || todayDate();
  if (period === 'range') {
    const start = query.start_date || baseDate;
    const inclusiveEnd = query.end_date || start;
    return { period, date: baseDate, start, end: addDays(inclusiveEnd, 1), range_end: inclusiveEnd };
  }
  if (period === 'month') {
    const start = monthStart(baseDate);
    return { period, date: baseDate, start, end: addMonths(start, 1) };
  }
  return { period, date: baseDate, start: baseDate, end: addDays(baseDate, 1) };
}

async function productRows() {
  const [products, categories, recipes, stocks] = await Promise.all([
    db.collection('products').find({ is_active: true }).sort({ name: 1 }).toArray(),
    db.collection('categories').find().toArray(),
    db.collection('product_recipes').find().toArray(),
    db.collection('stock_items').find().toArray()
  ]);
  const categoryMap = new Map(categories.map((category) => [category.id, category]));
  const stockMap = new Map(stocks.map((stock) => [stock.id, stock]));
  return products
    .map((product) => {
      const category = categoryMap.get(product.category_id) || {};
      return {
        ...product,
        category_name: category.name || '',
        category_color: category.color || '#275266',
        recipe: recipes
          .filter((recipe) => recipe.product_id === product.id)
          .map((recipe) => {
            const stock = stockMap.get(recipe.stock_item_id) || {};
            return {
            id: recipe.id,
            product_id: recipe.product_id,
            stock_item_id: recipe.stock_item_id,
            quantity_per_unit: recipe.quantity_per_unit,
            name: stock.name,
            unit: stock.unit,
            quantity_on_hand: stock.quantity_on_hand
            };
          })
      };
    })
    .sort((a, b) => `${a.category_name} ${a.name}`.localeCompare(`${b.category_name} ${b.name}`));
}

app.get('/api/health', async (_req, res) => {
  await db.command({ ping: 1 });
  ok(res, { status: 'ok' });
});

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');
    if (!username || !password) return res.status(400).json({ message: 'Username and password are required.' });
    const user = await db.collection('users').findOne({ username, is_active: true });
    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }
    ok(res, { id: user.id, username: user.username, display_name: user.display_name, role: user.role });
  } catch (error) {
    next(error);
  }
});

app.get('/api/users', async (_req, res, next) => {
  try {
    const users = await db.collection('users')
      .find({}, { projection: { password_hash: 0 } })
      .sort({ role: 1, display_name: 1 })
      .toArray();
    ok(res, users);
  } catch (error) {
    next(error);
  }
});

app.post('/api/users', async (req, res, next) => {
  try {
    const username = String(req.body.username || '').trim();
    const displayName = String(req.body.display_name || username).trim();
    const password = String(req.body.password || '');
    const role = ['admin', 'seller'].includes(req.body.role) ? req.body.role : 'seller';
    if (!username || !displayName || password.length < 4) {
      return res.status(400).json({ message: 'Username, display name, and password of at least 4 characters are required.' });
    }
    const user = {
      id: await nextId('users'),
      username,
      display_name: displayName,
      password_hash: hashPassword(password),
      role,
      is_active: true,
      created_at: new Date()
    };
    await db.collection('users').insertOne(user);
    ok(res, { id: user.id, username, display_name: displayName, role, is_active: true });
  } catch (error) {
    if (error.code === 11000) error.message = 'Username already exists.';
    next(error);
  }
});

app.patch('/api/users/:id/password', async (req, res, next) => {
  try {
    const password = String(req.body.password || '');
    if (password.length < 4) return res.status(400).json({ message: 'Password must be at least 4 characters.' });
    const id = Number(req.params.id);
    await db.collection('users').updateOne({ id }, { $set: { password_hash: hashPassword(password) } });
    ok(res, { id });
  } catch (error) {
    next(error);
  }
});

app.get('/api/categories', async (_req, res, next) => {
  try {
    ok(res, await db.collection('categories').find().sort({ name: 1 }).toArray());
  } catch (error) {
    next(error);
  }
});

app.post('/api/categories', async (req, res, next) => {
  try {
    const { name, color = '#275266' } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Category name is required.' });
    const category = { id: await nextId('categories'), name: name.trim(), color, created_at: new Date() };
    await db.collection('categories').insertOne(category);
    ok(res, category);
  } catch (error) {
    next(error);
  }
});

app.patch('/api/categories/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { name, color = '#275266' } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Category name is required.' });
    await db.collection('categories').updateOne({ id }, { $set: { name: name.trim(), color } });
    ok(res, { id, name: name.trim(), color });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/categories/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const product = await db.collection('products').findOne({ category_id: id, is_active: true });
    if (product) return res.status(409).json({ message: 'Move or delete products in this category first.' });
    await db.collection('categories').deleteOne({ id });
    ok(res, { id });
  } catch (error) {
    next(error);
  }
});

app.get('/api/products', async (_req, res, next) => {
  try {
    ok(res, await productRows());
  } catch (error) {
    next(error);
  }
});

app.post('/api/products', async (req, res, next) => {
  try {
    const { category_id, name, price } = req.body;
    if (!category_id || !name?.trim() || Number(price) < 0) {
      return res.status(400).json({ message: 'Category, product name, and price are required.' });
    }
    const product = {
      id: await nextId('products'),
      category_id: Number(category_id),
      name: name.trim(),
      price: Number(price),
      is_active: true,
      created_at: new Date()
    };
    await db.collection('products').insertOne(product);
    ok(res, { id: product.id });
  } catch (error) {
    next(error);
  }
});

app.patch('/api/products/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { category_id, name, price, is_active = true } = req.body;
    await db.collection('products').updateOne(
      { id },
      { $set: { category_id: Number(category_id), name: name.trim(), price: Number(price), is_active: Boolean(is_active) } }
    );
    ok(res, { id });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/products/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await db.collection('products').updateOne({ id }, { $set: { is_active: false } });
    ok(res, { id });
  } catch (error) {
    next(error);
  }
});

app.get('/api/stocks', async (_req, res, next) => {
  try {
    ok(res, await db.collection('stock_items').find({ is_active: true }).sort({ name: 1 }).toArray());
  } catch (error) {
    next(error);
  }
});

app.post('/api/stocks', async (req, res, next) => {
  try {
    const { name, unit, quantity_on_hand = 0, reorder_level = 0 } = req.body;
    if (!name?.trim() || !unit?.trim()) return res.status(400).json({ message: 'Stock name and unit are required.' });
    const stock = {
      id: await nextId('stock_items'),
      name: name.trim(),
      unit: unit.trim(),
      quantity_on_hand: Number(quantity_on_hand),
      reorder_level: Number(reorder_level),
      is_active: true,
      created_at: new Date()
    };
    await db.collection('stock_items').insertOne(stock);
    ok(res, { id: stock.id });
  } catch (error) {
    next(error);
  }
});

app.patch('/api/stocks/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { name, unit, quantity_on_hand, reorder_level } = req.body;
    await db.collection('stock_items').updateOne(
      { id },
      { $set: { name: name.trim(), unit: unit.trim(), quantity_on_hand: Number(quantity_on_hand), reorder_level: Number(reorder_level) } }
    );
    ok(res, { id });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/stocks/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await db.collection('product_recipes').deleteMany({ stock_item_id: id });
    await db.collection('stock_items').updateOne({ id }, { $set: { is_active: false } });
    ok(res, { id });
  } catch (error) {
    next(error);
  }
});

app.post('/api/stocks/:id/restock', async (req, res, next) => {
  try {
    const stockId = Number(req.params.id);
    const { quantity, movement_date, note = 'Stock quantity added' } = req.body;
    const amount = Number(quantity);
    if (!amount || amount <= 0) return res.status(400).json({ message: 'Quantity must be greater than zero.' });
    await db.collection('stock_items').updateOne({ id: stockId }, { $inc: { quantity_on_hand: amount } });
    await db.collection('inventory_movements').insertOne({
      id: await nextId('inventory_movements'),
      stock_item_id: stockId,
      sale_id: null,
      movement_type: 'restock',
      quantity_change: amount,
      movement_date: movement_date || todayDate(),
      note,
      created_at: new Date()
    });
    ok(res, { id: stockId, quantity_added: amount });
  } catch (error) {
    next(error);
  }
});

app.get('/api/stocks/:id/movements', async (req, res, next) => {
  try {
    const stockId = Number(req.params.id);
    const stock = await db.collection('stock_items').findOne({ id: stockId });
    const movements = await db.collection('inventory_movements')
      .find({ stock_item_id: stockId })
      .sort({ movement_date: -1, created_at: -1 })
      .limit(50)
      .toArray();
    ok(res, movements.map((movement) => ({ ...movement, stock_name: stock?.name || '', unit: stock?.unit || '' })));
  } catch (error) {
    next(error);
  }
});

app.post('/api/products/:productId/recipe', async (req, res, next) => {
  try {
    const product_id = Number(req.params.productId);
    const stock_item_id = Number(req.body.stock_item_id);
    const quantity_per_unit = Number(req.body.quantity_per_unit);
    if (!product_id || !stock_item_id || !quantity_per_unit || quantity_per_unit <= 0) {
      return res.status(400).json({ message: 'Choose a product, stock item, and quantity greater than zero.' });
    }
    await db.collection('product_recipes').updateOne(
      { product_id, stock_item_id },
      { $set: { product_id, stock_item_id, quantity_per_unit }, $setOnInsert: { id: await nextId('product_recipes') } },
      { upsert: true }
    );
    ok(res, { product_id, stock_item_id });
  } catch (error) {
    next(error);
  }
});

app.put('/api/products/:productId/recipes', async (req, res, next) => {
  try {
    const product_id = Number(req.params.productId);
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (!product_id) return res.status(400).json({ message: 'Choose a product.' });
    if (!items.length) return res.status(400).json({ message: 'Add at least one stock item to the recipe.' });
    const normalized = items.map((item) => ({
      stock_item_id: Number(item.stock_item_id),
      quantity_per_unit: Number(item.quantity_per_unit)
    }));
    if (normalized.some((item) => !item.stock_item_id || !item.quantity_per_unit || item.quantity_per_unit <= 0)) {
      return res.status(400).json({ message: 'Each recipe row needs a stock item and quantity greater than zero.' });
    }
    const stockIds = normalized.map((item) => item.stock_item_id);
    if (new Set(stockIds).size !== stockIds.length) {
      return res.status(400).json({ message: 'Each stock item can appear only once per product recipe.' });
    }
    await db.collection('product_recipes').deleteMany({ product_id });
    const docs = [];
    for (const item of normalized) {
      docs.push({ id: await nextId('product_recipes'), product_id, ...item });
    }
    await db.collection('product_recipes').insertMany(docs);
    ok(res, { product_id, items: normalized });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/recipes/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await db.collection('product_recipes').deleteOne({ id });
    ok(res, { id });
  } catch (error) {
    next(error);
  }
});

app.post('/api/sales', async (req, res, next) => {
  try {
    const { items = [], payment_method, amount_tendered = 0, payments, sale_date } = req.body;
    if (!items.length) return res.status(400).json({ message: 'Cart is empty.' });
    if (payment_method && !['cash', 'gcash', 'maya', 'mixed'].includes(payment_method)) {
      return res.status(400).json({ message: 'Use cash, gcash, or maya payment.' });
    }
    const ids = items.map((item) => Number(item.product_id));
    const products = await db.collection('products').find({ id: { $in: ids }, is_active: true }).toArray();
    const productMap = new Map(products.map((product) => [product.id, product]));
    const saleItems = [];
    for (const item of items) {
      const product = productMap.get(Number(item.product_id));
      if (!product) throw new Error(`Product not found: ${item.product_id}`);
      const quantity = Math.max(1, Number(item.quantity));
      saleItems.push({
        id: await nextId('sale_items'),
        product_id: product.id,
        product_name: product.name,
        quantity,
        unit_price: Number(product.price),
        line_total: Number(product.price) * quantity
      });
    }

    const recipeRows = await db.collection('product_recipes').find({ product_id: { $in: ids } }).toArray();
    const [waffleCategory, eggStock, oilStock] = await Promise.all([
      db.collection('categories').findOne({ name: { $regex: '^waffles?$', $options: 'i' } }),
      db.collection('stock_items').findOne({ name: { $regex: '^eggs?$', $options: 'i' }, is_active: true }),
      db.collection('stock_items').findOne({ name: { $regex: 'oil', $options: 'i' }, is_active: true })
    ]);
    const stockIds = recipeRows.map((recipe) => recipe.stock_item_id);
    if (eggStock) stockIds.push(eggStock.id);
    if (oilStock) stockIds.push(oilStock.id);
    const stocks = await db.collection('stock_items').find({ id: { $in: stockIds } }).toArray();
    const stockMap = new Map(stocks.map((stock) => [stock.id, stock]));
    const required = new Map();
    for (const item of saleItems) {
      for (const recipe of recipeRows.filter((row) => row.product_id === item.product_id)) {
        const stock = stockMap.get(recipe.stock_item_id);
        const current = required.get(recipe.stock_item_id) || { ...stock, stock_item_id: recipe.stock_item_id, required_quantity: 0 };
        current.required_quantity += Number(recipe.quantity_per_unit) * item.quantity;
        required.set(recipe.stock_item_id, current);
      }
      const product = productMap.get(item.product_id);
      if (waffleCategory && product?.category_id === waffleCategory.id) {
        const productRecipeStockIds = new Set(recipeRows.filter((row) => row.product_id === item.product_id).map((row) => row.stock_item_id));
        for (const [stock, amount] of [[eggStock, 4], [oilStock, 0.5]]) {
          if (!stock || productRecipeStockIds.has(stock.id)) continue;
          const current = required.get(stock.id) || { ...stock, stock_item_id: stock.id, required_quantity: 0 };
          current.required_quantity += amount * item.quantity;
          required.set(stock.id, current);
        }
      }
    }
    const shortages = [...required.values()].filter((stock) => Number(stock.quantity_on_hand) < stock.required_quantity);
    if (shortages.length) {
      const message = shortages.map((stock) => `${stock.name}: need ${stock.required_quantity} ${stock.unit}, available ${stock.quantity_on_hand}`).join('; ');
      const error = new Error(`Not enough stock. ${message}`);
      error.status = 409;
      throw error;
    }

    const subtotal = saleItems.reduce((sum, item) => sum + item.line_total, 0);
    const total = subtotal;
    const normalizedPayments = payments
      ? { cash: Number(payments.cash || 0), gcash: Number(payments.gcash || 0), maya: Number(payments.maya || 0) }
      : {
          cash: payment_method === 'cash' ? Number(amount_tendered || total) : 0,
          gcash: payment_method === 'gcash' ? total : 0,
          maya: payment_method === 'maya' ? total : 0
        };
    const tendered = normalizedPayments.cash + normalizedPayments.gcash + normalizedPayments.maya;
    if (tendered < total) {
      const error = new Error(`Payment is less than payable. Paid ${tendered.toFixed(2)}, total is ${total.toFixed(2)}.`);
      error.status = 400;
      throw error;
    }
    const change = Math.max(0, tendered - total);
    const usedMethods = Object.entries(normalizedPayments).filter(([, value]) => value > 0).map(([method]) => method);
    const method = usedMethods.length > 1 ? 'mixed' : usedMethods[0] || payment_method || 'cash';
    const receiptNo = `KLT-${Date.now()}`;
    const saleId = await nextId('sales');
    const saleCreatedAt = sale_date ? new Date(`${sale_date}T12:00:00.000Z`) : new Date();
    const sale = {
      id: saleId,
      receipt_no: receiptNo,
      subtotal,
      total,
      status: 'completed',
      payment_method: method,
      payment_breakdown: normalizedPayments,
      amount_tendered: tendered,
      change_due: change,
      items: saleItems.map((item) => ({ ...item, sale_id: saleId })),
      created_at: saleCreatedAt
    };
    await db.collection('sales').insertOne(sale);
    for (const stock of required.values()) {
      await db.collection('stock_items').updateOne({ id: stock.stock_item_id }, { $inc: { quantity_on_hand: -stock.required_quantity } });
      await db.collection('inventory_movements').insertOne({
        id: await nextId('inventory_movements'),
        stock_item_id: stock.stock_item_id,
        sale_id: saleId,
        movement_type: 'sale',
        quantity_change: -stock.required_quantity,
        movement_date: sale_date || todayDate(),
        note: `Receipt ${receiptNo}`,
        created_at: saleCreatedAt
      });
    }
    ok(res, sale);
  } catch (error) {
    next(error);
  }
});

app.get('/api/sales/recent', async (_req, res, next) => {
  try {
    const today = todayDate();
    ok(res, await db.collection('sales').find({
      created_at: { $gte: dateStart(today), $lt: dateStart(addDays(today, 1)) },
      status: { $ne: 'cancelled' }
    }).sort({ created_at: -1 }).toArray());
  } catch (error) {
    next(error);
  }
});

app.get('/api/sales', async (req, res, next) => {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 50)));
    ok(res, await db.collection('sales').find().sort({ created_at: -1 }).limit(limit).toArray());
  } catch (error) {
    next(error);
  }
});

app.delete('/api/admin/clear-sales', async (req, res, next) => {
  try {
    if (req.get('x-maintenance-token') !== 'koolits-clear-20260620-b7e91c') {
      return res.status(403).json({ message: 'Forbidden.' });
    }
    const movements = await db.collection('inventory_movements').find({ sale_id: { $exists: true } }).toArray();
    const netChanges = new Map();
    for (const movement of movements) {
      netChanges.set(movement.stock_item_id, Number(netChanges.get(movement.stock_item_id) || 0) + Number(movement.quantity_change || 0));
    }
    for (const [stockItemId, change] of netChanges.entries()) {
      if (change) await db.collection('stock_items').updateOne({ id: stockItemId }, { $inc: { quantity_on_hand: -change } });
    }
    const salesResult = await db.collection('sales').deleteMany({});
    const movementsResult = await db.collection('inventory_movements').deleteMany({ sale_id: { $exists: true } });
    const remittancesResult = await db.collection('remittances').deleteMany({});
    ok(res, {
      sales_deleted: salesResult.deletedCount,
      movements_deleted: movementsResult.deletedCount,
      remittances_deleted: remittancesResult.deletedCount,
      stocks_adjusted: [...netChanges.values()].filter(Boolean).length
    });
  } catch (error) {
    next(error);
  }
});

app.patch('/api/sales/:id/cancel', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const sale = await db.collection('sales').findOne({ id });
    if (!sale) return res.status(404).json({ message: 'Order not found.' });
    if (sale.status === 'cancelled') return res.status(400).json({ message: 'Order is already cancelled.' });

    const restore = new Map();
    const saleMovements = await db.collection('inventory_movements').find({ sale_id: id, movement_type: 'sale' }).toArray();
    if (saleMovements.length) {
      for (const movement of saleMovements) {
        restore.set(movement.stock_item_id, Number(restore.get(movement.stock_item_id) || 0) + Math.abs(Number(movement.quantity_change || 0)));
      }
    } else {
      const recipeRows = await db.collection('product_recipes').find({ product_id: { $in: (sale.items || []).map((item) => item.product_id) } }).toArray();
      for (const item of sale.items || []) {
        for (const recipe of recipeRows.filter((row) => row.product_id === item.product_id)) {
          restore.set(recipe.stock_item_id, Number(restore.get(recipe.stock_item_id) || 0) + Number(recipe.quantity_per_unit) * Number(item.quantity || 0));
        }
      }
    }

    for (const [stockItemId, quantity] of restore.entries()) {
      await db.collection('stock_items').updateOne({ id: stockItemId }, { $inc: { quantity_on_hand: quantity } });
      await db.collection('inventory_movements').insertOne({
        id: await nextId('inventory_movements'),
        stock_item_id: stockItemId,
        sale_id: id,
        movement_type: 'sale_cancel',
        quantity_change: quantity,
        movement_date: todayDate(),
        note: `Cancelled receipt ${sale.receipt_no}`,
        created_at: new Date()
      });
    }

    await db.collection('sales').updateOne(
      { id },
      { $set: { status: 'cancelled', cancelled_at: new Date(), cancel_note: String(req.body.note || '') } }
    );
    ok(res, { ...sale, status: 'cancelled', cancelled_at: new Date() });
  } catch (error) {
    next(error);
  }
});

app.get('/api/dashboard', async (req, res, next) => {
  try {
    const { period, date, start, end } = getDateRange(req.query);
    const searchText = String(req.query.search || '').trim();
    const searchRegex = new RegExp(escapeRegex(searchText), 'i');
    const dayDate = req.query.date || todayDate();
    const startDate = dateStart(start);
    const endDate = dateStart(end);

    const [salesAll, expensesAll, remittances, users] = await Promise.all([
      db.collection('sales').find({ created_at: { $gte: startDate, $lt: endDate }, status: { $ne: 'cancelled' } }).sort({ created_at: -1 }).toArray(),
      db.collection('expenses').find({ expense_date: { $gte: start, $lt: end } }).sort({ expense_date: -1, created_at: -1 }).toArray(),
      db.collection('remittances').find({ business_date: { $gte: start, $lt: end } }).sort({ business_date: -1 }).toArray(),
      db.collection('users').find().toArray()
    ]);
    const userMap = new Map(users.map((user) => [user.id, user]));

    const sales = searchText
      ? salesAll.filter((sale) =>
          searchRegex.test(sale.receipt_no) ||
          searchRegex.test(sale.payment_method) ||
          (sale.items || []).some((item) => searchRegex.test(item.product_name))
        )
      : salesAll;
    const expenses = (searchText
      ? expensesAll.filter((expense) => {
          const user = userMap.get(expense.created_by_user_id);
          return searchRegex.test(expense.category) || searchRegex.test(expense.description) || searchRegex.test(expense.payment_method) || searchRegex.test(user?.display_name || '');
        })
      : expensesAll
    ).map((expense) => {
      const user = userMap.get(expense.created_by_user_id);
      return { ...expense, created_by_name: user?.display_name || null, created_by_role: user?.role || null };
    });

    const summary = {
      sales_total: salesAll.reduce((sum, sale) => sum + Number(sale.total || 0), 0),
      sales_count: salesAll.length,
      expense_total: expensesAll.reduce((sum, expense) => sum + Number(expense.amount || 0), 0),
      expense_count: expensesAll.length
    };

    const salesDayMap = new Map();
    for (const sale of salesAll) {
      const key = new Date(sale.created_at).toISOString().slice(0, 10);
      const current = salesDayMap.get(key) || { business_date: key, sales_total: 0, sales_count: 0 };
      current.sales_total += Number(sale.total || 0);
      current.sales_count += 1;
      salesDayMap.set(key, current);
    }
    const expenseDayMap = new Map();
    for (const expense of expensesAll) {
      const current = expenseDayMap.get(expense.expense_date) || { business_date: expense.expense_date, expense_total: 0, expense_count: 0 };
      current.expense_total += Number(expense.amount || 0);
      current.expense_count += 1;
      expenseDayMap.set(expense.expense_date, current);
    }
    const remittanceDayMap = new Map(remittances.map((row) => [row.business_date, row]));
    const daily_sales = [];
    for (let current = start; current < end; current = addDays(current, 1)) {
      const daySales = salesDayMap.get(current);
      const dayExpenses = expenseDayMap.get(current);
      daily_sales.push({
        business_date: current,
        sales_total: Number(daySales?.sales_total || 0),
        sales_count: Number(daySales?.sales_count || 0),
        expense_total: Number(dayExpenses?.expense_total || 0),
        expense_count: Number(dayExpenses?.expense_count || 0),
        net_total: Number(daySales?.sales_total || 0) - Number(dayExpenses?.expense_total || 0),
        remittance: remittanceDayMap.get(current) || null
      });
    }

    const graphStart = period === 'range' ? monthStart(start) : `${start.slice(0, 4)}-01-01`;
    const graphEnd = period === 'range' ? addMonths(monthStart(end), 1) : addMonths(graphStart, 12);
    const graphSales = await db.collection('sales').find({ created_at: { $gte: dateStart(graphStart), $lt: dateStart(graphEnd) }, status: { $ne: 'cancelled' } }).toArray();
    const monthlyMap = new Map();
    for (const sale of graphSales) {
      const key = new Date(sale.created_at).toISOString().slice(0, 7);
      const current = monthlyMap.get(key) || { business_month: key, sales_total: 0, sales_count: 0 };
      current.sales_total += Number(sale.total || 0);
      current.sales_count += 1;
      monthlyMap.set(key, current);
    }
    const monthly_sales = [];
    for (let current = graphStart; current < graphEnd; current = addMonths(current, 1)) {
      const key = current.slice(0, 7);
      const monthSales = monthlyMap.get(key);
      monthly_sales.push({ business_month: key, sales_total: Number(monthSales?.sales_total || 0), sales_count: Number(monthSales?.sales_count || 0) });
    }

    ok(res, {
      period,
      date,
      start,
      end,
      range_end: period === 'range' ? req.query.end_date || start : null,
      summary: { ...summary, net_total: summary.sales_total - summary.expense_total },
      sales,
      expenses,
      remittances,
      daily_sales,
      monthly_sales,
      selected_day_remittance: await db.collection('remittances').findOne({ business_date: dayDate })
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/expenses', async (req, res, next) => {
  try {
    const { expense_date, category, description = '', amount, payment_method = 'cash', created_by_user_id = null } = req.body;
    if (!expense_date || !category?.trim() || Number(amount) <= 0) {
      return res.status(400).json({ message: 'Expense date, category, and amount are required.' });
    }
    const expense = {
      id: await nextId('expenses'),
      expense_date,
      category: category.trim(),
      description: description.trim(),
      amount: Number(amount),
      payment_method,
      created_by_user_id: created_by_user_id ? Number(created_by_user_id) : null,
      created_at: new Date()
    };
    await db.collection('expenses').insertOne(expense);
    ok(res, { id: expense.id });
  } catch (error) {
    next(error);
  }
});

app.patch('/api/expenses/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { expense_date, category, description = '', amount, payment_method = 'cash', created_by_user_id = null } = req.body;
    if (!expense_date || !category?.trim() || Number(amount) <= 0) {
      return res.status(400).json({ message: 'Expense date, category, and amount are required.' });
    }
    const set = {
      expense_date,
      category: category.trim(),
      description: description.trim(),
      amount: Number(amount),
      payment_method
    };
    const existing = await db.collection('expenses').findOne({ id });
    if (!existing?.created_by_user_id && created_by_user_id) set.created_by_user_id = Number(created_by_user_id);
    await db.collection('expenses').updateOne({ id }, { $set: set });
    ok(res, { id });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/expenses/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await db.collection('expenses').deleteOne({ id });
    ok(res, { id });
  } catch (error) {
    next(error);
  }
});

app.post('/api/remittances', async (req, res, next) => {
  try {
    const { business_date, amount, note = '', remitted_date } = req.body;
    if (!business_date) return res.status(400).json({ message: 'Choose the day to mark as remitted.' });
    const remittedAt = remitted_date ? dateStart(remitted_date) : new Date();
    const remittance = { business_date, amount: Number(amount || 0), note, remitted_at: remittedAt };
    await db.collection('remittances').updateOne(
      { business_date },
      { $set: remittance, $setOnInsert: { id: await nextId('remittances') } },
      { upsert: true }
    );
    ok(res, remittance);
  } catch (error) {
    next(error);
  }
});

app.post('/api/remittances/bulk', async (req, res, next) => {
  try {
    const dates = Array.isArray(req.body.dates) ? req.body.dates : [];
    const note = req.body.note || '';
    const remittedAt = req.body.remitted_date ? dateStart(req.body.remitted_date) : new Date();
    const dailyTotals = Array.isArray(req.body.daily_totals) ? req.body.daily_totals : [];
    if (!dates.length) return res.status(400).json({ message: 'Choose at least one day to remit.' });
    for (const business_date of dates) {
      const total = dailyTotals.find((item) => item.business_date === business_date);
      await db.collection('remittances').updateOne(
        { business_date },
        {
          $set: { business_date, amount: Number(total?.amount || 0), note, remitted_at: remittedAt },
          $setOnInsert: { id: await nextId('remittances') }
        },
        { upsert: true }
      );
    }
    ok(res, { dates });
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(error.status || 500).json({ message: error.message || 'Server error.' });
});

if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`KoolITs POS MongoDB API running on http://localhost:${port}`);
  });
}

export default app;
