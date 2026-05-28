import fs from 'fs';
import path from 'path';

/**
 * @param {string} workspaceFolder
 * @returns {object} 
 */
export function loadStore(workspaceFolder) {
    const storePath = path.join(workspaceFolder, '.xvectr', 'vector_store.json');
    try {
        if (fs.existsSync(storePath)) {
            const data = fs.readFileSync(storePath, 'utf-8');
            if (data.trim()) {
                return JSON.parse(data);
            }
        }
    } catch (err) {
        console.error('Failed to load vector store, returning empty store:', err.message);
    }
    return { files: {} };
}

/**
 * @param {object} store
 * @param {string} workspaceFolder
 */
export function saveStore(store, workspaceFolder) {
    const dir = path.join(workspaceFolder, '.xvectr');
    const storePath = path.join(dir, 'vector_store.json');
    try {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf-8');
        const gitignorePath = path.join(workspaceFolder, '.gitignore');
        try {
            if (fs.existsSync(gitignorePath)) {
                let gitignore = fs.readFileSync(gitignorePath, 'utf-8');
                if (!gitignore.includes('.xvectr/')) {
                    const newline = gitignore.endsWith('\n') ? '' : '\n';
                    fs.appendFileSync(gitignorePath, `${newline}.xvectr/\n`, 'utf-8');
                }
            } else {
                fs.writeFileSync(gitignorePath, '.xvectr/\n', 'utf-8');
            }
        } catch (gitErr) {
            console.error('Failed to update .gitignore:', gitErr.message);
        }
    } catch (err) {
        console.error('Failed to save vector store:', err.message);
    }
}

/**
 * @param {Array<number>} vecA
 * @param {Array<number>} vecB
 * @returns {number}
 */

export function cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}


/**
 * @param {Array<number>} queryEmbedding
 * @param {number} topK
 * @param {string} workspaceFolder
 * @returns {Array<object>} 
 */
export function searchSimilar(queryEmbedding, topK = 5, workspaceFolder) {
    const store = loadStore(workspaceFolder);
    const results = [];
    // console.log('store files:', Object.keys(store.files || {}));
    for (const [relativePath, fileData] of Object.entries(store.files || {})) {
        for (const chunk of fileData.chunks || []) {
            if (!chunk.embedding) continue;
            const score = cosineSimilarity(queryEmbedding, chunk.embedding);
            results.push({
                filePath: relativePath,
                type: chunk.type,
                name: chunk.name,
                startLine: chunk.startLine,
                endLine: chunk.endLine,
                content: chunk.content,
                score
            });
        }
    }
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, topK);
}
