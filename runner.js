import {exec } from 'child_process';
import * as vscode from 'vscode';

export async function runCommandTool(args) {
    const cmd = args.command;
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceFolder) {
        return { success: false, error: 'No workspace directory is currently open' };
    }
    return new Promise((resolve) => {
        exec(cmd, { cwd: workspaceFolder }, (error, stdout, stderr) => {
            if (error) {
                resolve({ success: false, error: error.message, stderr });
            } else {
                resolve({ success: true, stdout });
            }
        });
    });
    
}