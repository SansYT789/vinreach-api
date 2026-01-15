import { db } from '../../../../lib/database.js';
import { setCORS, sendJSON, sendError, parseBody, requireAppAuth } from '../../../../lib/helpers.js';

export default async function handler(req, res) {
  setCORS(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { postId, commentId } = req.query;

  // GET - Retrieve single comment
  if (req.method === 'GET') {
    const { field } = req.query;
    const comment = await db.findById('comments', commentId);

    if (!comment || comment.postId !== postId) {
      return sendError(res, 'Comment not found', 404);
    }

    if (field) {
      if (!(field in comment)) {
        return sendError(res, 'Field not found', 404);
      }
      return sendJSON(res, { [field]: comment[field] });
    }

    return sendJSON(res, comment);
  }

  // PATCH - Update comment (requires auth)
  if (req.method === 'PATCH') {
    if (!requireAppAuth(req, res)) return;

    try {
      const comment = await db.findById('comments', commentId);

      if (!comment || comment.postId !== postId) {
        return sendError(res, 'Comment not found', 404);
      }

      const body = await parseBody(req);
      const { id: _, postId: __, timestamp: ___, ...updates } = body;

      if (updates.replies) {
        updates.replies = JSON.stringify(updates.replies);
      }

      const updated = await db.update('comments', commentId, updates);

      return sendJSON(res, {
        message: 'Comment updated',
        comment: updated
      });
    } catch (error) {
      console.error('Update comment error:', error);
      return sendError(res, 'Failed to update comment', 500);
    }
  }

  // DELETE - Delete comment (requires auth)
  if (req.method === 'DELETE') {
    if (!requireAppAuth(req, res)) return;

    const comment = await db.findById('comments', commentId);

    if (!comment || comment.postId !== postId) {
      return sendError(res, 'Comment not found', 404);
    }

    await db.delete('comments', commentId);

    return sendJSON(res, { message: 'Comment deleted' });
  }

  return sendError(res, 'Method not allowed', 405);
}