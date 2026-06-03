import * as vscode from 'vscode';
import { getEmbedding, indexWorkspace } from './indexer.js';
// import { searchSimilar } from './vectordb.js';
import {searchSimilar2} from './lancedb.js';   

/**
 * @param {string} query 
 * @param {number} topK 
 * @returns {Promise<{success: boolean, results?: Array<object>, error?: string}>}
 */
export async function semanticSearch(query, topK = 5) {
    try {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceFolder) {
            return {
                success: false,
                error: 'No workspace directory is currently open'
            };
        }
        await indexWorkspace(workspaceFolder);
        const queryEmbedding = await getEmbedding(query);
        // const matches = searchSimilar(queryEmbedding, topK, workspaceFolder);
        const lancedbMatches = await searchSimilar2(queryEmbedding, topK, workspaceFolder);
        const results = lancedbMatches.map(match => ({
            filePath: match.filePath,
            type: match.type,
            name: match.name,
            startLine: match.startLine,
            endLine: match.endLine,
            score: match.score.toFixed(4),
            content: match.content
        }));

        return {
            success: true,
            results
        };
    } catch (err) {
        console.error('Semantic search failed:', err.message);
        return {
            success: false,
            error: err.message
        };
    }
}
