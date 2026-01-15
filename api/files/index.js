import { db, randomId } from '../../lib/database.js';
import { setCORS, sendJSON, sendError } from '../../lib/helpers.js';
import { parseMultipart, uploadFile } from '../../lib/storage.js';

export default async function handler(req, res) {
  setCORS(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // POST - Upload file
  if (req.method === 'POST') {
    try {
      const { file, fields } = await parseMultipart(req);

      if (!file) {
        return sendError(res, 'No file uploaded', 400);
      }

      const { expiredAt } = fields;
      const id = randomId();

      // Upload to Vercel Blob
      const { url, size } = await uploadFile(file, { expiredAt });

      // Save to database
      const fileData = {
        id,
        filename: file.filename,
        original_name: file.filename,
        blob_url: url,
        mimetype: file.mimeType,
        size,
        uploaded_at: Date.now(),
        ...(expiredAt && { expired_at: parseInt(expiredAt) })
      };

      await db.create('files', fileData);

      return sendJSON(res, {
        message: 'File uploaded',
        fileId: id,
        url: `/api/files/${id}`
      }, 201);
    } catch (error) {
      console.error('Upload file error:', error);
      return sendError(res, error.message || 'Failed to upload file', 500);
    }
  }

  return sendError(res, 'Method not allowed', 405);
}
