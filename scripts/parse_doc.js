const fs = require('fs');
const path = require('path');
const db = require('../backend/db');

// Path to the source text file. 
// We use 'raw_converted.txt' which was extracted using iconv -c from the original doc.
const filePath = path.join(__dirname, '..', 'raw_converted.txt');

// Helper: get last processed file size (bytes) from a meta table
function getLastProcessedSize() {
    try {
        const row = db.prepare('SELECT value FROM meta WHERE key = ?').get('lastFileSize');
        return row ? Number(row.value) : 0;
    } catch (e) {
        return 0;
    }
}

function setLastProcessedSize(size) {
    db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run('lastFileSize', size.toString());
}

// Ensure meta table exists
db.exec(`CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);`);

try {
    console.log('Reading file...');
    // Read as UTF-8
    const text = fs.readFileSync(filePath, 'utf8');
    console.log(`File read. Length: ${text.length} characters.`);

    // If the file hasn't grown since last run, skip processing
    // Note: For development/debugging, we might want to force run. 
    // Comment out the check below if you want to force re-parsing.
    /*
    const lastSize = getLastProcessedSize();
    if (buffer.length <= lastSize) {
        console.log('No new data since last run. Skipping parsing.');
        process.exit(0);
    }
    */

    const parser = require('../backend/parser');
    const entriesToInsert = parser.parseText(text);
    console.log(`Parsed ${entriesToInsert.length} granular entries.`);

    if (entriesToInsert.length > 0) {
        // Clear existing data and re‑populate
        console.log('Clearing old data...');
        db.exec('DELETE FROM materials');
        db.exec('DELETE FROM materials_fts');
        // Reset AUTOINCREMENT counter so IDs start from 1 again
        db.exec("DELETE FROM sqlite_sequence WHERE name='materials'");

        console.log('Inserting new data...');
        // Batch insert
        const insertStmt = db.prepare('INSERT INTO materials (content, court_decision) VALUES (?, ?)');
        const transaction = db.transaction((entries) => {
            for (const entry of entries) {
                insertStmt.run(entry.content, entry.court_decision);
            }
        });

        transaction(entriesToInsert);
        console.log('Data inserted successfully.');
    } else {
        console.log('No valid entries found to insert.');
    }

    // Store the processed file size for next incremental run
    const stats = fs.statSync(filePath);
    setLastProcessedSize(stats.size);
} catch (err) {
    console.error('Error:', err);
}
