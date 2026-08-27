/**
 * MongoDB Configuration
 * Configurable via process.env.MONGODB_URI or default cluster connection
 */
export const MONGODB_CONFIG = {
  uri:
    process.env.MONGODB_URI ||
    'mongodb+srv://zulfikar96789_db_user:natusvincer@cluster0.abst4pz.mongodb.net/?appName=Cluster0',
  dbName: process.env.MONGODB_DB_NAME || 'filmes_db',
};
