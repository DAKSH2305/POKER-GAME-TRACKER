const express = require('express');
const router = express.Router();
const db = require('../database');

// Get all loans
router.get('/', async (req, res) => {
    try {
        const loans = await db.allAsync(`
            SELECT l.*, 
                   lender.name as lender_name,
                   borrower.name as borrower_name
            FROM loans l
            JOIN players lender ON l.lender_id = lender.id
            JOIN players borrower ON l.borrower_id = borrower.id
            ORDER BY l.created_at DESC
        `);
        
        const formattedLoans = loans.map(loan => ({
            id: loan.id,
            game: loan.game_id,
            lender: { id: loan.lender_id, name: loan.lender_name },
            borrower: { id: loan.borrower_id, name: loan.borrower_name },
            amount: loan.amount,
            repaid_amount: loan.repaid_amount,
            status: loan.status,
            date: loan.date,
            notes: loan.notes,
            created_at: loan.created_at
        }));
        
        res.json(formattedLoans);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Create new loan
router.post('/', async (req, res) => {
    try {
        const { gameId, lenderId, borrowerId, amount, date, notes } = req.body;
        // validate required fields
        if (!gameId || !lenderId || !borrowerId) {
            return res.status(400).json({ message: 'gameId, lenderId and borrowerId are required' });
        }
        const numericAmount = Number(amount);
        if (!amount || isNaN(numericAmount)) {
            return res.status(400).json({ message: 'Amount is required and must be a number' });
        }

        const result = await db.runAsync(
            "INSERT INTO loans (game_id, lender_id, borrower_id, amount, date, notes) VALUES (?, ?, ?, ?, ?, ?)",
            [gameId, lenderId, borrowerId, numericAmount, date, notes || '']
        );
        
        // Get the newly created loan with populated data
        const newLoan = await db.getAsync(`
            SELECT l.*, 
                   lender.name as lender_name,
                   borrower.name as borrower_name
            FROM loans l
            JOIN players lender ON l.lender_id = lender.id
            JOIN players borrower ON l.borrower_id = borrower.id
            WHERE l.id = ?
        `, [result.id]);
        
        const formattedLoan = {
            id: newLoan.id,
            game: newLoan.game_id,
            lender: { id: newLoan.lender_id, name: newLoan.lender_name },
            borrower: { id: newLoan.borrower_id, name: newLoan.borrower_name },
            amount: newLoan.amount,
            repaid_amount: newLoan.repaid_amount,
            status: newLoan.status,
            date: newLoan.date,
            notes: newLoan.notes,
            created_at: newLoan.created_at
        };
        
        res.status(201).json(formattedLoan);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Update loan
router.put('/:id', async (req, res) => {
    try {
        const { amount, status, notes, repaidAmount } = req.body;
        // Load existing loan to allow partial updates
        const existing = await db.getAsync("SELECT * FROM loans WHERE id = ?", [req.params.id]);
        if (!existing) return res.status(404).json({ message: 'Loan not found' });

        const finalAmount = (typeof amount !== 'undefined' && amount !== null && amount !== '') ? Number(amount) : existing.amount;
        if (finalAmount === null || typeof finalAmount === 'undefined' || isNaN(Number(finalAmount))) {
            return res.status(400).json({ message: 'Amount is required and must be a number' });
        }

        const finalStatus = (typeof status !== 'undefined' && status !== null) ? status : existing.status;
        const finalNotes = (typeof notes !== 'undefined' && notes !== null) ? notes : existing.notes;
        const finalRepaid = (typeof repaidAmount !== 'undefined' && repaidAmount !== null && repaidAmount !== '') ? Number(repaidAmount) : existing.repaid_amount || 0;

        await db.runAsync(
            "UPDATE loans SET amount = ?, status = ?, notes = ?, repaid_amount = ? WHERE id = ?",
            [finalAmount, finalStatus, finalNotes, finalRepaid, req.params.id]
        );
        
        const loan = await db.getAsync("SELECT * FROM loans WHERE id = ?", [req.params.id]);
        if (!loan) {
            return res.status(404).json({ message: 'Loan not found' });
        }
        
        res.json(loan);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Delete loan
router.delete('/:id', async (req, res) => {
    try {
        const result = await db.runAsync("DELETE FROM loans WHERE id = ?", [req.params.id]);
        if (result.changes === 0) {
            return res.status(404).json({ message: 'Loan not found' });
        }
        res.json({ message: 'Loan deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;