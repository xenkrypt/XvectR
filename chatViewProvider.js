// import * as vscode from 'vscode';

// // class chatViewProvider {

// //     constructor(context) {

// //         this.context = context;

// //         this.view = null;
// //     }

// //     resolveWebviewView(webviewView) {

// //         console.log("Webview opened");

// //         this.view = webviewView;

// //         webviewView.webview.options = {
// //             enableScripts: true
// //         };

// //         webviewView.webview.html =
// //             this.getHtml();

// //         // Listen for messages from frontend
// //         webviewView.webview.onDidReceiveMessage(
// //             async (message) => {

// //                 console.log("Received:", message);

// //                 if(message.type === 'chat') {

// //                     const userText =
// //                         message.text;

// //                     // Display received message
// //                     console.log(userText);

// //                     // Send response back
// //                     this.sendMessageToWebview(
// //                         "Hello from backend!"
// //                     );
// //                 }
// //             }
// //         );
// //     }

// //     sendMessageToWebview(text) {

// //         if(!this.view) return;

// //         this.view.webview.postMessage({
// //             type: 'response',
// //             text: text
// //         });
// //     }

// //     getHtml() {

// //         return `
// //         <!DOCTYPE html>

// //         <html>

// //         <body>

// //             <h2>AI Chat</h2>

// //             <div id="chat"></div>

// //             <input
// //                 id="input"
// //                 type="text"
// //                 placeholder="Type message"
// //             />

// //             <button onclick="sendMessage()">
// //                 Send
// //             </button>

// //             <script>

// //                 const vscode =
// //                     acquireVsCodeApi();

// //                 const chat =
// //                     document.getElementById('chat');

// //                 function addMessage(text) {

// //                     const div =
// //                         document.createElement('div');

// //                     div.innerText = text;

// //                     chat.appendChild(div);
// //                 }

// //                 function sendMessage() {

// //                     const input =
// //                         document.getElementById('input');

// //                     const text =
// //                         input.value;

// //                     addMessage("You: " + text);

// //                     vscode.postMessage({
// //                         type: 'chat',
// //                         text: text
// //                     });

// //                     input.value = '';
// //                 }

// //                 window.addEventListener(
// //                     'message',
// //                     event => {

// //                         const message =
// //                             event.data;

// //                         if(message.type === 'response') {

// //                             addMessage(
// //                                 "AI: " + message.text
// //                             );
// //                         }
// //                     }
// //                 );

// //             </script>

// //         </body>

// //         </html>
// //         `;
// //     }
// // }

// // import * as vscode from 'vscode';

// export class chatViewProvider {
//     /**
//      * @param {vscode.ExtensionContext} context
//      */
//     constructor(context) {
//         this.context = context;
//         this.view = null;
//     }

//     /**
//      * @param {vscode.WebviewView} webviewView
//      */
//     resolveWebviewView(webviewView) {
//         this.view = webviewView;

//         webviewView.webview.options = {
//             enableScripts: true,
//             localResourceRoots: [this.context.extensionUri]
//         };

//         webviewView.webview.html = this.getHtml();

//         webviewView.webview.onDidReceiveMessage(message => {
//             if (message.type === 'chat') {
//                 this.sendMessageToWebview("Response from XvectR");
//             }
//         });
//     }

//     sendMessageToWebview(text) {
//         if (this.view) {
//             this.view.webview.postMessage({ type: 'response', text });
//         }
//     }

//     getHtml() {
//         return `<html><body><h3>Hello World</h3></body></html>`;
//     }
// }
import {getOllamaResponse} from './ollama1.js';
import fs from "fs";
import path from "path";



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
                this.sendMessageToWebview("user","User: " + message.text);
                this.sendMessageToWebview("start",message.text);
                const resT = getOllamaResponse(message.text).then(async res => {
                    if(res) {
                        for await(const i of res) {
                            this.sendMessageToWebview("chunk",i.message.content.replace(/\n/g, ''));
                            this.sendMessageToWebview("chunk", "\n");
                        // this.sendMessageToWebview(res);
                    }
            }});
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