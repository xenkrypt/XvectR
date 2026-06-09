import fs from 'fs';
import path from 'path';
import * as vscode from 'vscode';
import { Transform } from 'stream';

class ReplaceStream extends Transform {
    constructor(searchStr, replaceStr, options) {
        super(options);
        this.searchBuffer = Buffer.from(searchStr);
        this.replaceBuffer = Buffer.from(replaceStr || '');
        this.tail = Buffer.alloc(0);
    }

    _transform(chunk, encoding, callback) {
        let data = Buffer.concat([this.tail, chunk]);
        
        let idx;
        while ((idx = data.indexOf(this.searchBuffer)) !== -1) {
            this.push(data.subarray(0, idx));
            this.push(this.replaceBuffer);
            data = data.subarray(idx + this.searchBuffer.length);
        }
        
        if (data.length >= this.searchBuffer.length) {
            const safeLen = data.length - this.searchBuffer.length + 1;
            this.push(data.subarray(0, safeLen));
            this.tail = data.subarray(safeLen);
        } else {
            this.tail = data;
        }
        
        callback();
    }

    _flush(callback) {
        if (this.tail.length > 0) {
            this.push(this.tail);
        }
        callback();
    }
}

export async function sandrTool(args) {
    try {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceFolder) {
            throw new Error('No workspace open');
        }

        const requestedPath = args.path;
        if (!requestedPath) {
            throw new Error('No path provided');
        }

        const searchStr = args.search;
        const replaceStr = args.replace;

        if (!searchStr) {
            throw new Error('Search string cannot be empty.');
        }

        const resolvedPath = path.resolve(workspaceFolder, requestedPath);
        if (!resolvedPath.startsWith(workspaceFolder)) {
            throw new Error('Access denied: Cannot write files outside the workspace');
        }

        if (!fs.existsSync(resolvedPath)) {
            throw new Error('File does not exist');
        }

        const tempFilePath = resolvedPath + '.tmp';

        await new Promise((resolve, reject) => {
            const readStream = fs.createReadStream(resolvedPath);
            const writeStream = fs.createWriteStream(tempFilePath);
            const replaceStream = new ReplaceStream(searchStr, replaceStr);

            readStream.pipe(replaceStream).pipe(writeStream);

            writeStream.on('finish', () => {
                fs.rename(tempFilePath, resolvedPath, (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });

            readStream.on('error', (err) => {
                fs.unlink(tempFilePath, () => {});
                reject(err);
            });

            writeStream.on('error', (err) => {
                fs.unlink(tempFilePath, () => {});
                reject(err);
            });
        });

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

// import { sandrTool } from './tools/sandr.js';
// {
//     type: 'function',
//     function: {
//         name: 'search_and_replace',
//         description: 'Search and replace text in a file efficiently using a stream. Does not load the entire file into memory.',
//         parameters: {
//             type: 'object',
//             properties: {
//                 path: {
//                     type: 'string',
//                     description: 'The file path relative to the workspace root.'
//                 },
//                 search: {
//                     type: 'string',
//                     description: 'The exact string to search for.'
//                 },
//                 replace: {
//                     type: 'string',
//                     description: 'The string to replace it with.'
//                 }
//             },
//             required: ['path', 'search', 'replace']
//         }
//     }
// }
// else if (call.function.name === 'search_and_replace') {
//     if (!args || !args.path || !args.search) {
//         toolres = { success: false, error: 'Invalid arguments. "path" and "search" must be specified.' };
//     } else {
//         toolres = await sandrTool(args);
//     }
// }
// else if (call.function.name === 'search_and_replace') {
//     desc = `Replacing text in file: ${args.path || 'unknown'}`;
// }

