const express = require('express');
const router = express.Router();
const db = require('../database');

// Get all games
router.get('/', async (req, res) => {
    try {
        const games = await db.allAsync("SELECT * FROM games ORDER BY created_at DESC");
        
        // Get players for each game
        const gamesWithPlayers = await Promise.all(games.map(async (game) => {
            const players = await db.allAsync(`
                SELECT p.id, p.name, p.image, gp.balance, gp.initial_balance as initialBalance
                FROM game_players gp 
                JOIN players p ON gp.player_id = p.id 
                WHERE gp.game_id = ?
            `, [game.id]);
            
            return {
                ...game,
                players: players
            };
        }));
        
        res.json(gamesWithPlayers);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get single game
router.get('/:id', async (req, res) => {
    try {
        const game = await db.getAsync("SELECT * FROM games WHERE id = ?", [req.params.id]);
        if (!game) {
            return res.status(404).json({ message: 'Game not found' });
        }
        
        // Get players for this game
        const players = await db.allAsync(`
            SELECT p.id, p.name, p.image, gp.balance, gp.initial_balance as initialBalance
            FROM game_players gp 
            JOIN players p ON gp.player_id = p.id 
            WHERE gp.game_id = ?
        `, [req.params.id]);
        
        res.json({ ...game, players });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Create new game
router.post('/', async (req, res) => {
    try {
        const { name, date, status, image, notes } = req.body;
        const result = await db.runAsync(
            "INSERT INTO games (name, date, status, image, notes) VALUES (?, ?, ?, ?, ?)",
            [name, date, status || 'active', image, notes || '']
        );
        const game = await db.getAsync("SELECT * FROM games WHERE id = ?", [result.id]);
        res.status(201).json({ ...game, players: [] });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Update game
router.put('/:id', async (req, res) => {
    try {
        const { name, date, status, image, notes } = req.body;
        await db.runAsync(
            "UPDATE games SET name = ?, date = ?, status = ?, image = ?, notes = ? WHERE id = ?",
            [name, date, status, image, notes, req.params.id]
        );
        
        const game = await db.getAsync("SELECT * FROM games WHERE id = ?", [req.params.id]);
        if (!game) {
            return res.status(404).json({ message: 'Game not found' });
        }
        
        res.json(game);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Add player to game
router.post('/:id/players', async (req, res) => {
    try {
        const { playerId, balance, initialBalance } = req.body;
        
        // Check if player already in game
        const existing = await db.getAsync(
            "SELECT * FROM game_players WHERE game_id = ? AND player_id = ?",
            [req.params.id, playerId]
        );
        
        if (existing) {
            return res.status(400).json({ message: 'Player already in game' });
        }
        
        await db.runAsync(
            "INSERT INTO game_players (game_id, player_id, balance, initial_balance) VALUES (?, ?, ?, ?)",
            [req.params.id, playerId, balance || 0, initialBalance || 0]
        );
        
        res.json({ message: 'Player added to game successfully' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Update player balance in game
router.put('/:id/players/:playerId/balance', async (req, res) => {
    try {
        const { balance } = req.body;
        await db.runAsync(
            "UPDATE game_players SET balance = ? WHERE game_id = ? AND player_id = ?",
            [balance, req.params.id, req.params.playerId]
        );
        
        res.json({ message: 'Player balance updated successfully' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Delete game
router.delete('/:id', async (req, res) => {
    try {
        const result = await db.runAsync("DELETE FROM games WHERE id = ?", [req.params.id]);
        if (result.changes === 0) {
            return res.status(404).json({ message: 'Game not found' });
        }
        res.json({ message: 'Game deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;