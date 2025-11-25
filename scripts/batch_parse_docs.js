const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const db = require('../backend/db');
const XLSX = require('xlsx');

// Configuration
const EXTRIMISTS_DIR = path.join(__dirname, '..', 'Extrimists');
const TEMP_DIR = path.join(__dirname, '..', 'temp_batch');

// Ensure temp dir exists
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

function calculateFileHash(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
}

function isFileProcessed(filename, fileHash) {
    const row = db.prepare('SELECT * FROM processed_files WHERE filename = ? AND file_hash = ?').get(filename, fileHash);
    return row !== undefined;
}

function markFileAsProcessed(filename, fileHash, recordsCount) {
    db.prepare('INSERT OR REPLACE INTO processed_files (filename, file_hash, records_count) VALUES (?, ?, ?)')
        .run(filename, fileHash, recordsCount);
}

// Parse XLSX files
function parseXLSX(xlsxPath, sourceFilename) {
    console.log(`  Parsing ${sourceFilename}...`);

    const workbook = XLSX.readFile(xlsxPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convert to array of arrays
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    const entries = [];

    // Skip header rows (usually first 2 rows)
    for (let i = 2; i < data.length; i++) {
        const row = data[i];

        if (!row || row.length < 6) continue;

        // Columns (based on the structure we saw):
        // 0: № п/п
        // 1: Наименование организации/ФИО
        // 2: Транслитерация
        // 3: Ссылка на ресурс
        // 4: Адрес/ссылка
        // 5: Основание для включения
        // 6: Дата вступления
        // 7: Дата включения

        const name = row[1]; // Наименование
        const basis = row[5]; // Основание
        const effectiveDate = row[6]; // Дата вступления
        const includeDate = row[7]; // Дата включения

        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            continue;
        }

        // Build court decision text
        let courtDecision = '';
        if (basis) {
            courtDecision = String(basis).trim();

            // Add date if available
            if (includeDate) {
                const dateStr = excelDateToString(includeDate);
                if (dateStr) {
                    courtDecision += ` от ${dateStr}`;
                }
            }
        }

        if (courtDecision) {
            entries.push({
                content: String(name).trim(),
                court_decision: courtDecision
            });
        }
    }

    console.log(`  Found ${entries.length} entries from XLSX`);
    return entries;
}

// Helper to convert Excel date serial to DD.MM.YYYY
function excelDateToString(serial) {
    if (typeof serial === 'string') {
        // Already a string, check if it's a date
        if (serial.match(/\d{2}\.\d{2}\.\d{4}/)) {
            return serial;
        }
        return null;
    }

    if (typeof serial !== 'number') return null;

    // Excel epoch is 1900-01-01, but actually 1899-12-30 due to bug
    const epoch = new Date(1899, 11, 30);
    const date = new Date(epoch.getTime() + serial * 24 * 60 * 60 * 1000);

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    return `${day}.${month}.${year}`;
}

// Process XLSX file
function processXLSXFile(xlsxPath, sourceFilename) {
    try {
        const fileHash = calculateFileHash(xlsxPath);

        if (isFileProcessed(sourceFilename, fileHash)) {
            console.log(`  ✓ File already processed, skipping`);
            stats.skipped++;
            return;
        }

        const entries = parseXLSX(xlsxPath, sourceFilename);

        // Check for duplicates and insert
        const insertStmt = db.prepare('INSERT INTO materials (content, court_decision, source_file) VALUES (?, ?, ?)');
        const checkStmt = db.prepare('SELECT id FROM materials WHERE content = ? AND court_decision = ? LIMIT 1');

        let newCount = 0;
        let dupCount = 0;

        for (const entry of entries) {
            const existing = checkStmt.get(entry.content, entry.court_decision);
            if (!existing) {
                insertStmt.run(entry.content, entry.court_decision, sourceFilename);
                newCount++;
            } else {
                dupCount++;
            }
        }

        console.log(`  New entries: ${newCount}, Duplicates: ${dupCount}`);

        if (newCount > 0) {
            console.log(`  ✓ Inserted ${newCount} new records`);
        }

        markFileAsProcessed(sourceFilename, fileHash, newCount);

        stats.processed++;
        stats.newRecords += newCount;
        stats.duplicates += dupCount;

    } catch (error) {
        console.error(`  ✗ Error processing ${sourceFilename}:`, error.message);
        stats.errors++;
    }
}

// Process DOC file (existing function - keeping it as is)
function processDocFile(docPath, sourceFilename) {
    // ... existing DOC processing code ...
    const convertDocToText = (docPath, txtPath) => {
        console.log(`  Converting ${path.basename(docPath)} to text...`);
        try {
            execSync(`/usr/bin/textutil -convert txt -stdout "${docPath}" | cat > "${txtPath}"`, {
                env: { ...process.env, LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8' }
            });
            return true;
        } catch (error) {
            console.error(`  Conversion failed: ${error.message}`);
            return false;
        }
    };

    const parseText = (text) => {
        // Remove control characters
        text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

        // Auto-detect format
        const inlineRegex = /(\d{4})([А-ЯЁ][а-яё]{3,})/g;
        let inlineMatches = [];
        let match;

        while ((match = inlineRegex.exec(text)) !== null) {
            const num = parseInt(match[1], 10);
            if (num >= 2000 && num <= 9999) {
                inlineMatches.push({
                    number: match[1],
                    index: match.index
                });
            }
        }

        let itemsA = [];
        if (inlineMatches.length > 0) {
            itemsA = parseFormatA(text, inlineMatches);
        }

        if (itemsA.length > 5) {
            console.log(`  Using Format A (inline): ${itemsA.length} entries`);
            return itemsA;
        }

        console.log('  Trying Format B (multi-line)...');
        const itemsB = parseFormatB(text);

        if (itemsB.length > itemsA.length) {
            console.log(`  Using Format B: ${itemsB.length} entries`);
            return itemsB;
        } else if (itemsA.length > 0) {
            console.log(`  Using Format A: ${itemsA.length} entries`);
            return itemsA;
        }

        return [];
    };

    const parseFormatA = (text, matches) => {
        const items = [];

        for (let i = 0; i < matches.length; i++) {
            const currentMatch = matches[i];
            const nextMatch = matches[i + 1];

            const startIndex = currentMatch.index;
            const baseEndIndex = nextMatch ? nextMatch.index : text.length;
            const endIndex = Math.min(baseEndIndex + 100, text.length);

            const entryText = text.substring(startIndex, endIndex).trim();

            const nameMatch = entryText.match(/^\d{4}([А-ЯЁа-яё\s]{3,100}?)(?:[A-Z]{2,}|Республика|Вступивший)/);
            let personName = nameMatch ? nameMatch[1].trim() : '';
            personName = personName.replace(/\s+/g, ' ').trim();

            if (!personName || personName.length < 5) {
                const simpleMatch = entryText.match(/^\d{4}([А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+)*)/);
                if (simpleMatch) {
                    personName = simpleMatch[1].trim();
                }
            }

            let courtDecision = '';
            let decisionDate = '';

            const decisionStart = entryText.indexOf('Вступивший в законную силу приговор');
            if (decisionStart !== -1) {
                const decisionPart = entryText.substring(decisionStart);
                const belarusIndex = decisionPart.indexOf('Республики Беларусь');

                if (belarusIndex !== -1) {
                    const fullDecision = decisionPart.substring(0, belarusIndex + 'Республики Беларусь'.length);
                    courtDecision = fullDecision.replace(/\s+/g, ' ').trim();

                    const afterBelarus = decisionPart.substring(belarusIndex + 'Республики Беларусь'.length);
                    const dateMatch = afterBelarus.match(/(\d{2})\.(\d{2})\.(\d{4})/);
                    if (dateMatch) {
                        decisionDate = dateMatch[0];
                    }
                }
            }

            if (courtDecision && decisionDate) {
                courtDecision += ` от ${decisionDate}`;
            }

            if (personName && personName.length > 5 && courtDecision) {
                items.push({
                    content: personName,
                    court_decision: courtDecision
                });
            }
        }

        return items;
    };

    const parseFormatB = (text) => {
        const items = [];
        const lines = text.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            const numMatch = line.match(/^(\d{1,4})$/);

            if (numMatch) {
                const num = parseInt(numMatch[1], 10);
                if (num < 1 || num > 9999 || (num >= 1900 && num <= 2100)) {
                    continue;
                }

                const nameLines = [];
                let j = i + 1;
                while (j < lines.length && j < i + 10) {
                    const nextLine = lines[j].trim();
                    if (!nextLine) { j++; continue; }
                    if (nextLine.match(/^\d{1,4}$/)) break;
                    if (nextLine.match(/^[А-ЯЁ][а-яё]/)) {
                        nameLines.push(nextLine);
                        j++;
                    } else {
                        break;
                    }
                }

                if (nameLines.length === 0) continue;

                const personName = nameLines.join(' ').replace(/\s+/g, ' ').trim();

                const blockText = lines.slice(i, Math.min(i + 50, lines.length)).join(' ');
                const decisionMatch = blockText.match(/(Вступивший в законную силу приговор[^]+?Республики Беларусь)/);
                let courtDecision = '';

                if (decisionMatch) {
                    courtDecision = decisionMatch[1].replace(/\s+/g, ' ').trim();

                    const afterDecision = blockText.substring(blockText.indexOf(courtDecision) + courtDecision.length);
                    const dateMatch = afterDecision.match(/(\d{2})\.(\d{2})\.(\d{4})/);
                    if (dateMatch) {
                        courtDecision += ` от ${dateMatch[0]}`;
                    }
                }

                if (personName && personName.length > 5 && courtDecision) {
                    items.push({
                        content: personName,
                        court_decision: courtDecision
                    });
                }
            }
        }

        return items;
    };

    try {
        const fileHash = calculateFileHash(docPath);

        if (isFileProcessed(sourceFilename, fileHash)) {
            console.log(`  ✓ File already processed, skipping`);
            stats.skipped++;
            return;
        }

        const tempTxtPath = path.join(TEMP_DIR, `${path.basename(docPath, '.doc')}.txt`);

        if (!convertDocToText(docPath, tempTxtPath)) {
            stats.errors++;
            return;
        }

        console.log(`  Parsing entries...`);
        let rawText = fs.readFileSync(tempTxtPath, 'utf8');

        const entries = parseText(rawText);
        console.log(`  Found ${entries.length} entries`);

        if (entries.length === 0) {
            console.log(`  ⚠ No entries found`);
            fs.unlinkSync(tempTxtPath);
            return;
        }

        const insertStmt = db.prepare('INSERT INTO materials (content, court_decision, source_file) VALUES (?, ?, ?)');
        const checkStmt = db.prepare('SELECT id FROM materials WHERE content = ? AND court_decision = ? LIMIT 1');

        let newCount = 0;
        let dupCount = 0;

        for (const entry of entries) {
            const existing = checkStmt.get(entry.content, entry.court_decision);
            if (!existing) {
                insertStmt.run(entry.content, entry.court_decision, sourceFilename);
                newCount++;
            } else {
                dupCount++;
            }
        }

        console.log(`  New entries: ${newCount}, Duplicates: ${dupCount}`);

        if (newCount > 0) {
            console.log(`  ✓ Inserted ${newCount} new records`);
        }

        markFileAsProcessed(sourceFilename, fileHash, newCount);
        fs.unlinkSync(tempTxtPath);

        stats.processed++;
        stats.newRecords += newCount;
        stats.duplicates += dupCount;

    } catch (error) {
        console.error(`  ✗ Error processing ${sourceFilename}:`, error.message);
        stats.errors++;
    }
}

// Main batch processing
const stats = {
    total: 0,
    processed: 0,
    skipped: 0,
    errors: 0,
    newRecords: 0,
    duplicates: 0
};

function batchProcess() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  BATCH PROCESSING: Extremist Materials Documents');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');

    const files = fs.readdirSync(EXTRIMISTS_DIR).filter(f => f.endsWith('.doc') || f.endsWith('.xlsx'));

    console.log(`Found ${files.length} files (.doc and .xlsx) in ${EXTRIMISTS_DIR}`);
    console.log('');

    if (files.length === 0) {
        console.log('No files to process. Exiting.');
        return;
    }

    stats.total = files.length;

    files.forEach((filename, index) => {
        console.log(`\n[${index + 1}/${files.length}]\n`);
        console.log(`📄 Processing: ${filename}`);

        const filePath = path.join(EXTRIMISTS_DIR, filename);
        const fileHash = calculateFileHash(filePath);
        console.log(`  File hash: ${fileHash.substring(0, 16)}...`);

        if (filename.endsWith('.xlsx')) {
            processXLSXFile(filePath, filename);
        } else if (filename.endsWith('.doc')) {
            processDocFile(filePath, filename);
        }
    });

    console.log('\n\n═══════════════════════════════════════════════════════════');
    console.log('  BATCH PROCESSING COMPLETE');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Total files:        ${stats.total}`);
    console.log(`Processed:          ${stats.processed}`);
    console.log(`Skipped (already):  ${stats.skipped}`);
    console.log(`Errors:             ${stats.errors}`);
    console.log('');
    console.log(`New records added:  ${stats.newRecords}`);
    console.log(`Duplicates found:   ${stats.duplicates}`);
    console.log('');

    const totalDB = db.prepare('SELECT COUNT(*) as count FROM materials').get();
    console.log(`Total in database:  ${totalDB.count}`);
    console.log('═══════════════════════════════════════════════════════════');
}

// Run batch processing
batchProcess();
