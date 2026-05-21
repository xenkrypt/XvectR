import fs from 'fs';
import path from 'path';
import * as vscode from 'vscode';


function buildTree(dir, depth = 0, maxDepth = 4) {
    if (depth > maxDepth) {
        return null;
    }
    const entries =
        fs.readdirSync(dir, {
            withFileTypes: true
        });
    const tree = {};
    for (const entry of entries) {
        if (
            entry.name === 'node_modules' ||
            entry.name.startsWith('.git')
        ) {
            continue;
        }
        const fullPath =
            path.join(dir, entry.name);
        if (entry.isDirectory()) {
            tree[entry.name] =
                buildTree(
                    fullPath,
                    depth + 1,
                    maxDepth
                );
        } else {
            tree[entry.name] = 'file';
        }
    }
    return tree;
}
export function fileTreeTool() {
    try {
        const workspaceFolder =
            vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceFolder) {
            throw new Error('No workspace open');
        }
        const tree =
            buildTree(workspaceFolder);
        return {
            success: true,
            tree
        };
    } catch (err) {
        return {
            success: false,
            error: err.message
        };
    }
}