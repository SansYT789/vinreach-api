import { db } from '../lib/database.js';
import { setCORS, sendJSON, sendError } from '../lib/helpers.js';

export default async function handler(req, res) {
  setCORS(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return sendError(res, 'Method not allowed', 405);
  }

  const { q, type = 'all', field } = req.query;

  if (!q) {
    return sendError(res, "Query parameter 'q' required");
  }

  try {
    const results = await db.search(q, type);

    // Apply field filter if specified
    if (field) {
      results.posts = results.posts
        .map(p => p[field] ? { id: p.id, [field]: p[field] } : null)
        .filter(Boolean);
      
      results.users = results.users
        .map(u => u[field] ? { id: u.id, [field]: u[field] } : null)
        .filter(Boolean);
    }

    const totalResults = results.posts.length + results.users.length;

    return sendJSON(res, {
      limits_pages: Math.ceil(totalResults / 12),
      filter_search: type,
      search: [...results.posts, ...results.users]
    });
  } catch (error) {
    console.error('Search error:', error);
    return sendError(res, 'Search failed', 500);
  }
}
