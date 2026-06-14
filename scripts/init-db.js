import 'dotenv/config';
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const dbName = process.env.MONGODB_DB || 'koolits_pos';
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });

await client.connect();
const db = client.db(dbName);

async function nextId(name) {
  const result = await db.collection('counters').findOneAndUpdate(
    { _id: name },
    { $inc: { value: 1 } },
    { upsert: true, returnDocument: 'after' }
  );
  if (typeof result?.value === 'number') return result.value;
  return result?.value?.value ?? result?.value;
}

async function ensureCounter(name, collection) {
  const max = await db.collection(collection).find().sort({ id: -1 }).limit(1).next();
  await db.collection('counters').updateOne(
    { _id: name },
    { $max: { value: Number(max?.id || 0) } },
    { upsert: true }
  );
}

await Promise.all([
  db.collection('users').createIndex({ username: 1 }, { unique: true }),
  db.collection('categories').createIndex({ name: 1 }, { unique: true }),
  db.collection('products').createIndex({ category_id: 1, name: 1 }),
  db.collection('stock_items').createIndex({ name: 1 }, { unique: true }),
  db.collection('product_recipes').createIndex({ product_id: 1, stock_item_id: 1 }, { unique: true }),
  db.collection('sales').createIndex({ receipt_no: 1 }, { unique: true }),
  db.collection('sales').createIndex({ created_at: -1 }),
  db.collection('expenses').createIndex({ expense_date: -1, created_at: -1 }),
  db.collection('remittances').createIndex({ business_date: 1 }, { unique: true })
]);

const seedCategories = [
  ['Lemonade', '#f5aa22'],
  ['Soft Serve', '#e95f52'],
  ['Waffles', '#275266'],
  ['Fries', '#54a36c'],
  ['Drinks', '#4c83b6'],
  ['Others', '#7a6a58']
];

for (const [name, color] of seedCategories) {
  if (!(await db.collection('categories').findOne({ name }))) {
    await db.collection('categories').insertOne({ id: await nextId('categories'), name, color, created_at: new Date() });
  }
}

const seedUsers = [
  ['admin', 'Admin', '916abcd218a351c07a02a234a24552f7:e27de72f122873e18242ff3939a3dd44da10b81b23bf63a635c786332f76922e', 'admin'],
  ['seller', 'Seller', 'bed0b1326dc3a155b7fa27d4e5bbfd3e:a5bc436510379628c054e7c3dbf9f99b1fbca86854df99924b832f272e9aefc2', 'seller']
];

for (const [username, display_name, password_hash, role] of seedUsers) {
  if (!(await db.collection('users').findOne({ username }))) {
    await db.collection('users').insertOne({
      id: await nextId('users'),
      username,
      display_name,
      password_hash,
      role,
      is_active: true,
      created_at: new Date()
    });
  }
}

const seedStocks = [
  ['Waffle mix', 'grams', 5000, 1000],
  ['Chocolate syrup', 'ml', 2000, 300],
  ['Waffle packaging', 'pcs', 100, 20],
  ['Lemonade concentrate', 'ml', 3000, 500],
  ['Cups 16oz', 'pcs', 150, 30],
  ['Soft serve mix', 'ml', 5000, 800],
  ['Fries frozen', 'grams', 5000, 1000],
  ['Fries box', 'pcs', 100, 20]
];

for (const [name, unit, quantity_on_hand, reorder_level] of seedStocks) {
  if (!(await db.collection('stock_items').findOne({ name }))) {
    await db.collection('stock_items').insertOne({
      id: await nextId('stock_items'),
      name,
      unit,
      quantity_on_hand,
      reorder_level,
      is_active: true,
      created_at: new Date()
    });
  }
}

const seedProducts = [
  ['Waffles', 'Classic Waffle', 55],
  ['Waffles', 'Chocolate Waffle', 65],
  ['Lemonade', 'Classic Lemonade', 45],
  ['Soft Serve', 'Vanilla Soft Serve', 35],
  ['Fries', 'Regular Fries', 50]
];

for (const [categoryName, name, price] of seedProducts) {
  const category = await db.collection('categories').findOne({ name: categoryName });
  if (category && !(await db.collection('products').findOne({ category_id: category.id, name, is_active: true }))) {
    await db.collection('products').insertOne({
      id: await nextId('products'),
      category_id: category.id,
      name,
      price,
      is_active: true,
      created_at: new Date()
    });
  }
}

const seedRecipes = [
  ['Classic Waffle', 'Waffle mix', 80],
  ['Classic Waffle', 'Waffle packaging', 1],
  ['Chocolate Waffle', 'Waffle mix', 80],
  ['Chocolate Waffle', 'Chocolate syrup', 25],
  ['Chocolate Waffle', 'Waffle packaging', 1],
  ['Classic Lemonade', 'Lemonade concentrate', 60],
  ['Classic Lemonade', 'Cups 16oz', 1],
  ['Vanilla Soft Serve', 'Soft serve mix', 120],
  ['Regular Fries', 'Fries frozen', 150],
  ['Regular Fries', 'Fries box', 1]
];

for (const [productName, stockName, quantity_per_unit] of seedRecipes) {
  const product = await db.collection('products').findOne({ name: productName, is_active: true });
  const stock = await db.collection('stock_items').findOne({ name: stockName, is_active: true });
  if (product && stock && !(await db.collection('product_recipes').findOne({ product_id: product.id, stock_item_id: stock.id }))) {
    await db.collection('product_recipes').insertOne({
      id: await nextId('product_recipes'),
      product_id: product.id,
      stock_item_id: stock.id,
      quantity_per_unit
    });
  }
}

await Promise.all([
  ensureCounter('users', 'users'),
  ensureCounter('categories', 'categories'),
  ensureCounter('products', 'products'),
  ensureCounter('stock_items', 'stock_items'),
  ensureCounter('product_recipes', 'product_recipes'),
  ensureCounter('sales', 'sales'),
  ensureCounter('sale_items', 'sale_items'),
  ensureCounter('inventory_movements', 'inventory_movements'),
  ensureCounter('expenses', 'expenses'),
  ensureCounter('remittances', 'remittances')
]);

await client.close();
console.log(`KoolITs POS MongoDB database is ready: ${dbName}`);
