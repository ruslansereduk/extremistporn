const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const testFile = process.argv[2] || 'Extrimists/4ab8275b29aa43909caa3353dc8f4576ed7206ad.doc';
const tempTxt = '/tmp/test_parse.txt';

console.log(`Testing parser on: ${testFile}\n`);

// Convert
execSync(`/usr/bin/textutil -convert txt -stdout "${testFile}" | cat > "${tempTxt}"`, {
    env: { ...process.env, LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8' }
});

// Read
const text = fs.readFileSync(tempTxt, 'utf8'); // textutil outputs UTF-8
console.log(`Read ${text.length} characters`);
console.log(`Has Cyrillic: ${/[а-яА-Я]/.test(text)}`);
console.log('\nFirst 500 characters:');
console.log(text.substring(0, 500));
console.log('\n---\n');

// Test regex for entry numbers
const entryRegex = /(\d{4,})[^\d]/g;
const matches = [];
let match;

while ((match = entryRegex.exec(text)) !== null) {
    matches.push({
        number: match[1],
        index: match.index
    });
}

console.log(`Found ${matches.length} potential entries`);
if (matches.length > 0) {
    console.log('First 5 entry numbers:', matches.slice(0, 5).map(m => m.number));

    // Show first entry
    const first = matches[0];
    const second = matches[1];
    const entryText = text.substring(first.index, second ? second.index : Math.min(first.index + 500, text.length));
    console.log('\nFirst entry text:');
    console.log(entryText);
}

fs.unlinkSync(tempTxt);
