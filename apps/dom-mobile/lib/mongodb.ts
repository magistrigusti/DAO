// ========== MONGODB ПОДКЛЮЧЕНИЕ ==========
// Используется в API routes (serverless).
// MONGODB_URI — в env Vercel.
// =========================================

import { MongoClient, type Db } from 'mongodb';

const uri = process.env.MONGODB_URI;
let client: MongoClient | null = null;
let db: Db | null = null;

export async function getDb(): Promise<Db> {
  if (!uri) {
    throw new Error('MONGODB_URI is not set');
  }
  if (!client) {
    client = new MongoClient(uri);
    await client.connect();
  }
  if (!db) {
    db = client.db('dominum');
  }
  return db;
}
