import fs from 'fs';
import path from 'path';
import * as vscode from 'vscode';
import levenshtein from 'fast-levenshtein';

export async function sandrTool(args) {
    try {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceFolder) {
            throw new Error('No workspace open');
        }
        const requestedPath = args.filepath;
        if (!requestedPath) {
            throw new Error('No filepath provided');
        }
        // console.log("req", requestedPath);
        const searchStr = args.search;
        const replaceStr = args.replace;
        console.log("sear", searchStr, "repl", replaceStr);

        if (searchStr === undefined) {
            throw new Error('Search string cannot be empty.');
        }
        if (replaceStr === undefined) {
            throw new Error('Replace string cannot be undefined.');
        }
        const resolvedPath = path.resolve(workspaceFolder, requestedPath);
        if (!resolvedPath.startsWith(workspaceFolder)) {
            throw new Error('Access denied: Cannot write files outside the workspace');
        }

        if (!fs.existsSync(resolvedPath)) {
            throw new Error('File does not exist');
        }
        const content = await fs.promises.readFile(resolvedPath, 'utf8');
        // console.log("cont", content);
        const normalizedContent = content.replace(/\r\n/g, '\n');
        const normalizedSearch = searchStr.replace(/\r\n/g, '\n');
        // console.log("norm cont", normalizedContent);
        // console.log("norm sear", normalizedSearch);
        if (!normalizedContent.includes(normalizedSearch)) {
            const searchLineCount = normalizedSearch.split('\n').length;
            const contentLines = normalizedContent.split('\n');
            let bestChunk = '';
            let bestDistance = Infinity;
            if (searchLineCount > contentLines.length) {
                    return { success: false, error: `Search string not found in ${requestedPath}` };
                }
            for (let i = 0; i <= contentLines.length - searchLineCount; i++) {
                const chunk = contentLines.slice(i, i + searchLineCount).join('\n');
                const distance = levenshtein.get(normalizedSearch,chunk);
                console.log("dist", distance, "chunk", chunk);
                if (distance < bestDistance) {
                    bestDistance = distance;
                    bestChunk = chunk;
                }
            }
            const similarity = Math.max(0, 1 - bestDistance / Math.max(normalizedSearch.length, bestChunk.length));

            return {
                success: false,
                error: `Search string not found in ${requestedPath}`,
                closestMatch: bestChunk,
                distance: bestDistance,
                similarity: `${(similarity * 100).toFixed(2)}%`
            };
        }

        // console.log("norm repl", replaceStr);
        const newContent = normalizedContent.split(normalizedSearch).join(replaceStr);
        await fs.promises.writeFile(resolvedPath, newContent, 'utf8');

        return {
            success: true,
            message: `Successfully replaced text in ${requestedPath}`
        };
    } catch (err) {
        return {
            success: false,
            error: err.message
        };
    }
}
