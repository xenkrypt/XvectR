import ollama from 'ollama';
// import { webSearch } from './intents/web_search.js';
// import {getdateTime} from './intents/date_time.js';
import fs from 'fs';
import path from 'path';
// import * as vscode from 'vscode';
import { fileURLToPath } from 'url';
import { readFilesTool } from './tools/read_files.js';
import { fileTreeTool } from './tools/file_tree.js';
import { modifyFileTool } from './tools/modify_file.js';

import zlib from 'zlib';
import crypto from 'crypto';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);




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


const sysprompt = `You are XvectR, an autonomous software engineering assistant.

You operate as a real codebase investigation agent.

You have access to tools.

AVAILABLE TOOLS:

1. file_tree

* Inspect the project structure.

2. read_files

* Read one or multiple files from the workspace.

3. modify_file

* Modify or write the content of a file in the workspace.

TOOL USAGE RULES:

1. NEVER invent file contents.

2. NEVER hallucinate APIs, functions, variables, classes, imports, or project structure.

3. If the user asks about:

* code
* files
* bugs
* functions
* architecture
* imports
* errors
* dependencies
* execution flow
* project structure

you MUST inspect relevant files using tools BEFORE answering.

4. Use file_tree first when:

* project structure is unknown
* file locations are unclear
* architecture understanding is needed

5. Use read_files when:

* analyzing implementation
* debugging
* understanding logic
* comparing files
* tracing imports
* inspecting functions/classes

6. You may call tools MULTIPLE TIMES before answering.

7. After reading files:

* reason carefully
* explain technically
* stay concise
* reference actual observed code

8. Prefer exploration over assumptions.

9. If information is missing:

* continue using tools
* or explicitly state what is missing

10. NEVER simulate tool execution.

11. NEVER describe how you WOULD use a tool.

12. NEVER write fake example code for tool usage.

13. NEVER output markdown code blocks containing fake tool calls.

14. When using tools, rely on the native tool calling capability provided by the API.
Your goal is to behave like a real autonomous software engineer investigating a live codebase.
15. Never respond in JSON format to the user.
16. Only output natural language unless making a tool call.
17. After tool execution, summarize results conversationally.
18. Tool arguments MUST always be valid JSON.
19. Arrays must not be stringified.
20. Correct example:
{"paths":["file.py"]}
21. Incorrect example:
{"paths":"[file.py]"}

`;

function loadmem() {
    try {
        const memPath = path.join(__dirname, 'mem.json');
        if (!fs.existsSync(memPath)) {
            fs.writeFileSync(memPath, '[]', 'utf-8');
            return [];
        }
        const memData = fs.readFileSync(memPath, 'utf-8');
        if (!memData.trim()) {
            return [];
        }
        return JSON.parse(memData);
    } catch(err) {
        console.error('Error loading memory:', err);
        const memPath = path.join(__dirname, 'mem.json');
            fs.writeFileSync(
                memPath,
                '[]',
                'utf-8'
            );
            return [];
    }}

function savemem(mem) {
    try {
        const memPath = path.join(__dirname, 'mem.json');
        fs.writeFileSync(
            memPath,
            JSON.stringify(mem, null, 2),
            'utf-8'
        );
        console.log('Memory saved:', memPath);
    } catch(err) {
        console.error('Error saving memory:', err);
    }
}



export async function getOllamaResponse(ollamares) {
    // const intent = await intentrec(ollamares);
    // console.log('intent:', intent);
    // const dat = fs.readFileSync('./memo.txt', 'utf-8');
    
    // let mem = loadmem();
    const mem = loadmem();
    const messg = [
        {
            role: 'system',
            content: sysprompt
        },
        ...mem,
        {
            role: 'user',
            content: ollamares
        }
    ];
    // mem.push({role: 'user', content: ollamares});
    // const messg = [
    //     {
    //         role: 'system',
    //         content: sysprompt
    //     },...mem
    // ]
    const tools = [
                {
                    type: 'function',
                    function: {
                        name: 'read_files',
                        description:
                            'Read one or multiple files from the workspace. Example arguments: {"paths":["app.js","index.js"]}',
                        parameters: {
                            type: 'object',
                            properties: {
                                paths: {
                                    type: 'array',
                                    items: {
                                        type: 'string'
                                    },
                                    description:
                                        'List of file paths to read, relative to the workspace root.'
                                }
                            },
                            required: ['paths']
                        }
                    }
                },
                {
                    type: 'function',
                    function: {
                        name: 'file_tree',
                        description: "Get the project's file tree.",
                        parameters: {
                            type: 'object',
                            properties: {}
                        }
                    }
                },
                {
                    type: 'function',
                    function: {
                        name: 'modify_file',
                        description: 'Modify or write the content of a file in the workspace.',
                        parameters: {
                            type: 'object',
                            properties: {
                                path: {
                                    type: 'string',
                                    description: 'The file path relative to the workspace root.'
                                },
                                content: {
                                    type: 'string',
                                    description: 'The complete new content to write to the file.'
                                }
                            },
                            required: ['path', 'content']
                        }
                    }
                }
            ];
        let tooliter = 0;

        
        while (true) {
            tooliter++;
            if(tooliter > 10){
                throw new Error('Too many tool iterations, possible infinite loop');

            }
            const resp = await ollama.chat({
                model: 'qwen3.5:0.8b',
                messages: messg,
                tools,
                stream: false
            });
            console.log('model response: ', JSON.stringify(resp,null,2));
            // const toolcalls = resp.message.tool_calls || [];
            let toolcalls = resp.message.tool_calls || [];
            console.log(
                'RAW TOOL CALLS:',
                JSON.stringify(
                    resp.message.tool_calls,
                    null,
                    2
                )
            );
            console.log(
                'RAW CONTENT:',
                resp.message.content
            );
            if (toolcalls.length === 0) {
                const finalRespStream = await ollama.chat({
                    model: 'qwen3.5:9b',
                    messages: messg,
                    stream: true
                });
                async function* gen() {
                    let accumulatedContent = '';
                    for await (const chunk of finalRespStream) {
                        const contentChunk = chunk.message.content || '';
                        accumulatedContent += contentChunk;
                        yield {
                            message: {
                                content: contentChunk
                            }
                        };
                    }
                    mem.push({role: 'user', content: ollamares});
                    mem.push({role: 'assistant',content: accumulatedContent});
                    if (mem.length > 20) {
                        mem.splice(0, mem.length - 20);
                    }
                    savemem(mem);
                }
                return gen();
            }
            messg.push(resp.message);
            mem.push(resp.message);
            for (const call of toolcalls) {
                let args = call.function.arguments || {};
                try {
                    args =
                        typeof call.function.arguments === 'string'
                            ? JSON.parse(call.function.arguments)
                            : call.function.arguments || {};
                } catch (err) {
                    console.error('Invalid tool arguments:', err);

                    args = {};
                }
                let toolres;
                if (call.function.name === 'read_files') {
                    if (!args || !Array.isArray(args.paths)) {
                        toolres = { success: false, error: 'Invalid arguments. "paths" must be an array of file path strings. Example: {"paths": ["app.js"]}' };
                    } else {
                        toolres = readFilesTool(args);
                    }
                }
                else if (call.function.name === 'file_tree') {
                    toolres = fileTreeTool();
                }
                else if (call.function.name === 'modify_file') {
                    if (!args || !args.path) {
                        toolres = { success: false, error: 'Invalid arguments. "path" must be specified.' };
                    } else {
                        toolres = modifyFileTool(args);
                    }
                }
                else{
                    toolres = {
                        success: false,
                        error: 'Unknown tool'
                    };
                }
                const toolMsg = {
                    role: 'tool',
                    name: call.function.name,
                    // tool_call_id: call.id || crypto.randomUUID(),
                    content: JSON.stringify(toolres)
                };
                messg.push(toolMsg);
                // mem.push(toolMsg);
            }
        }
    
    // const messg = [{}]
    
}   