const APP_AUTH_KEY = process.env.APP_AUTH_KEY || "vinreach-community-secret-key";

export function requireAppAuth(req, res) {
  if (req.headers['x-app-auth'] !== APP_AUTH_KEY) {
    res.status(403).json({ error: "Forbidden: App auth required" });
    return false;
  }
  return true;
}

export function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

export function sendJSON(res, data, status = 200) {
  res.status(status).json(data);
}

export function sendError(res, message, status = 400) {
  res.status(status).json({ error: message });
}

// CORS headers for Vercel
export function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-app-auth');
  return res;
}

export function createPost(id, data = {}) {
  return {
    id,
    title: data.title || "Post",
    icon: data.icon || "_url",
    thumbnail: data.thumbnail || "_url",
    whatnews: data.whatnews || [{ version: 0, title: "First version", description: "- First version" }],
    description: data.description || "",
    author: data.author || "id",
    createdAt: Date.now(),
    links: data.links || null,
    stats: { like: 0, dislike: 0, share: 0, star: 0 }
  };
}

export function createUser(id, data = {}) {
  return {
    id,
    username: data.username || "user",
    email: data.email || "",
    displayName: data.displayName || "User",
    avatar: data.avatar || "_url",
    bio: data.bio || "",
    createdAt: Date.now(),
    favorites: [],
    following: [],
    followers: []
  };
}

export function createComment(id, data = {}) {
  return {
    id,
    postId: data.postId,
    userId: data.userId || "anonymous",
    text: data.text || "",
    timestamp: Date.now(),
    likes: 0,
    dislikes: 0,
    replies: []
  };
}
