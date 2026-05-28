import fs from 'fs';
import path from 'path';
import ollama from 'ollama';
import { extractChunks, chunkUnsupportedFile } from './parser.js';
import { loadStore, saveStore } from './vectordb.js';

/**
 * @param {string} dir
 * @param {Array<string>} fileList
 * @returns {Array<string>} 
 */
export function getAllFiles(dir, fileList = []) {
    try {
        const files = fs.readdirSync(dir, { withFileTypes: true });
        for (const file of files) {
            const fullPath = path.join(dir, file.name);
            if (file.isDirectory()) {
                if (
                    file.name === 'node_modules' ||
                    file.name === '.git' ||
                    file.name === '.vscode' ||
                    file.name === '.vscode-test' ||
                    file.name === '.xvectr' ||
                    file.name === 'dist' ||
                    file.name === 'out'
                ){
                    continue;
                }
                getAllFiles(fullPath, fileList);
            } else {
                const ext = path.extname(file.name).toLowerCase();
                const indexableExtensions = [
                    '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx',
                    '.py', '.java', '.json', '.md', '.txt',
                    '.html', '.css', '.cpp', '.h', '.c', '.cs', '.go'
                ];
                if (indexableExtensions.includes(ext)) {
                    fileList.push(fullPath);
                }
            }
        }
    } catch (err) {
        console.error(`Failed to read directory ${dir}:`, err.message);
    }
    return fileList;
}

/**
 * @param {string} text
 * @param {string} model
 * @returns {Promise<Array<number>>}
 */
export async function getEmbedding(text, model = 'nomic-embed-text') {
    try {
        const response = await ollama.embed({
            model,
            input: text
        });
        if (response.embeddings && response.embeddings.length > 0) {
            return response.embeddings[0];
        }
        throw new Error('Embeddings array returned by Ollama is empty');
    } catch (err) {
        console.warn(`Embedding generation failed for model "${model}":`, err.message);
        if (model !== 'qwen3-embedding:0.6b') {
            console.log('Attempting fallback embedding generation using model "qwen3.5:0.8b"...');
            return getEmbedding(text, 'qwen3.5:0.8b');
        }
        throw err;
    }
}

/**
 * @param {string} workspaceFolder
 */
export async function indexWorkspace(workspaceFolder) {
    console.log(`Starting workspace indexing at: ${workspaceFolder}`);
    
    let store;
    try {
        store = loadStore(workspaceFolder);
    } catch (err) {
        console.warn('Could not load existing store, starting fresh:', err.message);
        store = { files: {} };
    }

    if (!store.files) {
        store.files = {};
    }

    const allFiles = getAllFiles(workspaceFolder);
    console.log(`Found ${allFiles.length} candidate files for indexing.`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const filePath of allFiles) {
        const relativePath = path.relative(workspaceFolder, filePath).replace(/\\/g, '/');
        
        let stats;
        try {
            stats = fs.statSync(filePath);
        } catch (statErr) {
            console.error(`Failed to stat file ${relativePath}:`, statErr.message);
            continue;
        }
        const mtime = stats.mtimeMs;
        if (store.files[relativePath] && store.files[relativePath].mtime === mtime) {
            skippedCount++;
            continue;
        }

        console.log(`Indexing file: ${relativePath}`);
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const ext = path.extname(filePath).toLowerCase();
            let language = '';
            if (['.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx'].includes(ext)) {
                language = 'javascript';
            } else if (['.py'].includes(ext)) {
                language = 'python';
            } else if (['.java'].includes(ext)) {
                language = 'java';
            }

            let chunks = [];
            if (language) {
                chunks = extractChunks(content, language);
            } else {
                chunks = chunkUnsupportedFile(content);
            }
            const enrichedChunks = [];
            for (const chunk of chunks) {
                if (chunk.content && chunk.content.trim().length > 0) {
                    try {
                        const embedding = await getEmbedding(chunk.content);
                        enrichedChunks.push({
                            ...chunk,
                            embedding
                        });
                    } catch (embedErr) {
                        console.error(`Failed to generate embedding for chunk in ${relativePath} (lines ${chunk.startLine}-${chunk.endLine}):`, embedErr.message);
                    }
                }
            }
            store.files[relativePath] = {
                mtime,
                chunks: enrichedChunks
            };
            updatedCount++;
            saveStore(store, workspaceFolder);
        } catch (err) {
            console.error(`Failed to index file ${relativePath}:`, err.message);
        }
    }

    console.log(`Indexing process completed. Updated: ${updatedCount} files, Skipped: ${skippedCount} unchanged files.`);
}
