const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');
const db = require('./db');
const parser = require('./parser');

const DOC_URL = 'http://mininform.gov.by/upload/iblock/446/r0cgbemn4oriwhjmjepofzez1dxq9ci0.doc'; // Direct .doc file link
// Page URL for reference: http://mininform.gov.by/documents/respublikanskiy-spisok-ekstremistskikh-materialov/
const TEMP_DIR = path.join(__dirname, '..', 'temp_update');
const DOC_PATH = path.join(TEMP_DIR, 'update.doc');
const TXT_PATH = path.join(TEMP_DIR, 'update.txt');

// Ensure temp dir exists
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR);
}

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        // Handle http/https based on protocol, but URL is http
        const http = require('http');
        http.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download file: ${response.statusCode}`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close(resolve);
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => { });
            reject(err);
        });
    });
}

async function updateData() {
    const startTime = new Date().toISOString();
    console.log(`[${startTime}] Starting update process...`);

    // Record update start
    const statusId = db.prepare(`
        INSERT INTO update_status (source_id, source_name, status)
        VALUES (?, ?, ?)
    `).run('mininform_materials', 'Министерство информации', 'running').lastInsertRowid;

    try {
        // 1. Download
        console.log('Downloading .doc file...');
        await downloadFile(DOC_URL, DOC_PATH);
        console.log('Download complete.');

        // 2. Convert
        console.log('Converting to text...');
        try {
            execSync(`iconv -f UTF-16LE -t UTF-8 -c "${DOC_PATH}" > "${TXT_PATH}"`);
        } catch (err) {
            console.error('Conversion failed:', err.message);
            throw err;
        }
        console.log('Conversion complete.');

        // 3. Parse
        console.log('Parsing text...');
        const text = fs.readFileSync(TXT_PATH, 'utf8');
        const newEntries = parser.parseText(text);
        console.log(`Parsed ${newEntries.length} entries.`);

        if (newEntries.length === 0) {
            console.log('No entries parsed. Aborting update.');

            // Update status to error
            db.prepare(`
                UPDATE update_status 
                SET status = 'error', completed_at = CURRENT_TIMESTAMP, error_message = ?
                WHERE id = ?
            `).run('No entries parsed from file', statusId);

            return;
        }

        // 4. Update DB and find new items
        const existingRows = db.prepare('SELECT content FROM materials').all();
        const existingContent = new Set(existingRows.map(r => r.content));

        const itemsToAdd = [];
        const newItemsLog = [];

        for (const entry of newEntries) {
            if (!existingContent.has(entry.content)) {
                itemsToAdd.push(entry);
                newItemsLog.push(entry);
            }
        }

        console.log(`Found ${itemsToAdd.length} new items.`);

        if (itemsToAdd.length > 0) {
            const insertStmt = db.prepare('INSERT INTO materials (content, court_decision) VALUES (?, ?)');
            const transaction = db.transaction((items) => {
                for (const item of items) {
                    insertStmt.run(item.content, item.court_decision);
                }
            });
            transaction(itemsToAdd);
            console.log('New items inserted into database.');

            // Log update to updates_log
            const totalItems = db.prepare('SELECT COUNT(*) as count FROM materials').get().count;
            db.prepare('INSERT INTO updates_log (items_added, total_items) VALUES (?, ?)').run(itemsToAdd.length, totalItems);

            // Log new items to a file
            const logPath = path.join(__dirname, '..', 'new_items.log');
            const logContent = newItemsLog.map(i => `[${new Date().toISOString()}] ${i.content} (${i.court_decision})`).join('\n') + '\n';
            fs.appendFileSync(logPath, logContent);
            console.log(`New items logged to ${logPath}`);

            // Store new items as JSON in update_status for display
            const newItemsJson = JSON.stringify(newItemsLog.slice(0, 50)); // Store first 50 only

            // Update status to success
            db.prepare(`
                UPDATE update_status 
                SET status = 'success', completed_at = CURRENT_TIMESTAMP, items_added = ?, items_total = ?, error_message = ?
                WHERE id = ?
            `).run(itemsToAdd.length, totalItems, newItemsJson, statusId);
        } else {
            console.log('No new items to add.');

            // Update status to success (0 new items)
            const totalItems = db.prepare('SELECT COUNT(*) as count FROM materials').get().count;
            db.prepare(`
                UPDATE update_status 
                SET status = 'success', completed_at = CURRENT_TIMESTAMP, items_added = 0, items_total = ?
                WHERE id = ?
           `).run(totalItems, statusId);
        }

    } catch (err) {
        console.error('Update failed:', err);

        // Update status to error
        db.prepare(`
            UPDATE update_status 
            SET status = 'error', completed_at = CURRENT_TIMESTAMP, error_message = ?
            WHERE id = ?
        `).run(err.message, statusId);
    } finally {
        // Cleanup
        if (fs.existsSync(DOC_PATH)) fs.unlinkSync(DOC_PATH);
        if (fs.existsSync(TXT_PATH)) fs.unlinkSync(TXT_PATH);
        // Remove temp dir if empty
        try { fs.rmdirSync(TEMP_DIR); } catch (e) { }
        console.log(`[${new Date().toISOString()}] Update process finished.`);
    }
}

module.exports = { updateData };

if (require.main === module) {
    updateData();
}
