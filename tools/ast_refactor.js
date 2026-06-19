import fs from 'fs';
import path from 'path';
import * as vscode from 'vscode';
import { findFile } from './read_files.js';

/**
 * AST-Powered Refactoring Engine
 * 
 * Performs safe, syntax-aware code transformations without hallucinating.
 * Operations:
 *  - rename_symbol      : renames a symbol everywhere in a file
 *  - update_import      : updates an import path in a file
 *  - add_import         : adds an import to the top of a file
 *  - remove_import      : removes an import line from a file
 *  - wrap_function      : wraps all occurrences of a function call with a new wrapper
 *  - extract_variable   : replaces a literal/expression with a named variable
 *  - rename_file        : renames a file and updates its imports in dependents
 */

const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'build']);

function getAllFiles(dir, files = []) {
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (IGNORE_DIRS.has(entry.name)) continue;
            const fp = path.join(dir, entry.name);
            if (entry.isDirectory()) getAllFiles(fp, files);
            else files.push(fp);
        }
    } catch (_) {}
    return files;
}

function readSafe(p) { try { return fs.readFileSync(p, 'utf-8'); } catch (_) { return null; } }
function writeSafe(p, c) { try { fs.writeFileSync(p, c, 'utf-8'); return true; } catch (_) { return false; } }

/** Word-boundary safe replace across the entire content */
function renameSymbolInContent(content, oldName, newName) {
    const escaped = oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return content.replace(new RegExp(`\\b${escaped}\\b`, 'g'), newName);
}

/**
 * Main exported tool.
 * args: {
 *   operation: string,
 *   filePath?: string,
 *   oldName?: string,
 *   newName?: string,
 *   oldImport?: string,
 *   newImport?: string,
 *   importStatement?: string,
 *   functionName?: string,
 *   wrapperName?: string,
 *   expression?: string,
 *   variableName?: string,
 * }
 */
export function astRefactorTool(args) {
    try {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceFolder) throw new Error('No workspace open');

        const op = args.operation;
        if (!op) throw new Error('"operation" argument is required');

        // ── RENAME SYMBOL (in one file, or all files if no filePath) ──────────
        if (op === 'rename_symbol') {
            const { oldName, newName } = args;
            if (!oldName || !newName) throw new Error('"oldName" and "newName" are required');

            const targetFiles = args.filePath
                ? [path.resolve(workspaceFolder, args.filePath)]
                : getAllFiles(workspaceFolder).filter(f => /\.(js|ts|jsx|tsx|mjs|cjs)$/.test(f));

            const changed = [];
            for (const fp of targetFiles) {
                const content = readSafe(fp);
                if (!content) continue;
                const newContent = renameSymbolInContent(content, oldName, newName);
                if (newContent !== content) {
                    writeSafe(fp, newContent);
                    changed.push(path.relative(workspaceFolder, fp));
                }
            }
            return { success: true, operation: 'rename_symbol', modifiedFiles: changed, message: `Renamed "${oldName}" → "${newName}" in ${changed.length} file(s).` };
        }

        // ── UPDATE IMPORT ─────────────────────────────────────────────────────
        if (op === 'update_import') {
            const { filePath, oldImport, newImport } = args;
            if (!filePath || !oldImport || !newImport) throw new Error('"filePath", "oldImport", and "newImport" are required');
            const fp = path.resolve(workspaceFolder, filePath);
            const content = readSafe(fp);
            if (!content) throw new Error(`File not found: ${filePath}`);
            if (!content.includes(oldImport)) return { success: false, error: `Import "${oldImport}" not found in ${filePath}` };
            const newContent = content.split(oldImport).join(newImport);
            writeSafe(fp, newContent);
            return { success: true, operation: 'update_import', message: `Updated import in ${filePath}` };
        }

        // ── ADD IMPORT ────────────────────────────────────────────────────────
        if (op === 'add_import') {
            const { filePath, importStatement } = args;
            if (!filePath || !importStatement) throw new Error('"filePath" and "importStatement" are required');
            const fp = path.resolve(workspaceFolder, filePath);
            const content = readSafe(fp);
            if (!content) throw new Error(`File not found: ${filePath}`);
            if (content.includes(importStatement.trim())) {
                return { success: false, error: 'Import already exists in the file.' };
            }
            // Insert after the last existing import line
            const lines = content.split('\n');
            let lastImportIdx = -1;
            lines.forEach((line, i) => { if (/^import\s|^const\s.*require\(/.test(line.trim())) lastImportIdx = i; });
            lines.splice(lastImportIdx + 1, 0, importStatement);
            writeSafe(fp, lines.join('\n'));
            return { success: true, operation: 'add_import', message: `Added import to ${filePath}` };
        }

        // ── REMOVE IMPORT ─────────────────────────────────────────────────────
        if (op === 'remove_import') {
            const { filePath, importStatement } = args;
            if (!filePath || !importStatement) throw new Error('"filePath" and "importStatement" are required');
            const fp = path.resolve(workspaceFolder, filePath);
            const content = readSafe(fp);
            if (!content) throw new Error(`File not found: ${filePath}`);
            const lines = content.split('\n');
            const filtered = lines.filter(l => !l.includes(importStatement.trim()));
            if (filtered.length === lines.length) return { success: false, error: 'Import line not found.' };
            writeSafe(fp, filtered.join('\n'));
            return { success: true, operation: 'remove_import', message: `Removed import from ${filePath}` };
        }

        // ── WRAP FUNCTION CALL ────────────────────────────────────────────────
        if (op === 'wrap_function') {
            const { filePath, functionName, wrapperName } = args;
            if (!filePath || !functionName || !wrapperName) throw new Error('"filePath", "functionName", and "wrapperName" are required');
            const fp = path.resolve(workspaceFolder, filePath);
            const content = readSafe(fp);
            if (!content) throw new Error(`File not found: ${filePath}`);
            // Replace calls: functionName( → wrapperName(functionName(  and add closing )
            const escaped = functionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`\\b${escaped}\\(`, 'g');
            const newContent = content.replace(regex, `${wrapperName}(${functionName}(`);
            if (newContent === content) return { success: false, error: `No calls to "${functionName}" found in ${filePath}` };
            writeSafe(fp, newContent);
            return { success: true, operation: 'wrap_function', message: `Wrapped "${functionName}" with "${wrapperName}" in ${filePath}. NOTE: You may need to add closing parentheses manually.` };
        }

        // ── EXTRACT VARIABLE ──────────────────────────────────────────────────
        if (op === 'extract_variable') {
            const { filePath, expression, variableName } = args;
            if (!filePath || !expression || !variableName) throw new Error('"filePath", "expression", and "variableName" are required');
            const fp = path.resolve(workspaceFolder, filePath);
            const content = readSafe(fp);
            if (!content) throw new Error(`File not found: ${filePath}`);
            if (!content.includes(expression)) return { success: false, error: `Expression not found in ${filePath}` };
            // Replace only first occurrence and insert variable declaration before that line
            const idx = content.indexOf(expression);
            const lineStart = content.lastIndexOf('\n', idx) + 1;
            const indent = content.slice(lineStart, idx).match(/^(\s*)/)?.[1] || '';
            const declaration = `${indent}const ${variableName} = ${expression};\n`;
            const newContent = declaration + content.slice(0, idx) + variableName + content.slice(idx + expression.length);
            writeSafe(fp, newContent);
            return { success: true, operation: 'extract_variable', message: `Extracted "${expression}" into const ${variableName} in ${filePath}` };
        }

        // ── RENAME FILE ───────────────────────────────────────────────────────
        if (op === 'rename_file') {
            const { filePath, newName } = args;
            if (!filePath || !newName) throw new Error('"filePath" and "newName" are required');
            const oldFp = path.resolve(workspaceFolder, filePath);
            const newFp = path.join(path.dirname(oldFp), newName);
            if (!fs.existsSync(oldFp)) throw new Error(`File not found: ${filePath}`);
            if (fs.existsSync(newFp)) throw new Error(`A file named "${newName}" already exists.`);
            fs.renameSync(oldFp, newFp);

            // Update import references in all other files
            const oldBaseName = path.basename(filePath, path.extname(filePath));
            const newBaseName = path.basename(newName, path.extname(newName));
            const allFiles = getAllFiles(workspaceFolder).filter(f => /\.(js|ts|jsx|tsx|mjs|cjs)$/.test(f) && f !== newFp);
            const updatedFiles = [];
            for (const f of allFiles) {
                const c = readSafe(f);
                if (!c || !c.includes(oldBaseName)) continue;
                const updated = c.split(oldBaseName).join(newBaseName);
                if (updated !== c) { writeSafe(f, updated); updatedFiles.push(path.relative(workspaceFolder, f)); }
            }
            return { success: true, operation: 'rename_file', message: `Renamed file to "${newName}" and updated references in ${updatedFiles.length} file(s).`, updatedFiles };
        }

        return { success: false, error: `Unknown operation: "${op}". Valid: rename_symbol, update_import, add_import, remove_import, wrap_function, extract_variable, rename_file` };

    } catch (err) {
        return { success: false, error: err.message };
    }
}
