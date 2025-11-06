const express = require('express');
const router = express.Router();
const db = require('../database');
const path = require('path');
const multer = require('multer');

// Configure multer to store uploads in public/uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '..', 'public', 'uploads'));
    },
    filename: function (req, file, cb) {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
        // keep original extension
        const ext = path.extname(file.originalname);
        cb(null, `${unique}${ext}`);
    }
});
const upload = multer({ storage });

// Get all players
router.get('/', async (req, res) => {
    try {
        const players = await db.allAsync("SELECT * FROM players ORDER BY created_at DESC");
        res.json(players);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Accept multipart/form-data (file upload) or JSON body
router.post('/', upload.single('image'), async (req, res) => {
    try {
        const { name } = req.body;
        if (!name || String(name).trim() === '') {
            return res.status(400).json({ message: 'Name is required' });
        }
        // Prevent duplicate names (case-insensitive)
        const existingSame = await db.getAsync("SELECT * FROM players WHERE LOWER(name) = LOWER(?)", [String(name).trim()]);
        if (existingSame) {
            return res.status(409).json({ message: 'A player with that name already exists' });
        }
        let imagePath = null;

        if (req.file) {
            // saved under public/uploads
            imagePath = `/uploads/${req.file.filename}`;
        } else if (req.body.image) {
            imagePath = req.body.image;
        }

        const result = await db.runAsync(
            "INSERT INTO players (name, image) VALUES (?, ?)",
            [name, imagePath]
        );
        const player = await db.getAsync("SELECT * FROM players WHERE id = ?", [result.id]);
        res.status(201).json(player);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Get single player
router.get('/:id', async (req, res) => {
    try {
        const player = await db.getAsync("SELECT * FROM players WHERE id = ?", [req.params.id]);
        if (!player) {
            return res.status(404).json({ message: 'Player not found' });
        }
        res.json(player);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Accept multipart/form-data (file upload) or JSON body. Support removeImage flag.
router.put('/:id', upload.single('image'), async (req, res) => {
    try {
        const existing = await db.getAsync("SELECT * FROM players WHERE id = ?", [req.params.id]);
        if (!existing) return res.status(404).json({ message: 'Player not found' });

        const { name } = req.body;
        let imagePath = existing.image;

        if (req.body.removeImage === 'true' || req.body.removeImage === true) {
            imagePath = null;
        }

        if (req.file) {
            imagePath = `/uploads/${req.file.filename}`;
        } else if (req.body.image && req.body.image !== existing.image) {
            imagePath = req.body.image;
        }

        if (typeof name !== 'undefined' && name !== null && String(name).trim() === '') {
            return res.status(400).json({ message: 'Name cannot be empty' });
        }
        const finalName = (typeof name === 'undefined' || name === null) ? existing.name : String(name).trim();

        // If the name changed, ensure it doesn't collide with another player's name (case-insensitive)
        if (finalName && String(finalName).toLowerCase() !== String(existing.name || '').toLowerCase()) {
            const conflict = await db.getAsync("SELECT * FROM players WHERE LOWER(name) = LOWER(?) AND id != ?", [finalName, req.params.id]);
            if (conflict) {
                return res.status(409).json({ message: 'A player with that name already exists' });
            }
        }

        await db.runAsync(
            "UPDATE players SET name = ?, image = ? WHERE id = ?",
            [finalName, imagePath, req.params.id]
        );

        const player = await db.getAsync("SELECT * FROM players WHERE id = ?", [req.params.id]);
        res.json(player);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Delete player
router.delete('/:id', async (req, res) => {
    try {
        const result = await db.runAsync("DELETE FROM players WHERE id = ?", [req.params.id]);
        if (result.changes === 0) {
            return res.status(404).json({ message: 'Player not found' });
        }
        res.json({ message: 'Player deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;