import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { downloadAndUnzipVSCode } from '@vscode/test-electron';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionDevelopmentPath = path.resolve(__dirname, '..');
const extensionTestsPath = path.resolve(__dirname, 'suite', 'index.cjs');
const vscodeExecutablePath = await downloadAndUnzipVSCode({
    version: '1.120.0',
    extensionDevelopmentPath,
});

const args = [
    '--no-sandbox',
    '--disable-gpu-sandbox',
    '--disable-updates',
    '--skip-welcome',
    '--skip-release-notes',
    '--disable-workspace-trust',
    `--user-data-dir=${path.resolve(extensionDevelopmentPath, '.vscode-test', 'user-data')}`,
    `--extensions-dir=${path.resolve(extensionDevelopmentPath, '.vscode-test', 'extensions')}`,
    `--extensionDevelopmentPath=${extensionDevelopmentPath}`,
    `--extensionTestsPath=${extensionTestsPath}`,
];

const exitCode = await new Promise((resolve, reject) => {
    const child = spawn(vscodeExecutablePath, args, {
        env: process.env,
        stdio: 'inherit',
    });

    child.on('error', reject);
    child.on('close', code => resolve(code));
});

if (exitCode !== 0) {
    throw new Error(`VS Code extension tests failed with exit code ${exitCode}.`);
}
