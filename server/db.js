import 'dotenv/config';
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const dbName = process.env.MONGODB_DB || 'koolits_pos';

export const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
await client.connect();

export const db = client.db(dbName);

export async function nextId(name) {
  const result = await db.collection('counters').findOneAndUpdate(
    { _id: name },
    { $inc: { value: 1 } },
    { upsert: true, returnDocument: 'after' }
  );
  if (typeof result?.value === 'number') return result.value;
  return result?.value?.value ?? result?.value;
}
