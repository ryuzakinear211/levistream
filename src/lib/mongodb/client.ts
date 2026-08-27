import { MongoClient } from 'mongodb';
import { MONGODB_CONFIG } from './config';

const uri = MONGODB_CONFIG.uri;
const options = {};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

if (!global._mongoClientPromise) {
  client = new MongoClient(uri, options);
  global._mongoClientPromise = client.connect();
}
clientPromise = global._mongoClientPromise;

export default clientPromise;

export async function getDatabase() {
  const connectedClient = await clientPromise;
  return connectedClient.db(MONGODB_CONFIG.dbName);
}
