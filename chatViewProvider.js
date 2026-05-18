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

        webviewView.webview.onDidReceiveMessage(message => {
            if (message.type === 'chat') {
                this.sendMessageToWebview("User: " + message.text);
                const resT = getOllamaResponse(message.text).then(res => {
                    if(res) {
                        this.sendMessageToWebview(res);
                    }
                });

            }
        });
    }

    sendMessageToWebview(text) {
        if (this.view) {
            this.view.webview.postMessage({ type: 'response', text });
        }
    }

    getHtml() {
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css">
            <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
            <style>
                body {
                    padding: 10px;
                    color: var(--vscode-editor-foreground);
                    display: flex;
                    flex-direction: column;
                    height: 100vh;
                    margin: 0;
                    box-sizing: border-box;
                }
                #chat {
                    flex-grow: 1; 
                    overflow-y: auto;
                    margin-bottom: 10px;
                    border: 1px solid #fe0000;
                    display: flex;
                    flex-direction: column; 
                    gap: 5px;
                }
                .message {
                    align-self: flex-start;
                    text-align: left;
                    word-wrap: break-word;
                    max-width: 90%;
                    padding: 4px 8px;
                }
                pre { background: #1e1e1e; padding: 10px; border-radius: 5px; overflow-x: auto; }
                code { font-family: var(--vscode-editor-font-family); }
                .input-container {
                    display: flex;
                    width: 100%;
                    gap: 5px;
                }
                #input {
                    flex-grow: 1; 
                }
            </style>
        </head>
        <body>
            <h3>XvectR Chat</h3>
            <div id="chat"></div>

            <div class="input-container">
                <input id="input" type="text" placeholder="Type a message..." />
                <button onclick="send()">Send</button>
            </div>

            <script>
                const vscode = acquireVsCodeApi();

                document.getElementById('input').addEventListener('keypress', function (e) {
                    if (e.key === 'Enter') {
                        send();
                    }
                });

                function send() {
                    const input = document.getElementById('input');
                    const text = input.value;
                    if (!text) return;
                    input.value = '';
                    vscode.postMessage({ type: 'chat', text: text });
                }

                window.addEventListener('message', event => {
                    const chatContainer = document.getElementById('chat');
                    const div = document.createElement('div');
                    div.className = 'message';
                    div.innerHTML = event.data.text;
                    
                    chatContainer.appendChild(div);

                    div.querySelectorAll('pre code').forEach((block) => {
                        hljs.highlightElement(block);
                    });
                    
                    chatContainer.scrollTop = chatContainer.scrollHeight;
                });
            </script>
        </body>
        </html>`;
    }
}

// // module.exports = {
// //     chatViewProvider
// // };
// // export class chatViewProvider {
// // }