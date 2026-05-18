import {getOllamaResponse} from './ollama1.js';
import fs from "fs";
import path from "path";
import md from "./markdown.js";



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
            if (message.type === 'chat') {
                this.sendMessageToWebview("user", message.text);
                this.sendMessageToWebview("start","");
                try{
                    const resT = await getOllamaResponse(message.text);
                    if (!resT) return;
                    let fr = "";
                    for await(const i of resT) {
                        fr+=i.message.content;
                        const formatted = md.render(fr);
                        this.sendMessageToWebview('render', formatted);
                        // this.sendMessageToWebview("chunk",i.message.content.replace(/\n/g, ''));
                        // this.sendMessageToWebview("chunk", "\n");
                        // this.sendMessageToWebview(res);
                        }

                }
                catch(err) {
                    console.error(err);
                    this.sendMessageToWebview("error", "Error: " + err.message);

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