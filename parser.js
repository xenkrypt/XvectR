import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';
import Python from 'tree-sitter-python';
// import CPP from 'tree-sitter-cpp';
import Java from 'tree-sitter-java';

// const parser = new Parser();

// export async function parseCode(code, language) {
//     switch (language) {
//         case 'javascript':
//             parser.setLanguage(JavaScript);
//             break;
//         case 'python':
//             parser.setLanguage(Python);
//             break;
//         case 'java':
//             parser.setLanguage(Java);
//             break;
//         default:
//             throw new Error(`Unsupported language: ${language}`);
//     }
     
//     const tree = parser.parse(code);
//     console.log(tree.rootNode);
//     return tree.rootNode.toString();
// }

/**
 * @param {string} code
 * @param {string} language
 * @returns {Array<{type: string, name: string, startLine: number, endLine: number, content: string}>}
 */
export function extractChunks(code, language) {
    let langModule;
    switch (language.toLowerCase()) {
        case 'javascript':
        case 'javascriptreact':
        case 'typescript':
        case 'typescriptreact':
        case 'js':
        case 'jsx':
        case 'ts':
        case 'tsx':
            langModule = JavaScript;
            break;
        case 'python':
        case 'py':
            langModule = Python;
            break;
        case 'java':
            langModule = Java;
            break;
        default:
            return [];
    }

    const localParser = new Parser();
    localParser.setLanguage(langModule);
    
    let tree;
    try {
        tree = localParser.parse(code);
    } catch (err) {
        console.error('Failed to parse code with tree-sitter:', err.message);
        return [];
    }

    const chunks = [];
    const lines = code.split('\n');
    const coveredLines = new Set();

    function getNameOfNode(node) {
        for (let i = 0; i < node.childCount; i++) {
            const child = node.child(i);
            if (child.type === 'identifier' || child.type === 'property_identifier') {
                return child.text;
            }
        }
        return '';
    }

    function traverse(node) {
        let isStructural = false;
        let chunkType = '';
        let chunkName = '';

        const lang = language.toLowerCase();
        if (lang === 'javascript' || lang === 'js' || lang === 'jsx' || lang === 'typescript' || lang === 'ts' || lang === 'tsx') {
            if (node.type === 'function_declaration' || node.type === 'class_declaration') {
                isStructural = true;
                chunkType = node.type === 'function_declaration' ? 'function' : 'class';
                chunkName = getNameOfNode(node);
            } else if (node.type === 'method_definition') {
                isStructural = true;
                chunkType = 'method';
                chunkName = getNameOfNode(node);
            } else if (node.type === 'variable_declarator') {
                const initNode = node.childForFieldName('value') || node.childForFieldName('init');
                if (initNode && (initNode.type === 'arrow_function' || initNode.type === 'function_expression')) {
                    isStructural = true;
                    chunkType = 'function';
                    chunkName = getNameOfNode(node);
                }
            }
        } else if (lang === 'python' || lang === 'py') {
            if (node.type === 'function_definition') {
                isStructural = true;
                chunkType = 'function';
                chunkName = getNameOfNode(node);
            } else if (node.type === 'class_definition') {
                isStructural = true;
                chunkType = 'class';
                chunkName = getNameOfNode(node);
            }
        } else if (lang === 'java') {
            if (node.type === 'class_declaration' || node.type === 'interface_declaration') {
                isStructural = true;
                chunkType = 'class';
                chunkName = getNameOfNode(node);
            } else if (node.type === 'method_declaration') {
                isStructural = true;
                chunkType = 'method';
                chunkName = getNameOfNode(node);
            }
        }

        if (isStructural) {
            const startLine = node.startPosition.row + 1;
            const endLine = node.endPosition.row + 1;
            // console.log(`Processing structural node from lines ${startLine} to ${endLine}`);
            for (let l = startLine; l <= endLine; l++) {
                coveredLines.add(l);
            }

            chunks.push({
                type: chunkType,
                name: chunkName || 'anonymous',
                startLine,
                endLine,
                content: node.text
            });
        }

        for (let i = 0; i < node.childCount; i++) {
            traverse(node.child(i));
        }
    }

    traverse(tree.rootNode);
    let startUncovered = null;
    for (let l = 1; l <= lines.length; l++) {
        const isCovered = coveredLines.has(l);
        const lineContent = lines[l - 1].trim();
        const isEmpty = lineContent === '';

        if (!isCovered && !isEmpty) {
            if (startUncovered === null) {
                startUncovered = l;
            }
        } else {
            if (startUncovered !== null) {
                const endUncovered = l - 1;
                const chunkLines = lines.slice(startUncovered - 1, endUncovered);
                const chunkContent = chunkLines.join('\n');
                
                if (chunkContent.trim().length > 10) {
                    chunks.push({
                        type: 'general',
                        name: 'module_level',
                        startLine: startUncovered,
                        endLine: endUncovered,
                        content: chunkContent
                    });
                }
                startUncovered = null;
            }
        }
    }
    if (startUncovered !== null) {
        const endUncovered = lines.length;
        const chunkLines = lines.slice(startUncovered - 1, endUncovered);
        const chunkContent = chunkLines.join('\n');
        // console.log(`Adding final uncovered chunk from lines ${startUncovered} to ${endUncovered}`);
        // console.log(`Final chunk content preview: ${chunkContent.substring(0, 100)}...`);

        if (chunkContent.trim().length > 10) {
            chunks.push({
                type: 'general',
                name: 'module_level',
                startLine: startUncovered,
                endLine: endUncovered,
                content: chunkContent
            });
        }
    }

    chunks.sort((a, b) => a.startLine - b.startLine);
    return chunks;
}

/**
 * @param {string} code
 * @param {number} chunkSize
 * @param {number} overlap
 * @returns {Array<{type: string, name: string, startLine: number, endLine: number, content: string}>}
 */
export function chunkUnsupportedFile(code, chunkSize = 20, overlap = 5) {
    const lines = code.split('\n');
    const chunks = [];
    
    for (let i = 0; i < lines.length; i += (chunkSize - overlap)) {
        const end = Math.min(i + chunkSize, lines.length);
        const chunkLines = lines.slice(i, end);
        const chunkContent = chunkLines.join('\n');
        // console.log(`Creating chunk from lines ${i + 1} to ${end}`);
        // console.log(`Chunk content preview: ${chunkContent.substring(0, 100)}...`);


        if (chunkContent.trim().length > 10) {
            chunks.push({
                type: 'general',
                name: 'text_block',
                startLine: i + 1,
                endLine: end,
                content: chunkContent
            });
        }
        if (end === lines.length) break;
    }
    return chunks;
}



// parseCode('function add(a, b) { return a + b; }', 'javascript');
