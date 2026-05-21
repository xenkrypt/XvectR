import fs from 'fs';
import path from 'path';
import * as vscode from 'vscode';



function findFile(workspaceF, filename) {
    const directPath = path.join(workspaceF, filename);
    if (fs.existsSync(directPath)) {
        return directPath;
    }
    const files =
        fs.readdirSync(workspaceF, {
            recursive: true
        });
    let match = files.find(file =>
        path.basename(file) === filename
    );
    // const parsedFilename = path.parse(filename).name;
    // console.log('Looking for:', filename, 'Parsed:', parsedFilename);
    if (!match) {
        match = files.find(file =>
            path.parse(file).name === filename
        );
    }
    return match
        ? path.join(workspaceF, match)
        : null;
}

export function readFilesTool(args) {
    try {
        const workspaceFolder =
            vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceFolder) {
            throw new Error('No workspace open');
        }
        const results = {};
        for (const requestedPath of args.paths) {
            const resolvedPath =
                findFile(
                    workspaceFolder,
                    requestedPath
                );
            if (!resolvedPath) {
                results[requestedPath] = {
                    success: false,
                    error: 'File not found'
                };
                continue;
            }
            if (
                !resolvedPath.startsWith(workspaceFolder)
            ) {
                results[requestedPath] = {
                    success: false,
                    error: 'Access denied'
                };
                continue;
            }
            const content =
                fs.readFileSync(
                    resolvedPath,
                    'utf-8'
                );
            results[requestedPath] = {
                success: true,
                content
            };
        }
        return {
            success: true,
            files: results
        };
    } catch (err) {
        return {
            success: false,
            error: err.message
        };
    }
}