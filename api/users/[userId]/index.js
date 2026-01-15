import { db } from '../../lib/database.js';
import { setCORS, sendJSON, sendError, requireAppAuth } from '../../lib/helpers.js';

export default async function handler(req, res) {
  setCORS(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!requireAppAuth(req, res)) return;

  const { userId } = req.query;

  // GET - Retrieve user
  if (req.method === 'GET') {
    const { field } = req.query;
    const user = await db.findById('users', userId);

    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    if (field) {
      if (!(field in user)) {
        return sendError(res, 'Field not found', 404);
      }
      return sendJSON(res, { [field]: user[field] });
    }

    return sendJSON(res, user);
  }

  return sendError(res, 'Method not allowed', 405);
}