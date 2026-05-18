const fs = require('fs');
const path = require('path');
const Mocha = require('mocha');

function collectTests(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    return entries.flatMap(entry => {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            return collectTests(fullPath);
        }

        return entry.isFile() && entry.name.endsWith('.test.cjs') ? [fullPath] : [];
    });
}

exports.run = () => {
    const mocha = new Mocha({
        ui: 'tdd',
        color: true,
    });

    for (const file of collectTests(__dirname)) {
        mocha.addFile(file);
    }

    return new Promise((resolve, reject) => {
        mocha.run(failures => {
            if (failures > 0) {
                reject(new Error(`${failures} tests failed.`));
            } else {
                resolve();
            }
        });
    });
};
