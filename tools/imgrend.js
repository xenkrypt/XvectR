import fs from 'fs';
import path from 'path';
import * as vscode from 'vscode';
import ollama from 'ollama';
import { findFile } from './read_files.js';

// function findFile(workspaceF, filename) {
//     const directPath = path.join(workspaceF, filename);
//     if (fs.existsSync(directPath)) {
//         return directPath;
//     }
//     const files = fs.readdirSync(workspaceF, { recursive: true });
//     let match = files.find(file => path.basename(file) === filename);
//     if (!match) {
//         match = files.find(file => path.parse(file).name === filename);
//     }
//     return match ? path.join(workspaceF, match) : null;
// }
export async function imgRendTool(args) {
    try {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceFolder) {
            throw new Error('No workspace open');
        }

        const resolvedPath = findFile(workspaceFolder, args.imagePath);
        if (!resolvedPath) {
            return { success: false, error: `Image not found: ${args.imagePath}` };
        }

        if (!resolvedPath.startsWith(workspaceFolder)) {
            return { success: false, error: 'Access denied: Image is outside the workspace' };
        }
        const imageBuffer = fs.readFileSync(resolvedPath);
        const base64Image = imageBuffer.toString('base64');
        const prompt = args.prompt || "Please describe this image in detail and extract any relevant text or context.";

        const response = await ollama.chat({
            model: "moondream",
            messages: [{
                role: 'user',
                content: prompt,
                images: [base64Image]
            }]
        });

        return {
            success: true,
            filePath: resolvedPath,
            analysis: response.message.content
        };
    } catch (err) {
        return {
            success: false,
            error: err.message
        };
    }
}
