import ollama from 'ollama';
// import { webSearch } from './intents/web_search.js';
// import {getdateTime} from './intents/date_time.js';
import fs from 'fs';
import path from 'path';
import * as vscode from 'vscode';

// export async function getOllamaResponse(ollamares) {
//     const res = await ollama.chat({
//         model: 'llama3.2:latest',
//         messages: [
//             {
//                 role: 'user',
//                 content: ollamares
//             }
//         ],
//         stream: true
//     });
//     return res;
// }   


const sysprompt = `You are an expert coding assistant.
                    You are a coding assistant for VS Code. 
                    Use tools whenever the user asks about files, code, debugging, or project structure. 
                    Always read files before answering file-related questions. 
                    When mentioning code, include the filename. 
                    Keep responses short, direct, and technical.`;

function findFile(workspaceF, filename) {
    const files = fs.readdirSync(workspaceF, { recursive: true });
    let match = files.find(file =>
        path.basename(file) === filename
    );
    if (!match) {
        match = files.find(file =>
            path.parse(file).name === filename
        );
    }
    return match ? path.join(workspaceF, match) : null;
}

function readFileTool(args) {
    try {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceFolder) {
            throw new Error('No workspace open');
        }
        const resolvedPath = findFile(workspaceFolder, args.path);
        if (!resolvedPath) {
            throw new Error(`File not found: ${args.path}`);
        }

        const fullPath = resolvedPath;
        if (!fullPath.startsWith(workspaceFolder)) {
            throw new Error('Access denied');
        }
        console.log('READING FILE:', fullPath);
        const content =fs.readFileSync(fullPath, 'utf-8');

        return {
            success: true,
            content
        };
    } catch (err) {
        console.error('READ FILE ERROR:', err);
        return {
            success: false,
            error: err.message
        };
    }
}



export async function getOllamaResponse(ollamares) {
    // const intent = await intentrec(ollamares);
    // console.log('intent:', intent);
    // const dat = fs.readFileSync('./memo.txt', 'utf-8');
    const messg = [
            {
                role: 'system',
                content: sysprompt
            },
            {
                role: 'user',
                content: ollamares
            }
        ]

    // const messg = [{}]
    const c1 = await ollama.chat({
    model: 'qwen2.5-coder:latest',
    messages: messg,
    tools: [{
            type: 'function',
            function: {
                name: 'read_file',
                description: 'Read a file from disk',
                parameters: {
                    type: 'object',
                    properties: {
                        path: {
                            type: 'string',
                            description: 'Path to file'
                        }
                    },
                    required: ['path']
                    }
                }
            }
        ],
            stream: false
        });

    console.log('FIRST RESPONSE:\n', JSON.stringify(c1, null, 2));    
    // let toolCalls = c1.message.tool_calls;
    let toolCalls = c1.message.tool_calls || [];
    if (toolCalls.length === 0 && c1.message.content) {
        try {
            const parsed = JSON.parse(c1.message.content);

            if (parsed.name && parsed.arguments) {
                toolCalls = [{
                    function: {
                        name: parsed.name,
                        arguments: parsed.arguments
                    }
                }];
            }
        } catch (err) {}
    }
    
    console.log('TOOL CALLS:\n', JSON.stringify(toolCalls, null, 2));
    if (toolCalls.length === 0) {
        return await ollama.chat({
            model: 'qwen2.5-coder:latest',
            messages: messg,
            stream: true
        });
    }
    if (toolCalls && toolCalls.length > 0) {
        messg.push(c1.message);
        for (const call of toolCalls) {
            if (call.function.name === 'read_file') {
                
// console.log('EXECUTING TOOL:', call.function.name);
// console.log('ARGS:', call.function.arguments);
                const args =
                    typeof call.function.arguments === 'string'
                        ? JSON.parse(call.function.arguments)
                        : call.function.arguments;
                const toolresult = readFileTool(args);
                // const toolresult = readFileTool(call.function.arguments);
                messg.push({
                    role: 'tool',
                    name: call.function.name,
                    content: JSON.stringify(toolresult)
                });
            }
        }
    }
    
    const res = await ollama.chat({
        model: 'qwen2.5-coder:latest',
        messages: messg,
        stream: true
    });
// console.log('FINAL MESSAGE STACK:\n',JSON.stringify(messg, null, 2)

    return res;
}   
