import { db } from '../../../../lib/database.js';
import { setCORS, sendJSON, sendError, parseBody, requireAppAuth } from '../../../../lib/helpers.js';

export default async function handler(req, res) {
  setCORS(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!requireAppAuth(req, res)) return;

  const { userId, postId } = req.query;

  const user = await db.findById('users', userId);
  const post = await db.findById('posts', postId);

  if (!user) {
    return sendError(res, 'User not found', 404);
  }

  if (!post) {
    return sendError(res, 'Post not found', 404);
  }

  // GET - Check if post is favorited
  if (req.method === 'GET') {
    const isFavorite = user.favorites.includes(postId);

    return sendJSON(res, {
      userId,
      postId,
      isFavorite
    });
  }

  // POST - Toggle favorite
  if (req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const { favorite } = body;

      const isFavorited = user.favorites.includes(postId);
      const shouldFavorite = favorite !== undefined ? favorite : !isFavorited;

      let newFavorites = [...user.favorites];

      if (shouldFavorite && !isFavorited) {
        newFavorites.push(postId);
      } else if (!shouldFavorite && isFavorited) {
        newFavorites = newFavorites.filter(id => id !== postId);
      }

      await db.update('users', userId, { favorites: newFavorites });

      return sendJSON(res, {
        message: shouldFavorite ? 'Added to favorites' : 'Removed from favorites',
        isFavorite: shouldFavorite,
        favorites: newFavorites
      });
    } catch (error) {
      console.error('Toggle favorite error:', error);
      return sendError(res, 'Failed to update favorites', 500);
    }
  }

  return sendError(res, 'Method not allowed', 405);
}