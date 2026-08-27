import { MongoClient, MongoClientOptions } from 'mongodb';
import { MONGODB_CONFIG } from './config';

const uri = MONGODB_CONFIG.uri;

// Serverless-friendly pool and timeout configuration for Vercel and Cloud environments
const options: MongoClientOptions = {
  maxPoolSize: 10,
  minPoolSize: 0,
  serverSelectionTimeoutMS: 5000, // 5s max server selection timeout (never hangs 30s)
  connectTimeoutMS: 5000,
  socketTimeoutMS: 10000,
  maxIdleTimeMS: 10000,
};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

if (!global._mongoClientPromise) {
  client = new MongoClient(uri, options);
  global._mongoClientPromise = client.connect().catch((err) => {
    console.warn('[MongoDB] Client connection error:', err.message);
    // Reset promise so next attempt can reconnect
    global._mongoClientPromise = undefined;
    throw err;
  });
}
clientPromise = global._mongoClientPromise;

export default clientPromise;

export async function getDatabase() {
  try {
    if (!global._mongoClientPromise) {
      client = new MongoClient(uri, options);
      global._mongoClientPromise = client.connect();
    }
    const connectedClient = await global._mongoClientPromise;
    return connectedClient.db(MONGODB_CONFIG.dbName);
  } catch (err: any) {
    console.warn('[MongoDB] getDatabase connection failed:', err.message);
    throw err;
  }
}
