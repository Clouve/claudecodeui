import { useCallback, useEffect, useState } from 'react';
import { useWebSocket } from '../../../contexts/WebSocketContext';
import { authenticatedFetch } from '../../../utils/api';

export type TaskmasterInitStatus = 'idle' | 'initializing' | 'success' | 'error';

type UseTaskmasterInitOptions = {
  projectName: string | undefined;
  onSuccess?: () => Promise<void> | void;
};

export function useTaskmasterInit({ projectName, onSuccess }: UseTaskmasterInitOptions) {
  const { latestMessage } = useWebSocket();
  const [status, setStatus] = useState<TaskmasterInitStatus>('idle');
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showLog, setShowLog] = useState(false);

  // Append real-time log lines from WebSocket
  useEffect(() => {
    if (!latestMessage) return;
    if (latestMessage.type !== 'taskmaster_init_log') return;
    if (latestMessage.projectName !== projectName) return;
    if (!latestMessage.line) return;

    setLog((prev) => [...prev, latestMessage.line as string]);
  }, [latestMessage, projectName]);

  const resetState = useCallback(() => {
    setStatus('idle');
    setLog([]);
    setError(null);
    setShowLog(false);
  }, []);

  const runInit = useCallback(async () => {
    if (!projectName) return;

    setStatus('initializing');
    setError(null);
    setLog([]);
    setShowLog(true);

    try {
      const response = await authenticatedFetch(
        `/api/taskmaster/init/${encodeURIComponent(projectName)}`,
        { method: 'POST' },
      );

      const data = (await response.json()) as {
        success?: boolean;
        message?: string;
        log?: string[];
      };

      // Merge any log lines from the response that weren't received via WebSocket
      if (data.log && data.log.length > 0) {
        setLog((prev) => {
          const combined = [...prev];
          for (const line of data.log!) {
            if (!combined.includes(line)) {
              combined.push(line);
            }
          }
          return combined;
        });
      }

      if (data.success) {
        setStatus('success');
        await onSuccess?.();
      } else {
        setStatus('error');
        setError(data.message || 'Initialization failed');
      }
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Initialization failed');
    }
  }, [projectName, onSuccess]);

  return { status, log, error, showLog, setShowLog, runInit, resetState };
}
