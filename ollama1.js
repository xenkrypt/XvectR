import ollama from 'ollama';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFilesTool } from './tools/read_files.js';
import { fileTreeTool } from './tools/file_tree.js';
import { semanticSearch } from './retriever.js';
import { runCommandTool } from './runner.js';
import { sandrTool } from './tools/sandr.js';
import { imgRendTool } from './tools/imgrend.js';
import { impactRadiusTool } from './tools/impact_radius.js';
import { astRefactorTool } from './tools/ast_refactor.js';
import { gitAgentTool } from './tools/git_agent.js';
import { projectMemoryTool, loadSessionMessages, saveSessionMessages } from './tools/project_memory.js';
import { routeModel } from './tools/model_router.js';
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

You operate as a real codebase investigation and modification agent.

You have access to tools.

AVAILABLE TOOLS:

1. file_tree — Inspect the project structure.
2. read_files — Read one or multiple files from the workspace.
3. search_and_replace — Search for text in a file and replace it with new content.
4. semantic_search — Perform semantic search over the codebase using vector embeddings.
5. run_command — Execute terminal commands.
6. analyze_image — Analyze a pasted image using a local vision model.
7. impact_radius — Predict all files, modules, tests, and APIs affected by changing a symbol.
8. ast_refactor — Safe, syntax-aware code transformations: rename symbols, update/add/remove imports, rename files.
9. git_agent — Create branches, commit changes, generate PR summaries, get git status/diff/log.
10. project_memory — Save and load persistent notes, decisions, and session history for this workspace.

When to use impact_radius: before any rename or refactor to understand risk.
When to use ast_refactor: for structural code changes that must be safe and complete.
When to use git_agent: for any git workflow task.
When to use project_memory: to recall past decisions or save important context.

---

# PRIMARY OPERATING PRINCIPLE

You are BOTH:

- a general software engineering assistant
- a live codebase investigation agent

You MUST distinguish between:

1. GENERAL KNOWLEDGE REQUESTS
2. CODEBASE-SPECIFIC REQUESTS

Only use tools when repository context is actually required.

---

# WHEN NOT TO USE TOOLS

DO NOT use tools for:

- conceptual explanations
- language syntax questions
- algorithms/data structures
- framework theory
- interview prep
- architecture discussions not tied to the workspace
- pseudocode
- design discussions
- best practices
- debugging hypothetical code snippets pasted directly by the user
- LeetCode-style problems
- API explanations from general knowledge
- comparing technologies
- generating standalone examples
- writing documentation not tied to existing files
- brainstorming
- general programming help

If the question can be answered accurately WITHOUT inspecting the repository, answer directly without tool calls.

Examples:

- "What is dependency injection?"
- "Explain promises in JavaScript"
- "How does React reconciliation work?"
- "Write a binary search implementation"
- "What is a mutex?"
- "How does OAuth work?"

These MUST NOT trigger tools.

---

# WHEN TO USE TOOLS

You MUST use tools when the request depends on the ACTUAL workspace or repository state.

Examples:

- "Fix this bug"
- "Find where this function is called"
- "Explain this project architecture"
- "Why is this import failing?"
- "Refactor this module"
- "Add a new endpoint"
- "Trace execution flow"
- "Update this component"
- "Where is authentication implemented?"
- "Why are tests failing?"
- "Analyze memory leak in this project"
- "Find dead code"
- "Rename this class everywhere"

These REQUIRE repository inspection.

---

# TOOL USAGE RULES

1. NEVER invent file contents.

2. NEVER hallucinate:

- APIs
- functions
- variables
- classes
- imports
- dependencies
- project structure
- configuration
- execution flow

3. ALWAYS inspect files before making claims about the repository.

4. Use file_tree first when:

- project structure is unknown
- file locations are unclear
- architecture understanding is needed
- multiple modules may be involved

5. Use read_files when:

- analyzing implementation
- debugging
- tracing imports
- understanding logic
- inspecting classes/functions
- validating assumptions

6. Use search_and_replace only after sufficient investigation.

7. You may call tools multiple times.

8. Prefer exploration over assumptions.

9. If information is missing:

- continue investigating
- or explicitly state what cannot yet be determined

10. NEVER simulate tool execution.

11. NEVER describe hypothetical tool usage.

12. NEVER fabricate investigation results.

13. NEVER output fake tool calls.

14. Tool arguments MUST always be valid JSON.

15. Arrays must never be stringified.

Correct:

{"paths":["src/app.py"]}

Incorrect:

{"paths":"[src/app.py]"}

16. After tool usage:

- summarize findings clearly
- reference actual observed files
- explain reasoning concisely

17. Keep investigation efficient:

- avoid unnecessary reads
- avoid reading unrelated files
- avoid repeatedly reading the same file unless needed

---
When asked to modify code:
- ALWAYS follow through with search_and_replace after reading.
- Reading a file is NOT completion of a modification task.
- Do not summarize findings and stop — make the change.

# RESPONSE POLICY

Before any tool call, determine:

"Can this be answered correctly using general software knowledge alone?"

If YES:

- DO NOT use tools
- Answer directly

If NO:

- Investigate using tools first

Repository awareness should be deliberate, not automatic.

---

# MODIFICATION POLICY

Before modifying code:

1. Understand surrounding context.
2. Read related files/imports if necessary.
3. Preserve existing conventions.
4. Avoid unrelated edits.
5. Make minimal, targeted changes unless broader refactoring is requested.

Never perform search-and-replace operations without understanding the surrounding code first.

---

# BEHAVIORAL RULES

- Be precise.
- Be investigative.
- Be skeptical of assumptions.
- Behave like a senior engineer working in a real production repository.
- Do not pretend to know repository details you have not inspected.
- Use tools only when repository state matters.
- Avoid unnecessary tool calls for generic programming discussions.

---

IMPORTANT

Only output natural language unless making a tool call.

NEVER reveal internal reasoning.

NEVER narrate your investigation process.

NEVER explain what tools you are ABOUT to use.

ONLY provide:

- tool calls
- or final concise answers

Do not narrate actions.

Do not explain intermediate steps unless explicitly asked.

Give short answers when using tools, and detailed explanations when not using tools.
`;

function stripThinking(text = '') {
    return text
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/```thinking[\s\S]*?```/gi, '')
        .replace(/^\s*thinking:.*$/gim, '')
        .trim();
}

// Memory is now managed by project_memory.js (persistent, workspace-scoped).
// Legacy mem.json fallback kept for safety.
function loadmem(sessionId) {
    try {
        return loadSessionMessages(sessionId);
    } catch (_) {
        try {
            const memPath = path.join(__dirname, 'mem.json');
            if (!fs.existsSync(memPath)) return [];
            const memData = fs.readFileSync(memPath, 'utf-8');
            return memData.trim() ? JSON.parse(memData) : [];
        } catch (_2) { return []; }
    }
}

function savemem(mem, sessionId) {
    try {
        saveSessionMessages(sessionId, mem);
    } catch (_) {
        try {
            const memPath = path.join(__dirname, 'mem.json');
            fs.writeFileSync(memPath, JSON.stringify(mem, null, 2), 'utf-8');
        } catch (_2) {}
    }
}





export async function* getOllamaResponse(ollamares, sessionId = 'default') {
    // Dynamic model routing: pick the best model for this prompt
    const { model: selectedModel, taskType, reason: routeReason } = routeModel(ollamares);
    console.log(`[ModelRouter] Task: ${taskType} → Model: ${selectedModel} | ${routeReason}`);

    const mem = loadmem(sessionId);
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
                // {
                //     type: 'function',
                //     function: {
                //         name: 'modify_file',
                //         description: 'Modify or write the content of a file in the workspace.',
                //         parameters: {
                //             type: 'object',
                //             properties: {
                //                 path: {
                //                     type: 'string',
                //                     description: 'The file path relative to the workspace root.'
                //                 },
                //                 content: {
                //                     type: 'string',
                //                     description: 'The complete new content to write to the file.'
                //                 }
                //             },
                //             required: ['path', 'content']
                //         }
                //     }
                // },
                {
                    type: 'function',
                    function: {
                        name: 'semantic_search',
                        description: 'Perform semantic search over the codebase using vector embeddings. Use this to find relevant code snippets when you do not know the exact file names.',
                        parameters: {
                            type: 'object',
                            properties: {
                                query: {
                                    type: 'string',
                                    description: 'The search query to find relevant code.'
                                },
                                topK: {
                                    type: 'number',
                                    description: 'Number of top results to return. Default is 5.'
                                }
                            },
                            required: ['query']
                        }
                    }
                },
                {
                    type: 'function',
                    function: {
                        name: 'run_command',
                        description: 'Execute a CLI command in the terminal and get the output. Useful for running tests, npm scripts, or checking git status.',
                        parameters: {
                            type: 'object',
                            properties: {
                                command: {
                                    type: 'string',
                                    description: 'The exact terminal command to run.'
                                }
                            },
                            required: ['command']
                        }
                    }
                }
                ,{
                    type: 'function',
                    function: {
                        name: 'search_and_replace',
                        parameters: {
                            type: 'object',
                            properties: {
                                filepath: {
                                    type: 'string'
                                },
                                search: {
                                    type: 'string'
                                },
                                replace: {
                                    type: 'string'
                                }
                            },
                            required: ['filepath', 'search', 'replace']
                        }
                    }
                },
                {
                    type: 'function',
                    function: {
                        name: 'analyze_image',
                        description: 'Analyze an image from the workspace using a local vision model.',
                        parameters: {
                            type: 'object',
                            properties: {
                                imagePath: { type: 'string', description: 'The file path of the image relative to the workspace.' },
                                prompt: { type: 'string', description: 'Optional instruction on what to analyze in the image.' }
                            },
                            required: ['imagePath']
                        }
                    }
                },
                {
                    type: 'function',
                    function: {
                        name: 'impact_radius',
                        description: 'Analyze how many files, tests, and imports will be affected by changing a symbol/function/class. Use this BEFORE any refactor to assess risk.',
                        parameters: {
                            type: 'object',
                            properties: {
                                symbol: { type: 'string', description: 'The function, class, or variable name to analyze.' },
                                filePath: { type: 'string', description: 'Optional: limit search to a specific file.' }
                            },
                            required: ['symbol']
                        }
                    }
                },
                {
                    type: 'function',
                    function: {
                        name: 'ast_refactor',
                        description: 'Perform safe, syntax-aware code transformations. Operations: rename_symbol, update_import, add_import, remove_import, wrap_function, extract_variable, rename_file.',
                        parameters: {
                            type: 'object',
                            properties: {
                                operation: { type: 'string', description: 'The operation to perform.' },
                                filePath: { type: 'string', description: 'Target file path relative to workspace.' },
                                oldName: { type: 'string', description: 'Old symbol/import name for rename operations.' },
                                newName: { type: 'string', description: 'New symbol/import name for rename operations.' },
                                oldImport: { type: 'string', description: 'Old import string for update_import.' },
                                newImport: { type: 'string', description: 'New import string for update_import.' },
                                importStatement: { type: 'string', description: 'Full import line for add_import/remove_import.' },
                                functionName: { type: 'string', description: 'Function to wrap for wrap_function.' },
                                wrapperName: { type: 'string', description: 'Wrapper function name for wrap_function.' },
                                expression: { type: 'string', description: 'Expression to extract for extract_variable.' },
                                variableName: { type: 'string', description: 'New variable name for extract_variable.' }
                            },
                            required: ['operation']
                        }
                    }
                },
                {
                    type: 'function',
                    function: {
                        name: 'git_agent',
                        description: 'Perform git workflow operations: status, diff, create_branch, commit, pr_summary, log.',
                        parameters: {
                            type: 'object',
                            properties: {
                                action: { type: 'string', description: 'Git action: status | diff | create_branch | commit | pr_summary | log' },
                                branchName: { type: 'string', description: 'Branch name for create_branch action.' },
                                message: { type: 'string', description: 'Commit message for commit action.' },
                                numCommits: { type: 'number', description: 'Number of commits for log action.' }
                            },
                            required: ['action']
                        }
                    }
                },
                {
                    type: 'function',
                    function: {
                        name: 'project_memory',
                        description: 'Save or load persistent notes, architectural decisions, and session history specific to this workspace.',
                        parameters: {
                            type: 'object',
                            properties: {
                                action: { type: 'string', description: 'Action: load | save | list | delete | save_note' },
                                sessionId: { type: 'string', description: 'Session identifier (default: "default").' },
                                note: { type: 'string', description: 'A note or decision to persist for save_note action.' },
                                metadata: { type: 'object', description: 'Key-value metadata to attach to the session.' }
                            },
                            required: ['action']
                        }
                    }
                }
            ];
        let tooliter = 0;
        
        
        while (true) {
            tooliter++;
            console.log(`Tool iteration: ${tooliter}`);
            if(tooliter > 30){
                throw new Error('Too many tool iterations, possible infinite loop');

            }
            const respStream = await ollama.chat({
                model: selectedModel,
                messages: messg,
                tools,
                keep_alive: '30m',
                stream: true
            });

            let finalContent = '';
            let toolcalls = [];
            let fullMessage = { role: 'assistant', content: '' };

            for await (const chunk of respStream) {
                if (chunk.message.tool_calls) {
                    toolcalls.push(...chunk.message.tool_calls);
                }
                if (chunk.message.content) {
                    finalContent += chunk.message.content;
                    yield { type: 'chunk', message: { content: chunk.message.content } };
                }
            }

            fullMessage.content = finalContent;
            if (toolcalls.length > 0) fullMessage.tool_calls = toolcalls;

            console.log('model response content length:', finalContent.length, 'tool_calls:', toolcalls.length);

            if (toolcalls.length === 0) {
                mem.push({ role: 'user', content: ollamares });
                mem.push({ role: 'assistant', content: finalContent });
                if (mem.length > 40) mem.splice(0, mem.length - 40);
                savemem(mem, sessionId);
                return;
            }
            
            // Add the assistant's message back to the conversation before tool results
            messg.push(fullMessage);
            // mem.push(resp.message);

            for (const call of toolcalls) {
                let args = call.function.arguments || {};
                try {
                    args = typeof call.function.arguments === 'string'
                            ? JSON.parse(call.function.arguments)
                            : call.function.arguments || {};
                } catch (err) {
                    console.error('Invalid tool arguments:', err);
                    args = {};
                }
                
                let desc = `Using tool: ${call.function.name}`;
                if (call.function.name === 'read_files') {
                    desc = `Reading file(s): ${(args.paths || []).join(', ')}`;
                } else if (call.function.name === 'file_tree') {
                    desc = `Analyzing workspace file tree`;
                // } else if (call.function.name === 'modify_file') {
                //     desc = `Modifying file: ${args.path || 'unknown'}`;
                } else if (call.function.name === 'semantic_search') {
                    desc = `Searching codebase for: "${args.query || ''}"`;
                } else if (call.function.name === 'run_command') {
                    desc = `Running command: "${args.command || ''}"`;
                } else if (call.function.name === 'search_and_replace') {
                    desc = `Replacing text in file: ${args.filepath || 'unknown'}`;
                } else if (call.function.name === 'analyze_image') {
                    desc = `Analyzing image: ${args.imagePath || 'unknown'}`;
                } else if (call.function.name === 'impact_radius') {
                    desc = `Calculating impact radius for: "${args.symbol || 'unknown'}"`;
                } else if (call.function.name === 'ast_refactor') {
                    desc = `AST Refactor [${args.operation || 'unknown'}]: ${args.oldName || args.filePath || ''}`;
                } else if (call.function.name === 'git_agent') {
                    desc = `Git: ${args.action || 'unknown'}${args.branchName ? ` → ${args.branchName}` : ''}${args.message ? ` "${args.message}"` : ''}`;
                } else if (call.function.name === 'project_memory') {
                    desc = `Project Memory [${args.action || 'unknown'}]${args.sessionId ? `: ${args.sessionId}` : ''}`;
                }


                yield { type: 'tool_status', message: desc };
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
                // else if (call.function.name === 'modify_file') {
                //     if (!args || !args.path) {
                //         toolres = { success: false, error: 'Invalid arguments. "path" must be specified.' };
                //     } else {
                //         toolres = modifyFileTool(args);
                //     }
                // }
                else if (call.function.name === 'semantic_search') {
                    if (!args || !args.query) {
                        toolres = { success: false, error: 'Invalid arguments. "query" must be specified.' };
                    } else {
                        toolres = await semanticSearch(args.query, args.topK || 5);
                    }
                }
                else if (call.function.name === 'run_command') {
                    if (!args || !args.command) {
                        toolres = { success: false, error: 'Invalid arguments. "command" must be specified.' };
                    } else {
                        toolres = await runCommandTool(args);
                    }
                }
                else if (call.function.name === 'search_and_replace') {
                    if (!args || !args.filepath || args.search === undefined || args.replace === undefined) {
                        toolres = { success: false, error: 'Invalid arguments. "filepath", "search", and "replace" must be specified.' };
                    } else {
                        toolres = await sandrTool(args);
                    }
                } else if (call.function.name === 'analyze_image') {
                    if (!args || !args.imagePath) {
                        toolres = { success: false, error: 'Invalid arguments. "imagePath" must be specified.' };
                    } else {
                        toolres = await imgRendTool(args);
                    }
                } else if (call.function.name === 'impact_radius') {
                    if (!args || !args.symbol) {
                        toolres = { success: false, error: '"symbol" is required for impact_radius.' };
                    } else {
                        toolres = impactRadiusTool(args);
                    }
                } else if (call.function.name === 'ast_refactor') {
                    if (!args || !args.operation) {
                        toolres = { success: false, error: '"operation" is required for ast_refactor.' };
                    } else {
                        toolres = astRefactorTool(args);
                    }
                } else if (call.function.name === 'git_agent') {
                    if (!args || !args.action) {
                        toolres = { success: false, error: '"action" is required for git_agent.' };
                    } else {
                        toolres = await gitAgentTool(args);
                    }
                } else if (call.function.name === 'project_memory') {
                    if (!args || !args.action) {
                        toolres = { success: false, error: '"action" is required for project_memory.' };
                    } else {
                        toolres = projectMemoryTool(args);
                    }
                }
                const toolMsg = {
                    role: 'tool',
                    name: call.function.name,
                    content: JSON.stringify(toolres)
                };
                messg.push(toolMsg);
                // mem.push(toolMsg);
            }
        }
        

    // const messg = [{}]
    
}   




