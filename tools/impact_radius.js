import fs from 'fs';
import path from 'path';
import * as vscode from 'vscode';

const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.vscode', 'coverage']);
const CODE_EXTENSIONS = new Set(['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs', '.py', '.java', '.go', '.rs', '.cpp', '.c', '.cs', '.rb', '.php']);

function getAllCodeFiles(dir, files = []) {
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (IGNORE_DIRS.has(entry.name)) continue;
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                getAllCodeFiles(fullPath, files);
            } else if (CODE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
                files.push(fullPath);
            }
        }
    } catch (_) {}
    return files;
}

function readFileSafe(filePath) {
    try { return fs.readFileSync(filePath, 'utf-8'); }
    catch (_) { return ''; }
}

/**
 * Calculates which files reference a given symbol/function/class name.
 */
function findReferences(symbol, allFiles, workspaceFolder) {
    const affected = [];
    const symbolRegex = new RegExp(`\\b${symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');

    for (const filePath of allFiles) {
        const content = readFileSafe(filePath);
        const lines = content.split('\n');
        const matches = [];
        lines.forEach((line, idx) => {
            if (symbolRegex.test(line)) {
                matches.push({ line: idx + 1, text: line.trim() });
            }
            symbolRegex.lastIndex = 0;
        });
        if (matches.length > 0) {
            affected.push({
                file: path.relative(workspaceFolder, filePath),
                occurrences: matches.length,
                lines: matches.slice(0, 5) // top 5 lines per file
            });
        }
    }
    return affected;
}

/**
 * Assigns a risk level based on the breadth of impact.
 */
function assessRisk(affectedCount, totalFiles) {
    const ratio = affectedCount / Math.max(totalFiles, 1);
    if (ratio > 0.3 || affectedCount > 15) return 'HIGH';
    if (ratio > 0.1 || affectedCount > 5)  return 'MEDIUM';
    return 'LOW';
}

/**
 * Main exported tool function.
 * args: { symbol: string, description?: string }
 */
export function impactRadiusTool(args) {
    try {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceFolder) throw new Error('No workspace open');

        const symbol = args.symbol;
        if (!symbol) throw new Error('"symbol" argument is required (function/class/variable name)');

        const allFiles = getAllCodeFiles(workspaceFolder);
        const affectedFiles = findReferences(symbol, allFiles, workspaceFolder);

        // Separate by type: imports, tests, APIs
        const tests      = affectedFiles.filter(f => /test|spec/i.test(f.file));
        const imports    = affectedFiles.filter(f => f.lines.some(l => /import|require/.test(l.text)));
        const coreFiles  = affectedFiles.filter(f => !tests.includes(f));

        const riskLevel = assessRisk(affectedFiles.length, allFiles.length);

        return {
            success: true,
            symbol,
            summary: {
                totalFilesScanned: allFiles.length,
                affectedFileCount: affectedFiles.length,
                riskLevel,
                riskReason: riskLevel === 'HIGH'
                    ? 'This symbol is referenced broadly across the codebase. Refactor with extreme care.'
                    : riskLevel === 'MEDIUM'
                    ? 'Moderate impact. Review all affected files before applying changes.'
                    : 'Low impact. Change is localized and safe to apply.'
            },
            breakdown: {
                coreFiles:  coreFiles.map(f => ({ file: f.file, occurrences: f.occurrences })),
                testFiles:  tests.map(f => ({ file: f.file, occurrences: f.occurrences })),
                importSites: imports.map(f => f.file)
            },
            affectedFiles
        };
    } catch (err) {
        return { success: false, error: err.message };
    }
}
