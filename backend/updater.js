const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');
const db = require('./db');
const parser = require('./parser');

const DOC_URL = 'http://mininform.gov.by/upload/iblock/446/r0cgbemn4oriwhjmjepofzez1dxq9ci0.doc';
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
    console.log(`[${new Date().toISOString()}] Starting update process...`);

    try {
        // 1. Download
        console.log('Downloading .doc file...');
        await downloadFile(DOC_URL, DOC_PATH);
        console.log('Download complete.');

        // 2. Convert
        console.log('Converting to text...');
        try {
            // Use iconv -c to ignore invalid characters, similar to our manual fix
            // We pipe the file content through iconv
            // Note: iconv expects input file or stdin. 
            // Command: iconv -f UTF-16LE -t UTF-8 -c input.doc > output.txt
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
            return;
        }

        // 4. Update DB and find new items
        // We need to compare with existing data.
        // Strategy: Get all existing content hashes or just content strings.
        // Since we want to log *new* items, we should check existence before inserting.
        // However, for performance with 10k items, we can use a Set.

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
        } else {
            console.log('No new items to add.');
        }

        // Optional: Full sync? 
        // If we want to remove deleted items, we would need to do a full replace or diff.
        // The request says "add new materials", implying append-only or sync.
        // For now, we just add new ones. If the source removes items, we keep them (safer for history).

    } catch (err) {
        console.error('Update failed:', err);
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
