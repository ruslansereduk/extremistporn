/**
 * Parses raw text content into granular extremist material entries.
 * @param {string} text - The raw text content
 * @returns {Array<{content: string, court_decision: string}>}
 */
function parseText(text) {
    // Use a regex that captures each block starting with "Решение суда"
    const entryRegex = /Решение суда[\s\S]*?(?=Решение суда|$)/gi;
    const matches = [...text.matchAll(entryRegex)];
    const entries = [];

    for (const match of matches) {
        const rawBlock = match[0];
        // Clean up raw block first
        // Remove bell characters and other control codes (except newlines)
        let cleanBlock = rawBlock.replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g, '');

        // Normalize newlines
        cleanBlock = cleanBlock.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

        // Try to extract the court decision part
        // 1. Standard phrase
        let decisionMatch = cleanBlock.match(/(вступило в законную силу[\s\S]*?года)/i);

        // 2. If not found, look for "Решение суда ... года" at the start
        if (!decisionMatch) {
            decisionMatch = cleanBlock.match(/^(Решение суда[\s\S]*?года)/i);
        }

        let courtDecision = '';
        let contentBlock = '';

        if (decisionMatch) {
            if (decisionMatch.index < 50) {
                // Decision at start
                courtDecision = decisionMatch[0];
                contentBlock = cleanBlock.substring(decisionMatch[0].length).trim();
            } else {
                // Decision at end or middle
                const splitIdx = decisionMatch.index + decisionMatch[0].length;
                courtDecision = cleanBlock.substring(decisionMatch.index, splitIdx).trim();
                contentBlock = cleanBlock.substring(0, decisionMatch.index) + cleanBlock.substring(splitIdx);
            }
        } else {
            // Fallback: split at first newline
            const nlIdx = cleanBlock.indexOf('\n');
            if (nlIdx > 0 && nlIdx < 200) {
                courtDecision = cleanBlock.substring(0, nlIdx).trim();
                contentBlock = cleanBlock.substring(nlIdx).trim();
            } else {
                courtDecision = 'Unknown Decision';
                contentBlock = cleanBlock.trim();
            }
        }

        // Clean up court decision
        courtDecision = courtDecision.replace(/\s+/g, ' ').trim();

        // Additional cleanup on contentBlock
        contentBlock = contentBlock.replace(/;+\s*$/gm, '');

        const lines = contentBlock.split('\n');

        for (let line of lines) {
            line = line.trim();
            // Remove leading numbering
            line = line.replace(/^\d+[.)]\s*/, '');
            // Remove trailing punctuation
            line = line.replace(/[;,]$/, '');

            line = line.trim();

            // Filter out noise
            if (line.length > 5 && !line.match(/^Page \d+/) && !line.match(/^\d+$/)) {
                entries.push({ content: line, court_decision: courtDecision });
            }
        }
    }
    return entries;
}

module.exports = { parseText };
