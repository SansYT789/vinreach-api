import { db } from '../../lib/database.js';
import { setCORS, sendJSON, sendError, parseBody } from '../../lib/helpers.js';

export default async function handler(req, res) {
  setCORS(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { id } = req.query;

  // GET - Retrieve single post
  if (req.method === 'GET') {
    try {
      const { field } = req.query;
      const post = await db.findById('posts', id);

      if (!post) {
        return sendError(res, 'Post not found', 404);
      }

      if (field) {
        if (!(field in post)) {
          return sendError(res, 'Field not found', 404);
        }
        return sendJSON(res, { [field]: post[field] });
      }

      return sendJSON(res, post);
    } catch (error) {
      console.error('Get post error:', error);
      return sendError(res, 'Failed to fetch post', 500);
    }
  }

  // PATCH - Update post
  if (req.method === 'PATCH') {
    try {
      const body = await parseBody(req);
      const post = await db.findById('posts', id);

      if (!post) {
        return sendError(res, 'Post not found', 404);
      }

      // Remove protected fields
      const { id: _, createdAt, created_at, comments, ...updates } = body;

      // Convert JSON fields
      if (updates.whatnews) updates.whatnews = JSON.stringify(updates.whatnews);
      if (updates.links) updates.links = JSON.stringify(updates.links);
      if (updates.stats) updates.stats = JSON.stringify(updates.stats);

      const updatedPost = await db.update('posts', id, updates);

      return sendJSON(res, {
        message: 'Post updated',
        post: updatedPost
      });
    } catch (error) {
      console.error('Update post error:', error);
      return sendError(res, 'Failed to update post', 500);
    }
  }

  // DELETE - Delete post
  if (req.method === 'DELETE') {
    try {
      const post = await db.findById('posts', id);

      if (!post) {
        return sendError(res, 'Post not found', 404);
      }

      // Delete associated comments
      await db.deleteWhere('comments', { post_id: id });
      await db.delete('posts', id);

      return sendJSON(res, { message: 'Post deleted' });
    } catch (error) {
      console.error('Delete post error:', error);
      return sendError(res, 'Failed to delete post', 500);
    }
  }

  return sendError(res, 'Method not allowed', 405);
}