// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
// import * as vscode from 'vscode';
// import { chatViewProvider } from './chatViewProvider.js';

// // This method is called when your extension is activated
// // Your extension is activated the very first time the command is executed


import * as vscode from 'vscode';
import { chatViewProvider } from './chatViewProvider.js'; 
import {spawn} from 'child_process';
/**
 * @param {vscode.ExtensionContext} context
 */
export function activate(context) {
    spawn('ollama', ['serve']);
    console.log('Congratulations, your extension "xvectr" is now active!');
    const provider = new chatViewProvider(context);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('chatView', provider)
    );
    const disposable = vscode.commands.registerCommand('xvectr.helloWorld', () => {
        vscode.window.showInformationMessage('Hello World from XvectR!');
    });

    context.subscriptions.push(disposable);
}

export function deactivate() { 
}