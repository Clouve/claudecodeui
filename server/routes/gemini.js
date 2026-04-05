import express from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import sessionManager from '../sessionManager.js';
import { sessionNamesDb } from '../database/db.js';

const router = express.Router();

/**
 * Delete a CLI session file from ~/.gemini/tmp/ that matches the given sessionId.
 * The sessionId may be our internal id (gemini_xxx) or the CLI's own UUID.
 * For internal ids we also check the cliSessionId stored in sessionManager.
 */
async function deleteGeminiCliSession(sessionId, cliSessionId) {
    const geminiTmpDir = path.join(os.homedir(), '.gemini', 'tmp');
    let projectDirs;
    try {
        projectDirs = await fs.readdir(geminiTmpDir);
    } catch {
        return;
    }

    const idsToMatch = new Set([sessionId]);
    if (cliSessionId) idsToMatch.add(cliSessionId);

    for (const projectDir of projectDirs) {
        const chatsDir = path.join(geminiTmpDir, projectDir, 'chats');
        let chatFiles;
        try {
            chatFiles = await fs.readdir(chatsDir);
        } catch {
            continue;
        }

        for (const chatFile of chatFiles) {
            if (!chatFile.endsWith('.json')) continue;
            try {
                const filePath = path.join(chatsDir, chatFile);
                const data = await fs.readFile(filePath, 'utf8');
                const session = JSON.parse(data);
                const fileSessionId = session.sessionId || chatFile.replace('.json', '');
                if (idsToMatch.has(fileSessionId)) {
                    await fs.unlink(filePath);
                    return;
                }
            } catch {
                continue;
            }
        }
    }
}

router.delete('/sessions/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;

        if (!sessionId || typeof sessionId !== 'string' || !/^[a-zA-Z0-9_.-]{1,100}$/.test(sessionId)) {
            return res.status(400).json({ success: false, error: 'Invalid session ID format' });
        }

        // Look up the CLI session ID before deleting from sessionManager
        const session = sessionManager.getSession(sessionId);
        const cliSessionId = session?.cliSessionId || null;

        await sessionManager.deleteSession(sessionId);
        sessionNamesDb.deleteName(sessionId, 'gemini');

        // Also remove the CLI session file from ~/.gemini/tmp/
        await deleteGeminiCliSession(sessionId, cliSessionId);

        res.json({ success: true });
    } catch (error) {
        console.error(`Error deleting Gemini session ${req.params.sessionId}:`, error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
