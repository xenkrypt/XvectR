import fs from 'fs';
import path from 'path';
import * as vscode from 'vscode';

const MEMORY_DIR_NAME = '.xvectr';

function getMemoryDir() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceFolder) throw new Error('No workspace open');
    const memDir = path.join(workspaceFolder, MEMORY_DIR_NAME);
    if (!fs.existsSync(memDir)) fs.mkdirSync(memDir, { recursive: true });
    return memDir;
}

function getMemoryFilePath(sessionId) {
    const memDir = getMemoryDir();
    const safeId = (sessionId || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(memDir, `session_${safeId}.json`);
}

function loadSession(sessionId) {
    const filePath = getMemoryFilePath(sessionId);
    if (!fs.existsSync(filePath)) return { id: sessionId, messages: [], metadata: {}, createdAt: new Date().toISOString() };
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (_) {
        return { id: sessionId, messages: [], metadata: {}, createdAt: new Date().toISOString() };
    }
}

function saveSession(session) {
    const filePath = getMemoryFilePath(session.id);
    session.updatedAt = new Date().toISOString();
    fs.writeFileSync(filePath, JSON.stringify(session, null, 2), 'utf-8');
}

function listSessions() {
    const memDir = getMemoryDir();
    const files = fs.readdirSync(memDir).filter(f => f.startsWith('session_') && f.endsWith('.json'));
    return files.map(f => {
        try {
            const data = JSON.parse(fs.readFileSync(path.join(memDir, f), 'utf-8'));
            return {
                id: data.id,
                messageCount: data.messages?.length || 0,
                metadata: data.metadata || {},
                createdAt: data.createdAt,
                updatedAt: data.updatedAt
            };
        } catch (_) { return null; }
    }).filter(Boolean);
}

/**
 * Project Memory Tool - manages persistent workspace-specific chat sessions.
 * args: {
 *   action: 'load' | 'save' | 'list' | 'delete' | 'save_note',
 *   sessionId?: string,
 *   messages?: array,        // for 'save' action
 *   metadata?: object,       // for 'save' action
 *   note?: string            // for 'save_note' action
 * }
 */
export function projectMemoryTool(args) {
    try {
        const action = args.action;
        if (!action) throw new Error('"action" argument is required');

        // --- LIST sessions ---
        if (action === 'list') {
            const sessions = listSessions();
            return { success: true, sessions };
        }

        // --- LOAD session ---
        if (action === 'load') {
            const sessionId = args.sessionId || 'default';
            const session = loadSession(sessionId);
            return { success: true, session };
        }

        // --- SAVE session messages ---
        if (action === 'save') {
            const sessionId = args.sessionId || 'default';
            const session = loadSession(sessionId);
            if (args.messages) session.messages = args.messages;
            if (args.metadata) session.metadata = { ...session.metadata, ...args.metadata };
            saveSession(session);
            return { success: true, message: `Session "${sessionId}" saved.` };
        }

        // --- SAVE a sticky note / architectural decision ---
        if (action === 'save_note') {
            const sessionId = args.sessionId || 'default';
            const note = args.note;
            if (!note) return { success: false, error: '"note" is required for save_note action' };
            const session = loadSession(sessionId);
            if (!session.metadata.notes) session.metadata.notes = [];
            session.metadata.notes.push({ content: note, savedAt: new Date().toISOString() });
            saveSession(session);
            return { success: true, message: 'Note saved to project memory.' };
        }

        // --- DELETE session ---
        if (action === 'delete') {
            const sessionId = args.sessionId;
            if (!sessionId) return { success: false, error: '"sessionId" is required for delete action' };
            const filePath = getMemoryFilePath(sessionId);
            if (!fs.existsSync(filePath)) return { success: false, error: `Session "${sessionId}" not found.` };
            fs.unlinkSync(filePath);
            return { success: true, message: `Session "${sessionId}" deleted.` };
        }

        return { success: false, error: `Unknown action: ${action}` };

    } catch (err) {
        return { success: false, error: err.message };
    }
}

// ─── Low-level helpers for chatViewProvider.js ─────────────────────────────

/**
 * Loads conversation history for a given session ID.
 * Falls back to 'default' if not specified.
 */
export function loadSessionMessages(sessionId = 'default') {
    try {
        const session = loadSession(sessionId);
        return session.messages || [];
    } catch (_) { return []; }
}

/**
 * Saves conversation messages for a session, trimming to maxMessages.
 */
export function saveSessionMessages(sessionId = 'default', messages = [], maxMessages = 40) {
    try {
        const session = loadSession(sessionId);
        session.messages = messages.slice(-maxMessages);
        saveSession(session);
    } catch (err) {
        console.error('Failed to save session messages:', err.message);
    }
}

/**
 * Returns a list of all available session IDs.
 */
export function getSessionList() {
    try { return listSessions(); }
    catch (_) { return []; }
}

/**
 * Renames a session by setting a title in its metadata.
 */
export function renameSession(sessionId, title) {
    try {
        const session = loadSession(sessionId);
        session.metadata = session.metadata || {};
        session.metadata.title = title;
        saveSession(session);
    } catch (err) {
        console.error('Failed to rename session:', err.message);
    }
}

/**
 * Checks if a session has no messages yet.
 */
export function isSessionEmpty(sessionId) {
    try {
        const session = loadSession(sessionId);
        return !session.messages || session.messages.length === 0;
    } catch (err) {
        return true;
    }
}
