const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, '..', 'final_text.txt');

const buffer = fs.readFileSync(filePath);
console.log('First 50 bytes (hex):', buffer.subarray(0, 50).toString('hex'));

// Search for pattern "5 H 5" which corresponds to "Решение"
// 5 (53), H (72), 5 (53)
// In the file view, they were separated by spaces: "5 H 5"
// So we look for 53, 32, 72, 32, 53
// Or maybe UTF-16: 35 00 20 00 48 00 20 00 35 00 (hex) -> 53 0 32 0 72 0 32 0 53 0

// Let's look for the sequence 53, 72, 53 (ignoring 00 and 32 for a moment to find the offset)
// Actually, let's just print a chunk where we find 0x35 (5) and 0x48 (H) close to each other.

let foundIndex = -1;
for (let i = 0; i < Math.min(buffer.length, 100000); i++) {
    if (buffer[i] === 0x35) { // '5'
        // Check if 'H' (0x48) follows within 4 bytes
        if (buffer[i + 1] === 0x48 || buffer[i + 2] === 0x48 || buffer[i + 3] === 0x48 || buffer[i + 4] === 0x48) {
            console.log(`Found candidate at ${i}:`, buffer.subarray(i, i + 20).toString('hex'));
            foundIndex = i;
            break;
        }
    }
}

if (foundIndex === -1) {
    console.log('Pattern "5...H...5" not found in first 100kb.');
}
