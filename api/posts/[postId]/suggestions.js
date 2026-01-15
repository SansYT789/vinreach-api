import { db } from '../../../lib/database.js';
import { setCORS, sendJSON, sendError, requireAppAuth } from '../../../lib/helpers.js';

export default async function handler(req, res) {
  setCORS(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return sendError(res, 'Method not allowed', 405);
  }

  if (!requireAppAuth(req, res)) return;

  const { postId } = req.query;

  const post = await db.findById('posts', postId);

  if (!post) {
    return sendError(res, 'Post not found', 404);
  }

  const allPosts = await db.findAll('posts');
  const suggestions = allPosts
    .filter(p => p.id !== postId)
    .sort(() => 0.5 - Math.random())
    .slice(0, 12);

  return sendJSON(res, { suggestions });
}