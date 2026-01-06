import { MongoClient, Db } from 'mongodb';

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

async function connectToDatabase(): Promise<Db> {
  if (cachedDb && cachedClient) {
    return cachedDb;
  }

  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME || 'MedsenseClient';

  console.log('[DB] Environment check:', {
    MONGODB_URI_exists: !!uri,
    MONGODB_URI_value: uri ? uri.substring(0, 30) + '...' : 'NOT SET',
    MONGODB_DB_NAME: dbName,
  });

  if (!uri) {
    console.error('[DB] MONGODB_URI is not set!');
    console.error('[DB] Available env vars:', Object.keys(process.env).filter(k => k.includes('MONGO')));
    throw new Error('MONGODB_URI environment variable is not set');
  }

  try {
    console.log('[DB] Connecting to MongoDB at:', uri.substring(0, 30) + '...');
    
    const client = new MongoClient(uri, {
      maxPoolSize: 10,
      minPoolSize: 2,
      retryWrites: false,
    });
    
    await client.connect();
    
    console.log(`[DB] ✓ Connected to MongoDB: ${dbName}`);
    
    cachedClient = client;
    cachedDb = client.db(dbName);
    
    return cachedDb;
  } catch (error) {
    console.error('[DB] Connection failed:', error);
    throw error;
  }
}

export async function getDatabase() {
  return connectToDatabase();
}

export async function closeDatabase() {
  if (cachedClient) {
    await cachedClient.close();
    cachedClient = null;
    cachedDb = null;
    console.log('[DB] Connection closed');
  }
}

// Legacy support
export const db = {
  query: async (text: string, params?: any[]) => {
    console.warn('[DB] Legacy query method called. Use MongoDB directly instead.');
    return null;
  },
};