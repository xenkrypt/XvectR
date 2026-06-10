import fs from 'fs';
import path from 'path';
import * as vscode from 'vscode';

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
        const resolvedPath = path.resolve(workspaceFolder, requestedPath);
        if (!resolvedPath.startsWith(workspaceFolder)) {
            throw new Error('Access denied: Cannot write files outside the workspace');
        }

        if (!fs.existsSync(resolvedPath)) {
            throw new Error('File does not exist');
        }
        const content = await fs.promises.readFile(resolvedPath, 'utf8');
        console.log("cont", content);
        const normalizedContent = content.replace(/\r\n/g, '\n');
        const normalizedSearch = searchStr.replace(/\r\n/g, '\n');
        // console.log("norm cont", normalizedContent);
        // console.log("norm sear", normalizedSearch);

        if (!normalizedContent.includes(normalizedSearch)) {
            return {
                success: false,
                error: `Search string not found in ${requestedPath}. Make sure indentation, spacing, and quotes match exactly.`
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
