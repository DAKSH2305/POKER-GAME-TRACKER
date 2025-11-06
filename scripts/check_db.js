// scripts/check_db.js
const db = require('../database');

(async () => {
  try {
    console.log('Checking loans with NULL amount...');
    const nullLoans = await db.allAsync('SELECT id, game_id, lender_id, borrower_id, amount FROM loans WHERE amount IS NULL');
    console.log('NULL loans:', nullLoans.length);
    if (nullLoans.length) console.table(nullLoans);

    console.log('\\nChecking duplicate player names (case-insensitive)...');
    const dupQuery = `
      SELECT LOWER(name) as lname, GROUP_CONCAT(id) as ids, COUNT(*) as cnt
      FROM players
      GROUP BY lname
      HAVING cnt > 1
    `;
    const dups = await db.allAsync(dupQuery);
    console.log('Duplicate name groups:', dups.length);
    if (dups.length) console.table(dups);

    process.exit(0);
  } catch (err) {
    console.error('Error checking DB:', err);
    process.exit(1);
  }
})();