import { sql } from '@vercel/postgres';

const cache = new Map();
const CACHE_TTL = 60000;

function cacheKey(table, id) {
  return `${table}:${id}`;
}

function getCached(key) {
  const item = cache.get(key);
  if (item && Date.now() - item.time < CACHE_TTL) {
    return item.data;
  }
  cache.delete(key);
  return null;
}

function setCache(key, data) {
  cache.set(key, { data, time: Date.now() });
  if (cache.size > 1000) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
}

function parseRow(row) {
  if (!row) return null;
  const parsed = {};
  Object.entries(row).forEach(([key, value]) => {
    const camelKey = key.replace(/_([a-z])/g, (_, l) => l.toUpperCase());
    parsed[camelKey] = value;
  });
  return parsed;
}

export async function initDB() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS posts (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        icon TEXT,
        thumbnail TEXT,
        whatnews JSONB,
        description TEXT,
        author TEXT,
        created_at BIGINT NOT NULL,
        links JSONB,
        stats JSONB DEFAULT '{"like":0,"dislike":0,"share":0,"star":0}'::jsonb
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        display_name TEXT,
        avatar TEXT,
        bio TEXT,
        created_at BIGINT NOT NULL,
        favorites TEXT[] DEFAULT '{}',
        following TEXT[] DEFAULT '{}',
        followers TEXT[] DEFAULT '{}'
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS comments (
        id TEXT PRIMARY KEY,
        post_id TEXT NOT NULL,
        user_id TEXT,
        text TEXT NOT NULL,
        timestamp BIGINT NOT NULL,
        likes INTEGER DEFAULT 0,
        dislikes INTEGER DEFAULT 0,
        replies JSONB DEFAULT '[]'::jsonb
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS files (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        original_name TEXT,
        blob_url TEXT NOT NULL,
        mimetype TEXT,
        size INTEGER,
        uploaded_at BIGINT NOT NULL,
        expired_at BIGINT
      )
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`;
  } catch (error) {
    console.error('DB init error:', error);
  }
}

export const db = {
  async findAll(table, filters = {}, sort = {}) {
    try {
      const key = `${table}:all:${JSON.stringify(filters)}:${JSON.stringify(sort)}`;
      const cached = getCached(key);
      if (cached) return cached;

      let query = `SELECT * FROM ${table}`;
      const conditions = [];
      const values = [];
      let paramCount = 1;

      Object.entries(filters).forEach(([field, value]) => {
        if (value !== undefined) {
          conditions.push(`${field} ILIKE $${paramCount}`);
          values.push(`%${value}%`);
          paramCount++;
        }
      });

      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }

      if (sort.field) {
        query += ` ORDER BY ${sort.field} ${sort.order === 'desc' ? 'DESC' : 'ASC'}`;
      }

      const result = await sql.query(query, values);
      const rows = result.rows.map(parseRow);
      setCache(key, rows);
      return rows;
    } catch (error) {
      console.error('findAll error:', error);
      return [];
    }
  },

  async findById(table, id) {
    try {
      const key = cacheKey(table, id);
      const cached = getCached(key);
      if (cached) return cached;

      const result = await sql.query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
      const row = result.rows[0] ? parseRow(result.rows[0]) : null;
      if (row) setCache(key, row);
      return row;
    } catch (error) {
      console.error('findById error:', error);
      return null;
    }
  },

  async create(table, data) {
    try {
      const fields = Object.keys(data);
      const values = Object.values(data);
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

      const query = `
        INSERT INTO ${table} (${fields.join(', ')})
        VALUES (${placeholders})
        RETURNING *
      `;

      const result = await sql.query(query, values);
      const row = parseRow(result.rows[0]);
      setCache(cacheKey(table, row.id), row);
      cache.delete(`${table}:all`);
      return row;
    } catch (error) {
      console.error('create error:', error);
      throw error;
    }
  },

  async update(table, id, data) {
    try {
      const entries = Object.entries(data);
      if (entries.length === 0) return await this.findById(table, id);

      const sets = entries.map(([k], i) => `${k} = $${i + 2}`).join(', ');
      const values = entries.map(([, v]) => v);

      const query = `
        UPDATE ${table}
        SET ${sets}
        WHERE id = $1
        RETURNING *
      `;

      const result = await sql.query(query, [id, ...values]);
      const row = result.rows[0] ? parseRow(result.rows[0]) : null;
      if (row) {
        setCache(cacheKey(table, id), row);
        cache.delete(`${table}:all`);
      }
      return row;
    } catch (error) {
      console.error('update error:', error);
      throw error;
    }
  },

  async delete(table, id) {
    try {
      await sql.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
      cache.delete(cacheKey(table, id));
      cache.delete(`${table}:all`);
      return true;
    } catch (error) {
      console.error('delete error:', error);
      return false;
    }
  },

  async deleteWhere(table, conditions) {
    try {
      const entries = Object.entries(conditions);
      if (entries.length === 0) return false;

      const where = entries.map(([k], i) => `${k} = $${i + 1}`).join(' AND ');
      const values = entries.map(([, v]) => v);

      await sql.query(`DELETE FROM ${table} WHERE ${where}`, values);
      cache.delete(`${table}:all`);
      return true;
    } catch (error) {
      console.error('deleteWhere error:', error);
      return false;
    }
  },

  async search(query, type = 'all') {
    try {
      const q = `%${query.toLowerCase()}%`;
      const results = { posts: [], users: [] };

      if (type === 'all' || type === 'posts') {
        const postResults = await sql.query(`
          SELECT * FROM posts
          WHERE LOWER(title) LIKE $1
             OR LOWER(description) LIKE $1
             OR LOWER(author) LIKE $1
          LIMIT 50
        `, [q]);
        results.posts = postResults.rows.map(parseRow);
      }

      if (type === 'all' || type === 'users') {
        const userResults = await sql.query(`
          SELECT * FROM users
          WHERE LOWER(username) LIKE $1
             OR LOWER(display_name) LIKE $1
             OR id LIKE $2
          LIMIT 50
        `, [q, `%${query}%`]);
        results.users = userResults.rows.map(parseRow);
      }

      return results;
    } catch (error) {
      console.error('search error:', error);
      return { posts: [], users: [] };
    }
  }
};

export function randomId() {
  return Math.floor(Math.random() * 1e10).toString();
}