import { db, randomId } from '../../../lib/database.js';
import { setCORS, sendJSON, sendError, parseBody, requireAppAuth, createComment } from '../../../lib/helpers.js';

export default async function handler(req, res) {
  setCORS(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { postId } = req.query;

  // GET - List all comments for a post
  if (req.method === 'GET') {
    const post = await db.findById('posts', postId);

    if (!post) {
      return sendError(res, 'Post not found', 404);
    }

    const comments = await db.findAll('comments', { post_id: postId }, { field: 'timestamp', order: 'desc' });

    return sendJSON(res, {
      postId,
      comments
    });
  }

  // POST - Create new comment (requires auth)
  if (req.method === 'POST') {
    if (!requireAppAuth(req, res)) return;

    try {
      const post = await db.findById('posts', postId);

      if (!post) {
        return sendError(res, 'Post not found', 404);
      }

      const body = await parseBody(req);

      if (!body.text) {
        return sendError(res, 'Text required', 400);
      }

      const id = randomId();
      const commentData = createComment(id, { ...body, postId });

      const dbData = {
        id: commentData.id,
        post_id: commentData.postId,
        user_id: commentData.userId,
        text: commentData.text,
        timestamp: commentData.timestamp,
        likes: commentData.likes,
        dislikes: commentData.dislikes,
        replies: JSON.stringify(commentData.replies)
      };

      const comment = await db.create('comments', dbData);

      return sendJSON(res, {
        message: 'Comment created',
        comment
      }, 201);
    } catch (error) {
      console.error('Create comment error:', error);
      return sendError(res, 'Failed to create comment', 500);
    }
  }

  return sendError(res, 'Method not allowed', 405);
}