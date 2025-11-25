const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const db = require('../backend/db');

// Configuration
const EXTRIMISTS_DIR = path.join(__dirname, '..', 'Extrimists');
const TEMP_DIR = path.join(__dirname, '..', 'temp_batch');

// Ensure temp dir exists
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Volapuk decoding functions (from parse_doc_v2.js)
const CP1251_MAP = {
    0xE0: 'а', 0xE1: 'б', 0xE2: 'в', 0xE3: 'г', 0xE4: 'д', 0xE5: 'е', 0xE6: 'ж', 0xE7: 'з',
    0xE8: 'и', 0xE9: 'й', 0xEA: 'к', 0xEB: 'л', 0xEC: 'м', 0xED: 'н', 0xEE: 'о', 0xEF: 'п',
    0xF0: 'р', 0xF1: 'с', 0xF2: 'т', 0xF3: 'у', 0xF4: 'ф', 0xF5: 'х', 0xF6: 'ц', 0xF7: 'ч',
    0xF8: 'ш', 0xF9: 'щ', 0xFA: 'ъ', 0xFB: 'ы', 0xFC: 'ь', 0xFD: 'э', 0xFE: 'ю', 0xFF: 'я'
};

function decodeChar(char) {
    const code = char.charCodeAt(0);
    if (code >= 0x30 && code <= 0x4F) {
        const cp1251Code = code + 0xB0;
        return CP1251_MAP[cp1251Code] || char;
    }
    return char;
}

function decodeVolapuk(text) {
    const parts = text.split(/(\s+)/);
    const decodedParts = parts.map(part => {
        if (!part.trim()) return part;

        let hasHighAscii = false;
        for (let i = 0; i < part.length; i++) {
            if (part.charCodeAt(i) > 0x4F) {
                hasHighAscii = true;
                break;
            }
        }
        if (hasHighAscii) return part;

        let isAllDigits = true;
        for (let i = 0; i < part.length; i++) {
            const c = part.charCodeAt(i);
            if (c < 0x30 || c > 0x39) {
                isAllDigits = false;
                break;
            }
        }

        if (isAllDigits) {
            if (part.length > 1) return part;
            if (part === '0' || part === '2' || part === '8' || part === '3') {
                // Decode
            } else {
                return part;
            }
        }

        let decoded = '';
        for (let i = 0; i < part.length; i++) {
            decoded += decodeChar(part[i]);
        }
        return decoded;
    });

    return decodedParts.join('');
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

function convertDocToText(docPath, txtPath) {
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
}

function parseText(text) {
    // Auto-detect format by trying both and seeing which yields results
    // Format A: "2891Принеслик" or "4480Павлович" (number DIRECTLY before Cyrillic)
    // Format B: "2\nТимощук\nВладислав" (number on own line, name on next line)

    // Try Format A first (inline) - but only if we have high-numbered entries
    const inlineRegex = /(\d{4})([А-ЯЁ][а-яё]{3,})/g;
    let inlineMatches = [];
    let match;

    while ((match = inlineRegex.exec(text)) !== null) {
        const num = parseInt(match[1], 10);
        // Only consider numbers >= 2000 (avoids most years)
        if (num >= 2000 && num <= 9999) {
            inlineMatches.push({
                number: match[1],
                index: match.index
            });
        }
    }

    // Try parsing with Format A if we have candidates
    let itemsA = [];
    if (inlineMatches.length > 0) {
        itemsA = parseFormatA(text, inlineMatches);
    }

    // If Format A worked well (got results), use it
    if (itemsA.length > 5) {
        console.log(`  Using Format A (inline): ${itemsA.length} entries`);
        return itemsA;
    }

    // Otherwise try Format B (multi-line)
    console.log('  Trying Format B (multi-line)...');
    const itemsB = parseFormatB(text);

    // Return whichever has more results
    if (itemsB.length > itemsA.length) {
        console.log(`  Using Format B: ${itemsB.length} entries`);
        return itemsB;
    } else if (itemsA.length > 0) {
        console.log(`  Using Format A: ${itemsA.length} entries`);
        return itemsA;
    }

    return [];
}

function parseFormatA(text, matches) {
    // Format A: "2891Фамилия Имя Отчество..."
    const items = [];

    for (let i = 0; i < matches.length; i++) {
        const currentMatch = matches[i];
        const nextMatch = matches[i + 1];

        const startIndex = currentMatch.index;
        // Extend end index to capture date and location after decision
        // Date comes after "Республики Беларусь", so we need more text
        const baseEndIndex = nextMatch ? nextMatch.index : text.length;
        const endIndex = Math.min(baseEndIndex + 100, text.length); // +100 chars overlap

        const entryText = text.substring(startIndex, endIndex).trim();

        // Extract person name - capture until we hit Latin capitals or specific keywords
        const nameMatch = entryText.match(/^\d{4}([А-ЯЁа-яё\s]{3,100}?)(?:[A-Z]{2,}|Республика|Вступивший)/);
        let personName = nameMatch ? nameMatch[1].trim() : '';
        personName = personName.replace(/\s+/g, ' ').trim();

        // If no name found, try simpler pattern - just get Cyrillic text after number
        if (!personName || personName.length < 5) {
            const simpleMatch = entryText.match(/^\d{4}([А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+)*)/);
            if (simpleMatch) {
                personName = simpleMatch[1].trim();
            }
        }

        // Extract court decision
        let courtDecision = '';
        let decisionDate = '';

        const decisionStart = entryText.indexOf('Вступивший в законную силу приговор');
        if (decisionStart !== -1) {
            const decisionPart = entryText.substring(decisionStart);

            // Find "Республики Беларусь" - the decision text ends there
            const belarusIndex = decisionPart.indexOf('Республики Беларусь');

            if (belarusIndex !== -1) {
                // Decision text is from start to end of "Республики Беларусь"
                const fullDecision = decisionPart.substring(0, belarusIndex + 'Республики Беларусь'.length);
                courtDecision = fullDecision.replace(/\s+/g, ' ').trim();

                // Now find the date that comes AFTER "Республики Беларусь"
                // This is the "дата включения в перечень"
                const afterBelarus = decisionPart.substring(belarusIndex + 'Республики Беларусь'.length);

                const dateMatch = afterBelarus.match(/(\d{2})\.(\d{2})\.(\d{4})/);
                if (dateMatch) {
                    decisionDate = dateMatch[0];
                }
            }
        }

        // Add date to decision if we have both
        if (courtDecision && decisionDate) {
            courtDecision += ` от ${decisionDate}`;
        }

        // Accept entry if we have name and court decision
        if (personName && personName.length > 5 && courtDecision) {
            items.push({
                content: personName,
                court_decision: courtDecision
            });
        }
    }

    return items;
}

function parseFormatB(text) {
    // Format B: Number on one line, name on following lines
    // Pattern:
    // 2
    // Тимощук
    // Владислав 
    // Сергеевич
    // ...
    // Вступивший в законную силу приговор...

    const items = [];
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Check if this line is a small number (entry number)
        if (/^\d{1,4}$/.test(line)) {
            const entryNum = parseInt(line, 10);

            // Skip if it's a year or too large
            if (entryNum > 1900 || entryNum === 0) continue;

            // Next lines should be: Фамилия, Имя, Отчество, Latin name, etc.
            let nameLines = [];
            let j = i + 1;

            // Collect name lines (until we hit UPPERCASE Latin or other marker)
            while (j < lines.length && j < i + 10) {
                const nextLine = lines[j].trim();

                // Stop at Latin name (all caps) or empty line or "Республика"
                if (!nextLine || /^[A-Z]{2,}/.test(nextLine) || nextLine.startsWith('Республика')) {
                    break;
                }

                // If it's Cyrillic, add to name
                if (/^[А-ЯЁ]/.test(nextLine)) {
                    nameLines.push(nextLine);
                    j++;
                } else {
                    break;
                }
            }

            if (nameLines.length >= 2) {
                const personName = nameLines.join(' ').trim();

                // Find court decision in the next ~20 lines
                let courtDecision = '';
                let decisionDate = '';

                for (let k = j; k < Math.min(j + 20, lines.length); k++) {
                    const checkLine = lines[k].trim();

                    if (checkLine.startsWith('Вступивший в законную силу приговор')) {
                        // Collect decision text (multiple lines)
                        let decisionLines = [checkLine];
                        let m = k + 1;

                        while (m < lines.length && m < k + 10) {
                            const decLine = lines[m].trim();

                            // Check if it's a date
                            if (/^\d{2}\.\d{2}\.\d{4}$/.test(decLine)) {
                                decisionDate = decLine;
                                break;
                            }

                            // Add to decision if it looks like part of it
                            if (decLine && (decLine.includes('Уголовного') || decLine.includes('Беларусь') || decLine.includes('статьи'))) {
                                decisionLines.push(decLine);
                            } else if (!decLine) {
                                // Empty line, likely end
                                break;
                            }

                            m++;
                        }

                        courtDecision = decisionLines.join(' ').replace(/\s+/g, ' ').trim();
                        break;
                    }
                }

                if (courtDecision && decisionDate) {
                    courtDecision += ` от ${decisionDate}`;
                }

                if (personName.length > 5 && courtDecision) {
                    items.push({
                        content: personName,
                        court_decision: courtDecision
                    });
                }
            }
        }
    }

    return items;
}

function processFile(docPath, sourceFilename) {
    console.log(`\n📄 Processing: ${sourceFilename}`);

    const fileHash = calculateFileHash(docPath);
    console.log(`  File hash: ${fileHash.substring(0, 16)}...`);

    // Check if already processed
    if (isFileProcessed(sourceFilename, fileHash)) {
        console.log(`  ✓ File already processed, skipping`);
        return { processed: false, skipped: true, newRecords: 0, duplicates: 0 };
    }

    const tempTxtPath = path.join(TEMP_DIR, `${path.basename(sourceFilename, '.doc')}.txt`);

    // Convert
    if (!convertDocToText(docPath, tempTxtPath)) {
        return { processed: false, skipped: false, error: 'Conversion failed', newRecords: 0, duplicates: 0 };
    }

    // Read and decode
    let text;
    try {
        text = fs.readFileSync(tempTxtPath, 'utf8'); // textutil outputs UTF-8, not UTF-16LE
    } catch (error) {
        console.error(`  Error reading converted file: ${error.message}`);
        return { processed: false, skipped: false, error: 'Read failed', newRecords: 0, duplicates: 0 };
    }

    // textutil already outputs properly decoded UTF-8 text
    let decodedText = text;

    // CRITICAL: Remove control characters (like BELL 0x07) that appear between numbers and names
    // Pattern: "2892\x07Мелестова" -> "2892Мелестова"
    decodedText = decodedText.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    // Post-processing fixes (just in case)
    decodedText = decodedText.replace(/\bешение\b/g, 'Решение');
    decodedText = decodedText.replace(/\bеспублика\b/g, 'Республика');

    // Parse
    console.log('  Parsing entries...');
    const entries = parseText(decodedText);
    console.log(`  Found ${entries.length} entries`);

    if (entries.length === 0) {
        console.log('  ⚠️  No entries found in file');
        fs.unlinkSync(tempTxtPath);
        return { processed: false, skipped: false, error: 'No entries', newRecords: 0, duplicates: 0 };
    }

    // Check for duplicates and insert new ones
    const existingRows = db.prepare('SELECT content FROM materials').all();
    const existingContent = new Set(existingRows.map(r => r.content));

    const newEntries = [];
    let duplicateCount = 0;

    for (const entry of entries) {
        if (!existingContent.has(entry.content)) {
            newEntries.push(entry);
            existingContent.add(entry.content); // Prevent intra-file duplicates
        } else {
            duplicateCount++;
        }
    }

    console.log(`  New entries: ${newEntries.length}, Duplicates: ${duplicateCount}`);

    // Insert into database
    if (newEntries.length > 0) {
        const insertStmt = db.prepare('INSERT INTO materials (content, court_decision, source_file) VALUES (?, ?, ?)');
        const transaction = db.transaction((items) => {
            for (const item of items) {
                insertStmt.run(item.content, item.court_decision, sourceFilename);
            }
        });
        transaction(newEntries);
        console.log(`  ✓ Inserted ${newEntries.length} new records`);
    }

    // Mark as processed
    markFileAsProcessed(sourceFilename, fileHash, newEntries.length);

    // Cleanup
    fs.unlinkSync(tempTxtPath);

    return {
        processed: true,
        skipped: false,
        newRecords: newEntries.length,
        duplicates: duplicateCount,
        totalEntries: entries.length
    };
}

function batchProcess() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  BATCH PROCESSING: Extremist Materials Documents');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');

    // Find all .doc and .xlsx files
    const files = fs.readdirSync(EXTREMISTS_DIR).filter(f => f.endsWith('.doc') || f.endsWith('.xlsx'));

    console.log(`Found ${files.length} files (.doc and .xlsx) in ${EXTREMISTS_DIR}`);
    console.log('');

    if (files.length === 0) {
        console.log('No .doc or .xlsx files to process. Exiting.');
        return;
    }

    const stats = {
        total: files.length,
        processed: 0,
        skipped: 0,
        errors: 0,
        totalNewRecords: 0,
        totalDuplicates: 0
    };

    files.forEach((filename, index) => {
        console.log(`\n[${index + 1}/${files.length}]`);
        const filePath = path.join(EXTRIMISTS_DIR, filename);

        const result = processFile(filePath, filename);

        if (result.skipped) {
            stats.skipped++;
        } else if (result.processed) {
            stats.processed++;
            stats.totalNewRecords += result.newRecords;
            stats.totalDuplicates += result.duplicates;
        } else {
            stats.errors++;
        }
    });

    // Final report
    console.log('\n\n═══════════════════════════════════════════════════════════');
    console.log('  BATCH PROCESSING COMPLETE');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Total files:        ${stats.total}`);
    console.log(`Processed:          ${stats.processed}`);
    console.log(`Skipped (already):  ${stats.skipped}`);
    console.log(`Errors:             ${stats.errors}`);
    console.log(`\nNew records added:  ${stats.totalNewRecords}`);
    console.log(`Duplicates found:   ${stats.totalDuplicates}`);

    const totalInDb = db.prepare('SELECT COUNT(*) as count FROM materials').get().count;
    console.log(`\nTotal in database:  ${totalInDb}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    // Cleanup temp directory
    try {
        fs.rmdirSync(TEMP_DIR);
    } catch (e) {
        // Directory not empty or doesn't exist, ignore
    }
}

// Run batch processing
if (require.main === module) {
    try {
        batchProcess();
    } catch (error) {
        console.error('\n❌ Fatal error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

module.exports = { batchProcess, processFile };
