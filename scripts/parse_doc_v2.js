const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const db = require('../backend/db');

// Configuration
const DOC_FILENAME = 'r0cgbemn4oriwhjmjepofzez1dxq9ci0.doc';
const DOC_PATH = path.join(__dirname, '..', DOC_FILENAME);

// Ensure meta table exists
db.exec(`
  CREATE VIRTUAL TABLE IF NOT EXISTS materials_fts USING fts5(content, court_decision, content='materials', content_rowid='id', tokenize='unicode61');
`);

function getLastProcessedSize() {
    const row = db.prepare('SELECT value FROM meta WHERE key = ?').get('lastFileSize');
    return row ? Number(row.value) : 0;
}

function setLastProcessedSize(size) {
    db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run('lastFileSize', size.toString());
}

// Mapping for "Volapuk" decoding (ASCII 0x30-0x4F -> CP1251 0xE0-0xFF)
// 0x30 ('0') -> 0xE0 ('а')
// ...
// 0x4F ('O') -> 0xFF ('я')
const CP1251_MAP = {
    0xE0: 'а', 0xE1: 'б', 0xE2: 'в', 0xE3: 'г', 0xE4: 'д', 0xE5: 'е', 0xE6: 'ж', 0xE7: 'з',
    0xE8: 'и', 0xE9: 'й', 0xEA: 'к', 0xEB: 'л', 0xEC: 'м', 0xED: 'н', 0xEE: 'о', 0xEF: 'п',
    0xF0: 'р', 0xF1: 'с', 0xF2: 'т', 0xF3: 'у', 0xF4: 'ф', 0xF5: 'х', 0xF6: 'ц', 0xF7: 'ч',
    0xF8: 'ш', 0xF9: 'щ', 0xFA: 'ъ', 0xFB: 'ы', 0xFC: 'ь', 0xFD: 'э', 0xFE: 'ю', 0xFF: 'я'
};

function decodeChar(char) {
    const code = char.charCodeAt(0);
    // Range check: 0x30 (48) to 0x4F (79)
    if (code >= 0x30 && code <= 0x4F) {
        const cp1251Code = code + 0xB0;
        return CP1251_MAP[cp1251Code] || char;
    }
    return char;
}

function decodeVolapuk(text) {
    // Split by whitespace to handle words individually
    // We use a regex that keeps delimiters so we can reconstruct the text
    const parts = text.split(/(\s+)/);

    const decodedParts = parts.map(part => {
        if (!part.trim()) return part; // Whitespace

        // Check if word contains "High" ASCII (> 0x4F)
        // If so, it's likely English/URL/Keyword -> Keep as is.
        // Exception: punctuation like `.` (0x2E) or `-` (0x2D) are < 0x4F but are valid in English.
        // But if a word has `T` (0x54), it's definitely English.
        // If a word has `a` (0x61), it's definitely English.

        let hasHighAscii = false;
        for (let i = 0; i < part.length; i++) {
            if (part.charCodeAt(i) > 0x4F) {
                hasHighAscii = true;
                break;
            }
        }

        if (hasHighAscii) {
            return part;
        }

        // Low ASCII block.
        // Check if it's a number.
        // Heuristic: If entirely digits 0-9 (0x30-0x39).
        let isAllDigits = true;
        for (let i = 0; i < part.length; i++) {
            const c = part.charCodeAt(i);
            if (c < 0x30 || c > 0x39) {
                isAllDigits = false;
                break;
            }
        }

        if (isAllDigits) {
            if (part.length > 1) return part; // "12", "2024" -> Keep
            // Single digit: "0" -> "а", "2" -> "в", "8" -> "и".
            // "3" -> "г" (maybe).
            // Others -> Keep?
            if (part === '0' || part === '2' || part === '8' || part === '3') {
                // Decode
            } else {
                return part; // Keep "1", "4", "5", "6", "7", "9"
            }
        }

        // Decode chars in range [0x30, 0x4F]
        let decoded = '';
        for (let i = 0; i < part.length; i++) {
            decoded += decodeChar(part[i]);
        }
        return decoded;
    });

    return decodedParts.join('');
}

function extractStrings(buffer, minLength = 4) {
    let strings = [];
    let currentString = '';

    for (let i = 0; i < buffer.length; i++) {
        const byte = buffer[i];
        // Check for printable ASCII (0x20 - 0x7E) AND Tab (0x09) AND Newline (0x0A, 0x0D)
        // Also include Volapuk range which is inside ASCII.
        if ((byte >= 0x20 && byte <= 0x7E) || byte === 0x09 || byte === 0x0A || byte === 0x0D) {
            currentString += String.fromCharCode(byte);
        } else {
            if (currentString.length >= minLength) {
                strings.push(currentString);
            }
            currentString = '';
        }
    }
    if (currentString.length >= minLength) {
        strings.push(currentString);
    }
    return strings.join('\n');
}

function parseDoc() {
    const inputPath = process.argv[2];

    if (!inputPath) {
        console.error('Usage: node parse_doc_v2.js <path_to_converted_text_file>');
        process.exit(1);
    }

    if (!fs.existsSync(inputPath)) {
        console.error(`File not found: ${inputPath}`);
        process.exit(1);
    }

    try {
        console.log(`Resolved input path: ${fs.realpathSync(inputPath)}`);
        const rawText = fs.readFileSync(inputPath, 'utf16le');
        console.log(`Read ${rawText.length} characters.`);

        // If textutil already decoded it, we don't need decodeVolapuk.
        // But let's check if it's still Volapuk.
        // If it contains Cyrillic, it's decoded.
        let decodedText = rawText;
        if (/[а-яА-Я]/.test(rawText)) {
            // console.log('Text appears to be already decoded (contains Cyrillic).');
        } else {
            console.log('Text does not contain Cyrillic. Trying decodeVolapuk...');
            decodedText = decodeVolapuk(rawText);
        }

        // Post-processing fixes
        decodedText = decodedText.replace(/\bешение\b/g, 'Решение');
        decodedText = decodedText.replace(/\bеспублика\b/g, 'Республика');

        processText(decodedText);

        // We can't easily track "last processed size" of the DOC file here since we are reading the TXT file.
        // But we can update the timestamp or something.
        // For now, we just run.

    } catch (error) {
        console.error('Error reading file:', error.message);
        process.exit(1);
    }
}

function processText(text) {
    // Regex to find decision blocks.
    // Patterns observed:
    // "Решение суда ... от DD Month YYYY года"
    // "Суд ... от DD Month YYYY года"
    // "Постановление ... от DD Month YYYY года"

    // We look for the keyword, followed by some text (non-greedy), then "от", date, and "года".
    const decisionRegex = /(?:Решение суда|Суд|Постановление)[\s\S]*?от\s+\d{1,2}\s+[а-я]+\s+\d{4}\s+года\.?/gi;

    let match;
    let lastIndex = 0;
    const items = [];

    while ((match = decisionRegex.exec(text)) !== null) {
        const decisionBlock = match[0];
        const startIndex = match.index;

        // Content is between lastIndex and startIndex
        let content = text.substring(lastIndex, startIndex).trim();

        // Clean up content
        // Remove "HYPERLINK" artifacts
        content = content.replace(/HYPERLINK\s+"[^"]+"/g, '');
        // Remove garbage lines (short lines that are likely noise from binary extraction)
        // But be careful not to remove short URLs.
        // Maybe just collapse whitespace.
        content = content.replace(/\s+/g, ' ').trim();

        const decision = decisionBlock.replace(/\s+/g, ' ').trim();

        if (content && content.length > 5) { // Filter out noise
            items.push({
                content: content,
                court_decision: decision
            });
        }

        lastIndex = decisionRegex.lastIndex;
    }

    // Handle trailing content? Usually last item ends with decision.

    console.log(`Parsed ${items.length} entries.`);

    if (items.length > 0) {
        updateDatabase(items);
    } else {
        console.log('No entries found. Check regex or file format.');
    }
}

function updateDatabase(entries) {
    console.log('Updating database...');

    const insertStmt = db.prepare('INSERT INTO materials (content, court_decision) VALUES (?, ?)');

    const transaction = db.transaction((items) => {
        db.prepare('DELETE FROM materials').run();
        // db.prepare('DELETE FROM materials_fts').run(); // Triggers handle this

        for (const item of items) {
            insertStmt.run(item.content, item.court_decision);
        }
    });

    if (entries.length > 0) {
        console.log('First parsed item:', entries[0]);
    }

    transaction(entries);
    console.log('Database updated successfully.');
}

parseDoc();
