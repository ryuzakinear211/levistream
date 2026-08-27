import { MongoClient, MongoClientOptions } from 'mongodb';
import { MONGODB_CONFIG } from './config';

const uri = MONGODB_CONFIG.uri;

// Serverless-optimized options for Vercel and AWS Lambda
const options: MongoClientOptions = {
  maxPoolSize: 10,
  minPoolSize: 0,
  maxIdleTimeMS: 5000, // Close idle connections quickly to prevent stale TLS sockets on Vercel
  serverSelectionTimeoutMS: 8000,
  connectTimeoutMS: 8000,
  socketTimeoutMS: 20000,
  retryReads: true,
  retryWrites: true,
  tls: true,
};

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
  // eslint-disable-next-line no-var
  var _mongoClientInstance: MongoClient | undefined;
}

export function isMongoConfigured(): boolean {
  const currentUri = process.env.MONGODB_URI || MONGODB_CONFIG.uri || '';
  return Boolean(currentUri && currentUri.trim().startsWith('mongodb'));
}

function createNewClient(): { client: MongoClient; promise: Promise<MongoClient> } {
  const currentUri = process.env.MONGODB_URI || MONGODB_CONFIG.uri || '';
  if (!currentUri || !currentUri.trim().startsWith('mongodb')) {
    throw new Error('MONGODB_URI is not configured in environment variables');
  }

  const newClient = new MongoClient(currentUri, options);
  const promise = newClient.connect().catch((err) => {
    console.warn('[MongoDB] Connection initialization error:', err.message);
    global._mongoClientPromise = undefined;
    global._mongoClientInstance = undefined;
    throw err;
  });
  return { client: newClient, promise };
}

export function resetMongoClient() {
  if (global._mongoClientInstance) {
    try {
      global._mongoClientInstance.close(true).catch(() => {});
    } catch {}
  }
  global._mongoClientPromise = undefined;
  global._mongoClientInstance = undefined;
}

/**
 * Returns active database with automatic retry on TLS/SSL socket errors
 */
export async function getDatabase() {
  if (!isMongoConfigured()) {
    throw new Error('MONGODB_URI is not configured');
  }

  try {
    if (!global._mongoClientPromise) {
      const { client, promise } = createNewClient();
      global._mongoClientInstance = client;
      global._mongoClientPromise = promise;
    }

    const connectedClient = await global._mongoClientPromise;
    return connectedClient.db(MONGODB_CONFIG.dbName);
  } catch (err: any) {
    console.warn('[MongoDB] Primary connection failed, resetting and retrying:', err.message);
    resetMongoClient();

    // Reconnect with fresh client
    const { client, promise } = createNewClient();
    global._mongoClientInstance = client;
    global._mongoClientPromise = promise;

    const freshConnectedClient = await promise;
    return freshConnectedClient.db(MONGODB_CONFIG.dbName);
  }
}
