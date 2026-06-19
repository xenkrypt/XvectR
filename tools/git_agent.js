import { exec } from 'child_process';
import * as vscode from 'vscode';

function run(cmd, cwd) {
    return new Promise((resolve) => {
        exec(cmd, { cwd }, (err, stdout, stderr) => {
            if (err) resolve({ success: false, error: err.message, stderr: stderr?.trim() });
            else resolve({ success: true, stdout: stdout?.trim() });
        });
    });
}

/**
 * Git Workflow Agent Tool
 * args: {
 *   action: 'status' | 'diff' | 'create_branch' | 'commit' | 'pr_summary' | 'log',
 *   branchName?: string,
 *   message?: string,
 *   numCommits?: number
 * }
 */
export async function gitAgentTool(args) {
    try {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceFolder) throw new Error('No workspace open');

        const action = args.action;
        if (!action) throw new Error('"action" argument is required');

        // --- STATUS ---
        if (action === 'status') {
            const statusRes = await run('git status --short', workspaceFolder);
            const branchRes = await run('git branch --show-current', workspaceFolder);
            if (!statusRes.success) return statusRes;
            return {
                success: true,
                currentBranch: branchRes.stdout || 'unknown',
                status: statusRes.stdout || 'Working tree clean'
            };
        }

        // --- DIFF ---
        if (action === 'diff') {
            const res = await run('git diff HEAD', workspaceFolder);
            if (!res.success) return res;
            return {
                success: true,
                diff: res.stdout || 'No changes detected since last commit.'
            };
        }

        // --- CREATE BRANCH ---
        if (action === 'create_branch') {
            const name = args.branchName;
            if (!name) return { success: false, error: '"branchName" is required for create_branch action' };
            // Sanitize branch name
            const safeName = name.replace(/[^a-zA-Z0-9\-_./]/g, '-');
            const res = await run(`git checkout -b ${safeName}`, workspaceFolder);
            if (!res.success) return res;
            return { success: true, message: `Switched to new branch: ${safeName}` };
        }

        // --- COMMIT ---
        if (action === 'commit') {
            const msg = args.message;
            if (!msg) return { success: false, error: '"message" is required for commit action' };
            // Stage all changes
            const stageRes = await run('git add -A', workspaceFolder);
            if (!stageRes.success) return stageRes;
            const commitRes = await run(`git commit -m "${msg.replace(/"/g, '\\"')}"`, workspaceFolder);
            if (!commitRes.success) return commitRes;
            return { success: true, message: commitRes.stdout };
        }

        // --- PR SUMMARY ---
        if (action === 'pr_summary') {
            // Get current branch and base
            const branchRes = await run('git branch --show-current', workspaceFolder);
            const diffRes   = await run('git diff main...HEAD --stat 2>/dev/null || git diff master...HEAD --stat', workspaceFolder);
            const logRes    = await run('git log main..HEAD --oneline 2>/dev/null || git log master..HEAD --oneline', workspaceFolder);
            const changedRes = await run('git diff main...HEAD --name-only 2>/dev/null || git diff master...HEAD --name-only', workspaceFolder);

            return {
                success: true,
                prSummary: {
                    branch: branchRes.stdout || 'unknown',
                    commits: logRes.stdout || 'No commits',
                    changedFiles: changedRes.stdout ? changedRes.stdout.split('\n').filter(Boolean) : [],
                    diffStats: diffRes.stdout || 'No diff stats'
                }
            };
        }

        // --- LOG ---
        if (action === 'log') {
            const n = args.numCommits || 10;
            const res = await run(`git log --oneline -${n}`, workspaceFolder);
            if (!res.success) return res;
            return { success: true, log: res.stdout };
        }

        return { success: false, error: `Unknown action: ${action}. Valid: status, diff, create_branch, commit, pr_summary, log` };

    } catch (err) {
        return { success: false, error: err.message };
    }
}
