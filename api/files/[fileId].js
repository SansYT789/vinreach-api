import { db } from '../../lib/database.js';
import { setCORS, sendJSON, sendError } from '../../lib/helpers.js';
import { parseMultipart, uploadFile, deleteFile } from '../../lib/storage.js';

export default async function handler(req, res) {
  setCORS(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { fileId } = req.query;

  // GET - Retrieve file
  if (req.method === 'GET') {
    try {
      const file = await db.findById('files', fileId);

      if (!file) {
        return sendError(res, 'File not found', 404);
      }

      // Check expiration
      if (file.expiredAt && Date.now() > file.expiredAt) {
        await deleteFile(file.blobUrl);
        await db.delete('files', fileId);
        return sendError(res, 'File expired', 410);
      }

      // Redirect to blob URL
      return res.redirect(file.blobUrl);
    } catch (error) {
      console.error('Get file error:', error);
      return sendError(res, 'Failed to fetch file', 500);
    }
  }

  // PATCH - Update file
  if (req.method === 'PATCH') {
    try {
      const file = await db.findById('files', fileId);

      if (!file) {
        return sendError(res, 'File not found', 404);
      }

      const { file: uploadedFile } = await parseMultipart(req);

      if (!uploadedFile) {
        return sendError(res, 'No file uploaded');
      }

      // Delete old file
      await deleteFile(file.blobUrl);

      // Upload new file
      const { url, size } = await uploadFile(uploadedFile);

      // Update database
      const updated = await db.update('files', fileId, {
        filename: uploadedFile.filename,
        original_name: uploadedFile.filename,
        blob_url: url,
        mimetype: uploadedFile.mimeType,
        size,
        updated_at: Date.now()
      });

      return sendJSON(res, {
        message: 'File updated',
        fileId,
        url: `/api/files/${fileId}`
      });
    } catch (error) {
      console.error('Update file error:', error);
      return sendError(res, error.message || 'Failed to update file', 500);
    }
  }

  // DELETE - Delete file
  if (req.method === 'DELETE') {
    try {
      const file = await db.findById('files', fileId);

      if (!file) {
        return sendError(res, 'File not found', 404);
      }

      await deleteFile(file.blobUrl);
      await db.delete('files', fileId);

      return sendJSON(res, { message: 'File deleted' });
    } catch (error) {
      console.error('Delete file error:', error);
      return sendError(res, 'Failed to delete file', 500);
    }
  }

  return sendError(res, 'Method not allowed', 405);
}