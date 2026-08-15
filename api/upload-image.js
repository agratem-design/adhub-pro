// Simple image upload API endpoint
// This would typically be implemented on your server

const fs = require('fs');
const path = require('path');
const formidable = require('formidable');

const ensureArrayValue = (value) => {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
};

const sanitizeSegment = (value) => String(value || '')
  .replace(/[^a-zA-Z0-9_.-]/g, '_')
  .replace(/_{2,}/g, '_')
  .replace(/^_+|_+$/g, '');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const form = new formidable.IncomingForm();
    form.keepExtensions = true;

    form.parse(req, (err, fields, files) => {
      if (err) {
        console.error('Upload error:', err);
        return res.status(500).json({ error: 'Upload failed' });
      }

      const fileField = files.image;
      const file = Array.isArray(fileField) ? fileField[0] : fileField;
      const requestedFileName = ensureArrayValue(fields.fileName);
      const requestedPath = ensureArrayValue(fields.path) || 'image';

      if (!file) {
        return res.status(400).json({ error: 'Missing file' });
      }

      const safeFileName = sanitizeSegment(requestedFileName || file.originalFilename || `upload-${Date.now()}`);
      if (!safeFileName) {
        return res.status(400).json({ error: 'Invalid file name' });
      }

      const safePathSegments = String(requestedPath)
        .split(/[\\/]/)
        .map(sanitizeSegment)
        .filter(Boolean);

      const uploadDir = path.join(process.cwd(), 'public', ...safePathSegments);

      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const newPath = path.join(uploadDir, safeFileName);

      fs.rename(file.filepath, newPath, (renameErr) => {
        if (renameErr) {
          console.error('File move error:', renameErr);
          return res.status(500).json({ error: 'Failed to save file' });
        }

        const publicPath = `/${safePathSegments.length ? safePathSegments.join('/') : 'image'}/${safeFileName}`;

        res.status(200).json({
          success: true,
          fileName: safeFileName,
          path: publicPath,
        });
      });
    });
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}
