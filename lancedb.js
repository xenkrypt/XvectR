import * as lancedb from "@lancedb/lancedb";
import path from 'path';

export async function getDB(workspaceFolder) {
    const dbPath = path.join(workspaceFolder, '.xvectr', 'lancedb');
    return await lancedb.connect(dbPath);
}
export async function getOrMakeTable(workspaceFolder) {
    const db = await getDB(workspaceFolder);
    const tableNames = await db.tableNames();
    
    if (tableNames.includes('chunks')) {
        return await db.openTable('chunks');
    } else {
        const table = await db.createTable('chunks', [{
            filePath: 'dummy',
            type: 'dummy',
            name: 'dummy',
            startLine: 0,
            endLine: 0,
            content: 'dummy',
            vector: Array(768).fill(0) 
        }]);
        // await table.delete("filePath = 'dummy'");
        return table;
    }
}
export async function addChunks(chunks, workspaceFolder) {
    if (!chunks || chunks.length === 0) return;
    const table = await getOrMakeTable(workspaceFolder);
    await table.add(
        chunks.map(chunk => ({
            filePath: chunk.filePath,
            type: chunk.type || '',
            name: chunk.name || '',
            startLine: chunk.startLine || 0,
            endLine: chunk.endLine || 0,
            content: chunk.content || '',
            vector: chunk.embedding 
        }))
    );
}

export async function replaceFileChunks(filePath, newChunks, workspaceFolder) {
    const table = await getOrMakeTable(workspaceFolder);
    await table.delete(`filePath = '${filePath.replace(/'/g, "''")}'`);
    
    if (newChunks && newChunks.length > 0) {
        await addChunks(newChunks, workspaceFolder);
    }
}
// export async function loadStore(workspaceFolder) {
//     return { files: {} }; 
// }

// export async function saveStore(store, workspaceFolder) {
//     let allChunks = [];
//     for (const [relativePath, fileData] of Object.entries(store.files || {})) {
//         for (const chunk of fileData.chunks || []) {
//             if (chunk.embedding) {
                
//                 allChunks.push({
//                     filePath: relativePath,
//                     type: chunk.type,
//                     name: chunk.name,
//                     startLine: chunk.startLine,
//                     endLine: chunk.endLine,
//                     content: chunk.content,
//                     embedding: chunk.embedding
//                 });
//             }
//         }
//     }

//     if (allChunks.length === 0) return;

//     const db = await getDB(workspaceFolder);
//     const tableNames = await db.tableNames();
//     if (tableNames.includes('chunks')) {
//         await db.dropTable('chunks');
//     }
//     await addChunks(allChunks, workspaceFolder);
// }

export function cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
    let dotProduct = 0, normA = 0, normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    // console.log(`cosine sim: dotProduct=${dotProduct}, normA=${normA}, normB=${normB}`);
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
export async function searchSimilar2(queryEmbedding, topK = 5, workspaceFolder) {
    const table = await getOrMakeTable(workspaceFolder);
    const res = await table
        .search(queryEmbedding)
        .limit(topK)
        .toArray(); 

    return res.map(row => ({
        filePath: row.filePath,
        type: row.type,
        name: row.name,
        startLine: row.startLine,
        endLine: row.endLine,
        content: row.content,
        score: 1 - (row._distance || 0)
    }));
}
// export async function searchSimilar(queryEmbedding, topK = 5, workspaceFolder) {
//     return await searchSimilar2(queryEmbedding, topK, workspaceFolder);
// }
