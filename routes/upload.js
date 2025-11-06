const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');

// Configure multer storage to public/uploads (same as players)
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '..', 'public', 'uploads'));
    },
    filename: function (req, file, cb) {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `${unique}${ext}`);
    }
});
const upload = multer({ storage });

// Single file upload endpoint. Returns { path: '/uploads/filename' }
router.post('/', upload.single('file'), (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
        const filePath = `/uploads/${req.file.filename}`;
        res.json({ path: filePath });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
