import { db, randomId } from '../../lib/database.js';
import { setCORS, sendJSON, sendError, parseBody, createPost } from '../../lib/helpers.js';

export default async function handler(req, res) {
  setCORS(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET - List all posts
  if (req.method === 'GET') {
    const { field, value, sortBy, order = 'asc' } = req.query;

    const filters = field && value ? { [field]: value } : {};
    const sort = sortBy ? { field: sortBy, order } : { field: 'created_at', order: 'desc' };

    const posts = await db.findAll('posts', filters, sort);

    return sendJSON(res, {
      limits_pages: Math.ceil(posts.length / 12) || 0,
      posts
    });
  }

  // POST - Create new post
  if (req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const id = randomId();

      const postData = createPost(id, body);
      
      // Convert to DB format (camelCase to snake_case)
      const dbData = {
        id: postData.id,
        title: postData.title,
        icon: postData.icon,
        thumbnail: postData.thumbnail,
        whatnews: JSON.stringify(postData.whatnews),
        description: postData.description,
        author: postData.author,
        created_at: postData.createdAt,
        links: postData.links ? JSON.stringify(postData.links) : null,
        stats: JSON.stringify(postData.stats)
      };

      const post = await db.create('posts', dbData);

      return sendJSON(res, {
        message: 'Post created',
        postId: id,
        post
      }, 201);
    } catch (error) {
      console.error('Create post error:', error);
      return sendError(res, 'Failed to create post', 500);
    }
  }

  return sendError(res, 'Method not allowed', 405);
}