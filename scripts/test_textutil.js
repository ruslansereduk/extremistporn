const { execSync } = require('child_process');
const path = require('path');

const DOC_PATH = path.join(__dirname, '..', 'r0cgbemn4oriwhjmjepofzez1dxq9ci0.doc');

try {
    console.log('Running textutil via zsh with pipe...');
    const stdout = execSync(`/usr/bin/textutil -convert txt -stdout "${DOC_PATH}" | cat`, {
        shell: '/bin/zsh',
        encoding: 'utf8',
        maxBuffer: 50 * 1024 * 1024
    });

    console.log(`Output length: ${stdout.length}`);
    console.log('First 100 chars:');
    console.log(stdout.substring(0, 100));
} catch (e) {
    console.error(e);
}
