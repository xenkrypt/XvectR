/**
 * Dynamic Model Router
 * Analyzes the incoming prompt and routes it to the most appropriate
 * local Ollama model for the task type.
 * 
 * Model capability map (user can override by having these pulled locally):
 *  - qwen3.5:4b        → general coding, reasoning, tool use, orchestration
 *  - deepseek-coder:6.7b → heavy code generation, refactoring (if available)
 *  - moondream         → vision / image analysis
 *  - qwen2.5:3b        → fast Q&A, explanations, non-code tasks
 */

/** Task type → preferred model mapping */
const MODEL_MAP = {
    vision:   'moondream',
    code:     'qwen3.5:4b',
    reason:   'qwen3.5:4b',
    fast:     'qwen2.5:3b',
    git:      'qwen3.5:4b',
    default:  'qwen3.5:4b'
};

/** Keyword-based classifiers to detect task type */
const CLASSIFIERS = [
    {
        type: 'vision',
        patterns: [/image/i, /screenshot/i, /diagram/i, /photo/i, /visual/i, /see\b/i, /look at/i]
    },
    {
        type: 'code',
        patterns: [/refactor/i, /implement/i, /write a function/i, /write code/i, /create a class/i, /fix the bug/i, /search.and.replace/i, /ast/i, /syntax/i, /compile/i]
    },
    {
        type: 'git',
        patterns: [/commit/i, /branch/i, /pull request/i, /\bpr\b/i, /merge/i, /git\b/i, /diff/i, /changelog/i]
    },
    {
        type: 'reason',
        patterns: [/explain/i, /analyze/i, /architecture/i, /impact/i, /why/i, /how does/i, /trace/i, /dependency/i]
    },
    {
        type: 'fast',
        patterns: [/what is/i, /define/i, /list/i, /summarize/i, /translate/i, /format/i]
    }
];

/**
 * Classifies a prompt into a task type.
 * @param {string} prompt
 * @returns {'vision'|'code'|'reason'|'fast'|'git'|'default'}
 */
export function classifyPrompt(prompt) {
    if (!prompt) return 'default';

    const lower = prompt.toLowerCase();
    const scores = {};

    for (const { type, patterns } of CLASSIFIERS) {
        scores[type] = 0;
        for (const p of patterns) {
            if (p.test(lower)) scores[type]++;
        }
    }

    const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
    if (best && best[1] > 0) return best[0];
    return 'default';
}

/**
 * Returns the best model for a given prompt.
 * @param {string} prompt
 * @returns {{ taskType: string, model: string, reason: string }}
 */
export function routeModel(prompt) {
    const taskType = classifyPrompt(prompt);
    const model = MODEL_MAP[taskType] || MODEL_MAP.default;

    const reasons = {
        vision:  'Image/visual analysis detected → routing to moondream vision model.',
        code:    'Code generation/refactoring task → routing to qwen3.5:4b for strong tool use.',
        reason:  'Deep reasoning/analysis task → routing to qwen3.5:4b.',
        git:     'Git workflow task → routing to qwen3.5:4b for reliable tool use.',
        fast:    'Simple Q&A task → routing to qwen2.5:3b for fast response.',
        default: 'General task → routing to default qwen3.5:4b model.'
    };

    return { taskType, model, reason: reasons[taskType] || reasons.default };
}

/**
 * Tool-callable wrapper.
 * args: { prompt: string }
 */
export function modelRouterTool(args) {
    try {
        if (!args || !args.prompt) return { success: false, error: '"prompt" argument is required' };
        const result = routeModel(args.prompt);
        return { success: true, ...result };
    } catch (err) {
        return { success: false, error: err.message };
    }
}
