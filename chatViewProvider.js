import {getOllamaResponse} from './ollama1.js';
import fs from "fs";
import path from "path";
import * as vscode from 'vscode';
import { getAllFiles } from './indexer.js';
import { scanAndRedact } from './tools/security_shield.js';
import { getSessionList, loadSessionMessages, renameSession, isSessionEmpty } from './tools/project_memory.js';


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
            if (message.type === 'init') {
                try {
                    const sessions = getSessionList() || [];
                    this.sendMessageToWebview("session_list", sessions);
                } catch (err) {
                    console.error(err);
                }
                return;
            }
            if (message.type === 'load_session') {
                try {
                    const messages = loadSessionMessages(message.sessionId) || [];
                    this.sendMessageToWebview("load_history", messages);
                } catch (err) {
                    console.error(err);
                }
                return;
            }
            if (message.type === 'mention') {
                try {
                    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
                    if (!workspaceFolder) {
                        return;
                    }
                    const files = getAllFiles(workspaceFolder);
                    const fileList = files.map(f => path.relative(workspaceFolder, f));
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
                    // Use the specific sessionId sent from the webview
                    const sessionId = message.sessionId || 'default';

                    if (isSessionEmpty(sessionId)) {
                        let title = promptText.substring(0, 30);
                        if (promptText.length > 30) title += '...';
                        renameSession(sessionId, title);
                        this.sendMessageToWebview("session_list", getSessionList() || []);
                    }

                    if (workspaceFolder) {
                        if (message.image) {
                            const base64Data = message.image.replace(/^data:image\/\w+;base64,/, "");
                            const imageBuffer = Buffer.from(base64Data, 'base64');
                            const imageFileName = 'pasted_image.png';
                            const imagePath = path.join(workspaceFolder, imageFileName);
                            fs.writeFileSync(imagePath, imageBuffer);
                            promptText += `\n\n[System Note: The user has uploaded an image which is saved at '${imageFileName}'. You MUST use the analyze_image tool to analyze it first before fulfilling the rest of the user's request.]`;
                        }

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

                    // ── Security Shield: scan & redact before sending to AI ──
                    const shieldResult = scanAndRedact(promptText);
                    if (shieldResult.hadSecrets) {
                        console.warn('[SecurityShield] Secrets detected and redacted:', shieldResult.findings);
                        this.sendMessageToWebview('tool_status', `🛡️ Security Shield: Redacted ${shieldResult.findings.length} secret(s) before processing.`);
                        promptText = shieldResult.redacted;
                    }

                    const resT = await getOllamaResponse(promptText, sessionId);
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