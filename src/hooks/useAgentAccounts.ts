import { useCallback, useEffect, useState } from 'react';
import { useWebSocket } from '../contexts/WebSocketContext';
import { authenticatedFetch } from '../utils/api';
import type { AgentProvider, ApiKeyStatus, AuthStatus, InstallStatus } from '../components/settings/types/types';

const AUTH_STATUS_ENDPOINTS: Record<AgentProvider, string> = {
  claude: '/api/cli/claude/status',
  cursor: '/api/cli/cursor/status',
  codex: '/api/cli/codex/status',
  gemini: '/api/cli/gemini/status',
};

const DEFAULT_AUTH_STATUS: AuthStatus = {
  authenticated: false,
  email: null,
  loading: true,
  error: null,
};

const DEFAULT_INSTALL_STATUS: InstallStatus = {
  installed: false,
  version: null,
  loading: true,
  installing: false,
  uninstalling: false,
  error: null,
  log: [],
};

const DEFAULT_API_KEY_STATUS: ApiKeyStatus = {
  available: false,
  source: null,
  masked: null,
  validationStatus: 'idle',
  validationError: null,
};

const PROVIDERS: AgentProvider[] = ['claude', 'gemini', 'codex', 'cursor'];

type StatusApiResponse = {
  authenticated?: boolean;
  email?: string | null;
  error?: string | null;
  method?: string;
};

const getErrorMessage = (error: unknown): string => (
  error instanceof Error ? error.message : 'Unknown error'
);

const toResponseJson = async <T>(response: Response): Promise<T> => response.json() as Promise<T>;

export type UseAgentAccountsReturn = {
  claudeAuthStatus: AuthStatus;
  cursorAuthStatus: AuthStatus;
  codexAuthStatus: AuthStatus;
  geminiAuthStatus: AuthStatus;
  claudeInstallStatus: InstallStatus;
  cursorInstallStatus: InstallStatus;
  codexInstallStatus: InstallStatus;
  geminiInstallStatus: InstallStatus;
  claudeApiKeyStatus: ApiKeyStatus;
  cursorApiKeyStatus: ApiKeyStatus;
  codexApiKeyStatus: ApiKeyStatus;
  geminiApiKeyStatus: ApiKeyStatus;
  installClient: (provider: AgentProvider) => Promise<void>;
  uninstallClient: (provider: AgentProvider) => Promise<void>;
  validateApiKey: (provider: AgentProvider, apiKey: string) => Promise<void>;
  resetApiKeyValidation: (provider: AgentProvider) => void;
  checkAuthStatus: (provider: AgentProvider) => Promise<void>;
  refreshAllStatuses: () => Promise<void>;
};

export default function useAgentAccounts(): UseAgentAccountsReturn {
  const { latestMessage } = useWebSocket();

  const [claudeAuthStatus, setClaudeAuthStatus] = useState<AuthStatus>(DEFAULT_AUTH_STATUS);
  const [cursorAuthStatus, setCursorAuthStatus] = useState<AuthStatus>(DEFAULT_AUTH_STATUS);
  const [codexAuthStatus, setCodexAuthStatus] = useState<AuthStatus>(DEFAULT_AUTH_STATUS);
  const [geminiAuthStatus, setGeminiAuthStatus] = useState<AuthStatus>(DEFAULT_AUTH_STATUS);

  const [claudeInstallStatus, setClaudeInstallStatus] = useState<InstallStatus>(DEFAULT_INSTALL_STATUS);
  const [cursorInstallStatus, setCursorInstallStatus] = useState<InstallStatus>(DEFAULT_INSTALL_STATUS);
  const [codexInstallStatus, setCodexInstallStatus] = useState<InstallStatus>(DEFAULT_INSTALL_STATUS);
  const [geminiInstallStatus, setGeminiInstallStatus] = useState<InstallStatus>(DEFAULT_INSTALL_STATUS);

  const [claudeApiKeyStatus, setClaudeApiKeyStatus] = useState<ApiKeyStatus>(DEFAULT_API_KEY_STATUS);
  const [cursorApiKeyStatus, setCursorApiKeyStatus] = useState<ApiKeyStatus>(DEFAULT_API_KEY_STATUS);
  const [codexApiKeyStatus, setCodexApiKeyStatus] = useState<ApiKeyStatus>(DEFAULT_API_KEY_STATUS);
  const [geminiApiKeyStatus, setGeminiApiKeyStatus] = useState<ApiKeyStatus>(DEFAULT_API_KEY_STATUS);

  const setAuthStatusByProvider = useCallback((provider: AgentProvider, status: AuthStatus) => {
    if (provider === 'claude') { setClaudeAuthStatus(status); return; }
    if (provider === 'cursor') { setCursorAuthStatus(status); return; }
    if (provider === 'gemini') { setGeminiAuthStatus(status); return; }
    setCodexAuthStatus(status);
  }, []);

  const setInstallStatusByProvider = useCallback((provider: AgentProvider, updater: (prev: InstallStatus) => InstallStatus) => {
    const setters: Record<AgentProvider, typeof setClaudeInstallStatus> = {
      claude: setClaudeInstallStatus,
      cursor: setCursorInstallStatus,
      codex: setCodexInstallStatus,
      gemini: setGeminiInstallStatus,
    };
    setters[provider](updater);
  }, []);

  const setApiKeyStatusByProvider = useCallback((provider: AgentProvider, updater: (prev: ApiKeyStatus) => ApiKeyStatus) => {
    const setters: Record<AgentProvider, typeof setClaudeApiKeyStatus> = {
      claude: setClaudeApiKeyStatus,
      cursor: setCursorApiKeyStatus,
      codex: setCodexApiKeyStatus,
      gemini: setGeminiApiKeyStatus,
    };
    setters[provider](updater);
  }, []);

  const fetchKeyStatus = useCallback(async () => {
    try {
      const response = await authenticatedFetch('/api/cli-installer/key-status');
      if (!response.ok) return;

      const data = await toResponseJson<{ success?: boolean; keys?: Record<string, { available?: boolean; source?: string; masked?: string }> }>(response);
      if (!data.success || !data.keys) return;

      for (const provider of PROVIDERS) {
        const keyInfo = data.keys[provider];
        if (keyInfo?.available) {
          setApiKeyStatusByProvider(provider, () => ({
            available: true,
            source: 'env',
            masked: keyInfo.masked || null,
            validationStatus: 'valid',
            validationError: null,
          }));
        }
      }
    } catch (error) {
      console.error('Error fetching key status:', error);
    }
  }, [setApiKeyStatusByProvider]);

  const checkAuthStatus = useCallback(async (provider: AgentProvider) => {
    try {
      const response = await authenticatedFetch(AUTH_STATUS_ENDPOINTS[provider]);

      if (!response.ok) {
        setAuthStatusByProvider(provider, {
          authenticated: false,
          email: null,
          loading: false,
          error: 'Failed to check authentication status',
        });
        return;
      }

      const data = await toResponseJson<StatusApiResponse>(response);
      setAuthStatusByProvider(provider, {
        authenticated: Boolean(data.authenticated),
        email: data.email || null,
        loading: false,
        error: data.error || null,
        method: data.method,
      });
    } catch (error) {
      console.error(`Error checking ${provider} auth status:`, error);
      setAuthStatusByProvider(provider, {
        authenticated: false,
        email: null,
        loading: false,
        error: getErrorMessage(error),
      });
    }
  }, [setAuthStatusByProvider]);

  const checkInstallStatus = useCallback(async () => {
    try {
      const response = await authenticatedFetch('/api/cli-installer/status');
      if (!response.ok) return;

      const data = await toResponseJson<{ success?: boolean; clients?: Record<string, { installed?: boolean; version?: string | null }> }>(response);
      if (!data.success || !data.clients) return;

      for (const provider of PROVIDERS) {
        const client = data.clients[provider];
        if (client) {
          setInstallStatusByProvider(provider, (prev) => ({
            ...prev,
            installed: Boolean(client.installed),
            version: client.version || null,
            loading: false,
          }));
        }
      }
    } catch (error) {
      console.error('Error checking install status:', error);
    }
  }, [setInstallStatusByProvider]);

  const installClient = useCallback(async (provider: AgentProvider) => {
    setInstallStatusByProvider(provider, (prev) => ({
      ...prev,
      installing: true,
      error: null,
      log: [],
    }));

    try {
      const response = await authenticatedFetch(`/api/cli-installer/${provider}/install`, {
        method: 'POST',
      });

      const data = await toResponseJson<{ success?: boolean; installed?: boolean; version?: string | null; message?: string; log?: string[] }>(response);

      setInstallStatusByProvider(provider, (prev) => ({
        ...prev,
        installed: Boolean(data.installed ?? data.success),
        version: data.version || null,
        installing: false,
        log: data.log || [],
        error: data.success ? null : (data.message || 'Installation failed'),
      }));

      if (data.success) {
        void checkAuthStatus(provider);
      }
    } catch (error) {
      setInstallStatusByProvider(provider, (prev) => ({
        ...prev,
        installing: false,
        error: getErrorMessage(error),
      }));
    }
  }, [checkAuthStatus, setInstallStatusByProvider]);

  const uninstallClient = useCallback(async (provider: AgentProvider) => {
    setInstallStatusByProvider(provider, (prev) => ({
      ...prev,
      uninstalling: true,
      error: null,
      log: [],
    }));

    try {
      const response = await authenticatedFetch(`/api/cli-installer/${provider}/uninstall`, {
        method: 'POST',
      });

      const data = await toResponseJson<{ success?: boolean; installed?: boolean; version?: string | null; message?: string; log?: string[] }>(response);

      setInstallStatusByProvider(provider, (prev) => ({
        ...prev,
        installed: Boolean(data.installed),
        version: data.version || null,
        uninstalling: false,
        log: data.log || [],
        error: data.success ? null : (data.message || 'Uninstall failed'),
      }));
    } catch (error) {
      setInstallStatusByProvider(provider, (prev) => ({
        ...prev,
        uninstalling: false,
        error: getErrorMessage(error),
      }));
    }
  }, [setInstallStatusByProvider]);

  const validateApiKey = useCallback(async (provider: AgentProvider, apiKey: string) => {
    setApiKeyStatusByProvider(provider, (prev) => ({
      ...prev,
      validationStatus: 'validating',
      validationError: null,
    }));

    try {
      const response = await authenticatedFetch(`/api/cli-installer/${provider}/validate-key`, {
        method: 'POST',
        body: JSON.stringify({ apiKey }),
      });

      const data = await toResponseJson<{ valid?: boolean; error?: string }>(response);

      if (data.valid) {
        await authenticatedFetch(`/api/cli-installer/${provider}/save-key`, {
          method: 'POST',
          body: JSON.stringify({ apiKey }),
        });
      }

      const masked = data.valid && apiKey.length >= 5
        ? '••••••••' + apiKey.slice(-4)
        : data.valid ? '••••••••' : null;

      setApiKeyStatusByProvider(provider, (prev) => ({
        ...prev,
        available: Boolean(data.valid),
        source: data.valid ? 'env' : prev.source,
        masked: masked ?? prev.masked,
        validationStatus: data.valid ? 'valid' : 'invalid',
        validationError: data.error || null,
      }));
    } catch (error) {
      setApiKeyStatusByProvider(provider, (prev) => ({
        ...prev,
        validationStatus: 'invalid',
        validationError: getErrorMessage(error),
      }));
    }
  }, [setApiKeyStatusByProvider]);

  const resetApiKeyValidation = useCallback((provider: AgentProvider) => {
    setApiKeyStatusByProvider(provider, (prev) => ({
      ...prev,
      validationStatus: 'idle',
      validationError: null,
    }));
  }, [setApiKeyStatusByProvider]);

  const refreshAllStatuses = useCallback(async () => {
    await Promise.all([
      ...PROVIDERS.map((p) => checkAuthStatus(p)),
      checkInstallStatus(),
      fetchKeyStatus(),
    ]);
  }, [checkAuthStatus, checkInstallStatus, fetchKeyStatus]);

  // Fetch all statuses on mount.
  useEffect(() => {
    void refreshAllStatuses();
  }, [refreshAllStatuses]);

  // Append real-time install/uninstall log lines received via WebSocket.
  useEffect(() => {
    if (!latestMessage || latestMessage.type !== 'install_log') return;
    const { provider, line } = latestMessage as { provider?: string; line?: string; type: string };
    if (!provider || !line) return;

    if (!PROVIDERS.includes(provider as AgentProvider)) return;

    setInstallStatusByProvider(provider as AgentProvider, (prev) => ({
      ...prev,
      log: [...prev.log, line],
    }));
  }, [latestMessage, setInstallStatusByProvider]);

  return {
    claudeAuthStatus,
    cursorAuthStatus,
    codexAuthStatus,
    geminiAuthStatus,
    claudeInstallStatus,
    cursorInstallStatus,
    codexInstallStatus,
    geminiInstallStatus,
    claudeApiKeyStatus,
    cursorApiKeyStatus,
    codexApiKeyStatus,
    geminiApiKeyStatus,
    installClient,
    uninstallClient,
    validateApiKey,
    resetApiKeyValidation,
    checkAuthStatus,
    refreshAllStatuses,
  };
}
