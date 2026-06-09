import {getOllamaResponse} from './ollama1.js';
import fs from "fs";
import path from "path";
// import md from "./markdown.js";
import * as vscode from 'vscode';
// import { getEmbedding } from './indexer.js';
import { getAllFiles } from './indexer.js';


export class chatViewProvider {
    /**
     * @param {import('vscode').ExtensionContext} context
     */
    constructor(context) {
        /** @type {import('vscode').ExtensionContext} */
        this.context = context;
        this.view = null;
    }

    /**
     * @param {import('vscode').WebviewView} webviewView
     */
    resolveWebviewView(webviewView) {
        this.view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.context.extensionUri]
        };

        webviewView.webview.html = this.getHtml();

        webviewView.webview.onDidReceiveMessage(async message => {
            if (message.type === 'mention') {
                try {
                    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
                    if (!workspaceFolder) {
                        return;
                    }
                    const files = getAllFiles(workspaceFolder);
                    const fileList = files.map(f => path.relative(workspaceFolder, f)
                    );
                    webviewView.webview.postMessage({type: 'mention_suggestions',suggestions: fileList});
                } catch (err) {
                    console.error(err);
                }
                return;
            }
            if (message.type === 'chat') {
                this.sendMessageToWebview("user", message.text);
                this.sendMessageToWebview("start","");
                try{
                    let promptText = message.text;
                    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
                    
                    if (workspaceFolder) {
                        const mentionRegex = /@([\w\-./\\]+)/g;
                        let match;
                        let contextAdded = false;
                        let fileContext = "Context from mentioned files:\n\n";

                        const mentions = new Set();
                        while ((match = mentionRegex.exec(message.text)) !== null) {
                            mentions.add(match[1]);
                        }

                        for (const file of mentions) {
                            try {
                                const filePath = path.resolve(workspaceFolder, file);
                                if (filePath.startsWith(workspaceFolder) && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
                                    const content = fs.readFileSync(filePath, 'utf-8');
                                    fileContext += `--- ${file} ---\n${content}\n\n`;
                                    contextAdded = true;
                                }
                            } catch (err) {
                                console.error("Error reading mentioned file:", err);
                            }
                        }

                        if (contextAdded) {
                            promptText = `${fileContext}\nUser Query: ${message.text}`;
                            console.log("prompttext:", promptText);
                        }
                    }

                    const resT = await getOllamaResponse(promptText);
                    if (!resT) return;
                    let fr = "";
                    for await(const i of resT) {
                        if (i.type === 'tool_status') {
                            this.sendMessageToWebview('tool_status', i.message);
                        } else {
                            const chunkText = i.type === 'chunk' ? i.message.content : (i.message?.content || '');
                            this.sendMessageToWebview('render', chunkText);
                            fr += chunkText;
                        }
                    }
                    this.sendMessageToWebview('done', '');
                    fs.writeFileSync('./memo.txt', message.text + "\n" + fr);

                }
                catch(err) {
                    console.error(err);
                    this.sendMessageToWebview("error", "Error: " + err.message);
                    this.sendMessageToWebview('done', '');

                    }
                }
            });
        }

    sendMessageToWebview(type,text) {
        if (this.view) {
            this.view.webview.postMessage({ type: type, text: text });
        }
    }

    getHtml() {
        const htmlPath = path.join(
        this.context.extensionPath,
        'panel.html'
        );

        return fs.readFileSync(htmlPath, 'utf8');
    }
}

// // module.exports = {
// //     chatViewProvider
// // };
// // export class chatViewProvider {
// // }