/**
 * Security Shield
 * Scans input text for secrets, API keys, credentials, and sensitive patterns.
 * Redacts them before the prompt is sent to the AI model.
 */

// Pattern registry: [label, regex]
const SECRET_PATTERNS = [
    ['AWS Access Key',        /\bAKIA[0-9A-Z]{16}\b/g],
    ['AWS Secret Key',        /\b[A-Za-z0-9/+=]{40}\b(?=.*aws)/gi],
    ['GitHub Token',          /\bghp_[A-Za-z0-9]{36}\b/g],
    ['GitHub OAuth',          /\bgho_[A-Za-z0-9]{36}\b/g],
    ['Slack Token',           /\bxox[baprs]-[0-9A-Za-z\-]{10,48}\b/g],
    ['Stripe Secret Key',     /\bsk_live_[A-Za-z0-9]{24,}\b/g],
    ['Stripe Publishable',    /\bpk_live_[A-Za-z0-9]{24,}\b/g],
    ['Generic API Key',       /\b(?:api[_-]?key|apikey)\s*[:=]\s*["']?[A-Za-z0-9_\-]{16,}["']?/gi],
    ['Generic Secret',        /\b(?:secret|password|passwd|pwd)\s*[:=]\s*["'][^"'\s]{8,}["']/gi],
    ['Bearer Token',          /\bBearer\s+[A-Za-z0-9\-._~+/]+=*/g],
    ['Private Key Block',     /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----[\s\S]+?-----END (?:RSA |EC )?PRIVATE KEY-----/g],
    ['JWT Token',             /\beyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\b/g],
    ['Database URL',          /\b(?:mongodb|postgres|mysql|redis|sqlite):\/\/[^\s"']+/gi],
    ['SSH Key',               /\bssh-(?:rsa|dss|ed25519)\s+[A-Za-z0-9+/=]{20,}/g],
    ['OpenAI Key',            /\bsk-[A-Za-z0-9]{48}\b/g],
    ['Google API Key',        /\bAIza[0-9A-Za-z\-_]{35}\b/g],
    ['Generic Hex Secret',    /\b(?:token|key|secret)\s*[:=]\s*["']?[0-9a-fA-F]{32,}["']?/gi],
];

/**
 * Scans a string for sensitive patterns.
 * @param {string} text - the input prompt or content
 * @returns {{ redacted: string, findings: Array<{type: string, count: number}>, hadSecrets: boolean }}
 */
export function scanAndRedact(text) {
    if (!text || typeof text !== 'string') {
        return { redacted: text, findings: [], hadSecrets: false };
    }

    let redacted = text;
    const findings = [];

    for (const [label, pattern] of SECRET_PATTERNS) {
        // Reset regex state
        pattern.lastIndex = 0;
        const matches = redacted.match(pattern);
        if (matches && matches.length > 0) {
            findings.push({ type: label, count: matches.length });
            redacted = redacted.replace(pattern, `[REDACTED:${label.replace(/ /g, '_').toUpperCase()}]`);
        }
    }

    return {
        redacted,
        findings,
        hadSecrets: findings.length > 0
    };
}

/**
 * Tool-callable wrapper for use as an agent tool.
 * args: { text: string }
 */
export function securityShieldTool(args) {
    try {
        if (!args || !args.text) {
            return { success: false, error: '"text" argument is required' };
        }
        const result = scanAndRedact(args.text);
        return {
            success: true,
            hadSecrets: result.hadSecrets,
            findings: result.findings,
            redactedText: result.redacted,
            message: result.hadSecrets
                ? `⚠️ ${result.findings.length} type(s) of sensitive data were detected and redacted before processing.`
                : '✅ No sensitive data detected.'
        };
    } catch (err) {
        return { success: false, error: err.message };
    }
}
