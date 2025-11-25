const db = require('../backend/db');

const stmt = db.prepare('SELECT * FROM materials LIMIT 5');
const rows = stmt.all();

console.log('First 5 entries:');
console.log(JSON.stringify(rows, null, 2));

const count = db.prepare('SELECT COUNT(*) as count FROM materials').get();
console.log(`Total entries: ${count.count}`);

const ftsCount = db.prepare('SELECT COUNT(*) as count FROM materials_fts').get();
console.log(`Total FTS entries: ${ftsCount.count}`);
