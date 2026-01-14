import { setCORS } from '../lib/helpers.js';
import { initDB } from '../lib/database.js';

// Initialize database on cold start
let dbInitialized = false;

export default async function handler(req, res) {
  setCORS(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Initialize DB once
  if (!dbInitialized) {
    try {
      await initDB();
      dbInitialized = true;
    } catch (error) {
      console.error('DB init error:', error);
    }
  }

  if (req.method === 'GET') {
    return res.status(200).send('API ALIVE');
  }

  return res.status(404).json({ error: 'Not found' });
}
