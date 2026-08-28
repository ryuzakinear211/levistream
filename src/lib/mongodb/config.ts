/**
 * MongoDB Configuration
 * Configurable via process.env.MONGODB_URI
 */
export const MONGODB_CONFIG = {
  uri: process.env.MONGODB_URI || '',
  dbName: process.env.MONGODB_DB_NAME || 'filmes_db',
};
