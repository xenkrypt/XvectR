// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
// import * as vscode from 'vscode';
// import { chatViewProvider } from './chatViewProvider.js';

// // This method is called when your extension is activated
// // Your extension is activated the very first time the command is executed


import * as vscode from 'vscode';
import { chatViewProvider } from './chatViewProvider.js'; 
import {spawn} from 'child_process';
import * as net from 'net';


let ollamaProcess = null;
let startingOllama = false;
function isOllamaRunning() {
    return new Promise((resolve) => {
        const socket = net.connect(11434, '127.0.0.1');
        socket.once('connect', () => {
            socket.end();
            resolve(true);
        });
        socket.once('error', () => {
            resolve(false);
        });
    });
}
async function stollama() {
    if (startingOllama) {
        return;
    }
    const running = await isOllamaRunning();
    if (running) {
        console.log('Ollama already running');
        return;
    }
    startingOllama = true;
    console.log('Starting Ollama...');
    ollamaProcess = spawn('ollama', ['serve'], {
        detached: true,
        stdio: 'ignore'
    });
    ollamaProcess.unref();
    ollamaProcess.on('exit', () => {
        ollamaProcess = null;
        startingOllama = false;
    });
    setTimeout(() => {
        startingOllama = false;
    }, 3000);
}

/**
 * @param {vscode.ExtensionContext} context
 */
export async function activate(context) {
    await stollama();
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