import { db, randomId } from '../../lib/database.js';
import { setCORS, sendJSON, sendError, parseBody, requireAppAuth, createUser } from '../../lib/helpers.js';

export default async function handler(req, res) {
  setCORS(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return sendError(res, 'Method not allowed', 405);
  }

  if (!requireAppAuth(req, res)) return;

  try {
    const body = await parseBody(req);
    const { username, email } = body;

    if (!username || !email) {
      return sendError(res, 'Username and email required', 400);
    }

    // Check if user exists
    const allUsers = await db.findAll('users');
    const existing = allUsers.find(u => u.email === email);

    if (existing) {
      return sendJSON(res, {
        message: 'User logged in',
        user: existing
      });
    }

    // Create new user
    const id = randomId();
    const userData = createUser(id, body);

    const dbData = {
      id: userData.id,
      username: userData.username,
      email: userData.email,
      display_name: userData.displayName,
      avatar: userData.avatar,
      bio: userData.bio,
      created_at: userData.createdAt,
      favorites: userData.favorites,
      following: userData.following,
      followers: userData.followers
    };

    const user = await db.create('users', dbData);

    return sendJSON(res, {
      message: 'User created',
      user
    }, 201);
  } catch (error) {
    console.error('Auth error:', error);
    return sendError(res, 'Authentication failed', 500);
  }
}