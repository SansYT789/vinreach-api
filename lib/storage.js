import { put, del, head } from '@vercel/blob';
import Busboy from 'busboy';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

export async function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({ 
      headers: req.headers,
      limits: { fileSize: MAX_FILE_SIZE }
    });

    let file = null;
    const fields = {};

    busboy.on('file', (fieldname, stream, info) => {
      const { filename, mimeType } = info;

      if (!ALLOWED_TYPES.includes(mimeType)) {
        stream.resume();
        reject(new Error('Only image files allowed'));
        return;
      }

      const chunks = [];
      stream.on('data', chunk => chunks.push(chunk));
      stream.on('end', () => {
        file = {
          fieldname,
          filename,
          mimeType,
          buffer: Buffer.concat(chunks)
        };
      });
      stream.on('limit', () => reject(new Error('File too large')));
    });

    busboy.on('field', (name, value) => {
      fields[name] = value;
    });

    busboy.on('finish', () => {
      resolve({ file, fields });
    });

    busboy.on('error', reject);

    req.pipe(busboy);
  });
}

export async function uploadFile(file, options = {}) {
  const { expiredAt } = options;
  
  const blob = await put(file.filename, file.buffer, {
    access: 'public',
    contentType: file.mimeType,
    ...(expiredAt && { 
      addRandomSuffix: false,
      cacheControlMaxAge: Math.floor((expiredAt - Date.now()) / 1000)
    })
  });

  return {
    url: blob.url,
    pathname: blob.pathname,
    size: file.buffer.length
  };
}

export async function deleteFile(url) {
  try {
    await del(url);
    return true;
  } catch (error) {
    console.error('Delete file error:', error);
    return false;
  }
}

export async function fileExists(url) {
  try {
    await head(url);
    return true;
  } catch {
    return false;
  }
    }
