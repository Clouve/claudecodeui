import { useCallback, useEffect, useRef, useState } from 'react';
import { useTheme } from '../../../contexts/ThemeContext';
import { useWebSocket } from '../../../contexts/WebSocketContext';
import { authenticatedFetch } from '../../../utils/api';
import {
  AUTH_STATUS_ENDPOINTS,
  DEFAULT_API_KEY_STATUS,
  DEFAULT_AUTH_STATUS,
  DEFAULT_CODE_EDITOR_SETTINGS,
  DEFAULT_CURSOR_PERMISSIONS,
  DEFAULT_INSTALL_STATUS,
} from '../constants/constants';
import type {
  AgentProvider,
  ApiKeyStatus,
  AuthStatus,
  InstallStatus,
  ClaudeMcpFormState,
  ClaudePermissionsState,
  CodeEditorSettingsState,
  CodexMcpFormState,
  CodexPermissionMode,
  CursorPermissionsState,
  GeminiPermissionMode,
  McpServer,
  McpToolsResult,
  McpTestResult,
  NotificationPreferencesState,
  ProjectSortOrder,
  SettingsMainTab,
  SettingsProject,
} from '../types/types';

type ThemeContextValue = {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
};

type UseSettingsControllerArgs = {
  isOpen: boolean;
  initialTab: string;
  projects: SettingsProject[];
  onClose: () => void;
};

type StatusApiResponse = {
  authenticated?: boolean;
  email?: string | null;
  error?: string | null;
  method?: string;
};

type JsonResult = {
  success?: boolean;
  error?: string;
};

type McpReadResponse = {
  success?: boolean;
  servers?: McpServer[];
};

type McpCliServer = {
  name: string;
  type?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
};

type McpCliReadResponse = {
  success?: boolean;
  servers?: McpCliServer[];
};

type McpTestResponse = {
  testResult?: McpTestResult;
  error?: string;
};

type McpToolsResponse = {
  toolsResult?: McpToolsResult;
  error?: string;
};

type ClaudeSettingsStorage = {
  allowedTools?: string[];
  disallowedTools?: string[];
  skipPermissions?: boolean;
  projectSortOrder?: ProjectSortOrder;
};

type CursorSettingsStorage = {
  allowedCommands?: string[];
  disallowedCommands?: string[];
  skipPermissions?: boolean;
};

type CodexSettingsStorage = {
  permissionMode?: CodexPermissionMode;
};

type NotificationPreferencesResponse = {
  success?: boolean;
  preferences?: NotificationPreferencesState;
};

type ActiveLoginProvider = AgentProvider | '';

const KNOWN_MAIN_TABS: SettingsMainTab[] = ['agents', 'appearance', 'git', 'api', 'tasks', 'notifications', 'plugins'];

const normalizeMainTab = (tab: string): SettingsMainTab => {
  // Keep backwards compatibility with older callers that still pass "tools".
  if (tab === 'tools') {
    return 'agents';
  }

  return KNOWN_MAIN_TABS.includes(tab as SettingsMainTab) ? (tab as SettingsMainTab) : 'agents';
};

const getErrorMessage = (error: unknown): string => (
  error instanceof Error ? error.message : 'Unknown error'
);

const parseJson = <T>(value: string | null, fallback: T): T => {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const toCodexPermissionMode = (value: unknown): CodexPermissionMode => {
  if (value === 'acceptEdits' || value === 'bypassPermissions') {
    return value;
  }

  return 'default';
};

const readCodeEditorSettings = (): CodeEditorSettingsState => ({
  theme: localStorage.getItem('codeEditorTheme') === 'light' ? 'light' : 'dark',
  wordWrap: localStorage.getItem('codeEditorWordWrap') === 'true',
  showMinimap: localStorage.getItem('codeEditorShowMinimap') !== 'false',
  lineNumbers: localStorage.getItem('codeEditorLineNumbers') !== 'false',
  fontSize: localStorage.getItem('codeEditorFontSize') ?? DEFAULT_CODE_EDITOR_SETTINGS.fontSize,
});

const mapCliServersToMcpServers = (servers: McpCliServer[] = []): McpServer[] => (
  servers.map((server) => ({
    id: server.name,
    name: server.name,
    type: server.type || 'stdio',
    scope: 'user',
    config: {
      command: server.command || '',
      args: server.args || [],
      env: server.env || {},
      url: server.url || '',
      headers: server.headers || {},
      timeout: 30000,
    },
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
  }))
);

const getDefaultProject = (projects: SettingsProject[]): SettingsProject => {
  if (projects.length > 0) {
    return projects[0];
  }

  const cwd = typeof process !== 'undefined' && process.cwd ? process.cwd() : '';
  return {
    name: 'default',
    displayName: 'default',
    fullPath: cwd,
    path: cwd,
  };
};

const toResponseJson = async <T>(response: Response): Promise<T> => response.json() as Promise<T>;

const createEmptyClaudePermissions = (): ClaudePermissionsState => ({
  allowedTools: [],
  disallowedTools: [],
  skipPermissions: false,
});

const createEmptyCursorPermissions = (): CursorPermissionsState => ({
  ...DEFAULT_CURSOR_PERMISSIONS,
});

const createDefaultNotificationPreferences = (): NotificationPreferencesState => ({
  channels: {
    inApp: true,
    webPush: false,
  },
  events: {
    actionRequired: true,
    stop: true,
    error: true,
  },
});

export function useSettingsController({ isOpen, initialTab, projects, onClose }: UseSettingsControllerArgs) {
  const { isDarkMode, toggleDarkMode } = useTheme() as ThemeContextValue;
  const { latestMessage } = useWebSocket();
  const closeTimerRef = useRef<number | null>(null);

  const [activeTab, setActiveTab] = useState<SettingsMainTab>(() => normalizeMainTab(initialTab));
  const [saveStatus, setSaveStatus] = useState<'success' | 'error' | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [projectSortOrder, setProjectSortOrder] = useState<ProjectSortOrder>('name');
  const [codeEditorSettings, setCodeEditorSettings] = useState<CodeEditorSettingsState>(() => (
    readCodeEditorSettings()
  ));

  const [claudePermissions, setClaudePermissions] = useState<ClaudePermissionsState>(() => (
    createEmptyClaudePermissions()
  ));
  const [cursorPermissions, setCursorPermissions] = useState<CursorPermissionsState>(() => (
    createEmptyCursorPermissions()
  ));
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferencesState>(() => (
    createDefaultNotificationPreferences()
  ));
  const [codexPermissionMode, setCodexPermissionMode] = useState<CodexPermissionMode>('default');
  const [geminiPermissionMode, setGeminiPermissionMode] = useState<GeminiPermissionMode>('default');

  const [mcpServers, setMcpServers] = useState<McpServer[]>([]);
  const [cursorMcpServers, setCursorMcpServers] = useState<McpServer[]>([]);
  const [codexMcpServers, setCodexMcpServers] = useState<McpServer[]>([]);
  const [mcpTestResults, setMcpTestResults] = useState<Record<string, McpTestResult>>({});
  const [mcpServerTools, setMcpServerTools] = useState<Record<string, McpToolsResult>>({});
  const [mcpToolsLoading, setMcpToolsLoading] = useState<Record<string, boolean>>({});

  const [showMcpForm, setShowMcpForm] = useState(false);
  const [editingMcpServer, setEditingMcpServer] = useState<McpServer | null>(null);
  const [showCodexMcpForm, setShowCodexMcpForm] = useState(false);
  const [editingCodexMcpServer, setEditingCodexMcpServer] = useState<McpServer | null>(null);

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginProvider, setLoginProvider] = useState<ActiveLoginProvider>('');
  const [selectedProject, setSelectedProject] = useState<SettingsProject | null>(null);

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
    if (provider === 'claude') {
      setClaudeAuthStatus(status);
      return;
    }

    if (provider === 'cursor') {
      setCursorAuthStatus(status);
      return;
    }

    if (provider === 'gemini') {
      setGeminiAuthStatus(status);
      return;
    }

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

      for (const provider of ['claude', 'gemini', 'codex', 'cursor'] as AgentProvider[]) {
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
        // Persist the validated key as an environment variable so the CLI
        // can authenticate at runtime once installed.
        await authenticatedFetch(`/api/cli-installer/${provider}/save-key`, {
          method: 'POST',
          body: JSON.stringify({ apiKey }),
        });
      }

      setApiKeyStatusByProvider(provider, (prev) => ({
        ...prev,
        available: Boolean(data.valid),
        source: data.valid ? 'input' : prev.source,
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
    setApiKeyStatusByProvider(provider, (prev) => {
      // Don't reset env-var keys — they are always pre-validated
      if (prev.source === 'env') return prev;
      return {
        ...prev,
        available: false,
        validationStatus: 'idle',
        validationError: null,
      };
    });
  }, [setApiKeyStatusByProvider]);

  const checkInstallStatus = useCallback(async () => {
    try {
      const response = await authenticatedFetch('/api/cli-installer/status');
      if (!response.ok) return;

      const data = await toResponseJson<{ success?: boolean; clients?: Record<string, { installed?: boolean; version?: string | null }> }>(response);
      if (!data.success || !data.clients) return;

      for (const provider of ['claude', 'gemini', 'codex', 'cursor'] as AgentProvider[]) {
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

  const fetchCursorMcpServers = useCallback(async () => {
    try {
      const response = await authenticatedFetch('/api/cursor/mcp');
      if (!response.ok) {
        console.error('Failed to fetch Cursor MCP servers');
        return;
      }

      const data = await toResponseJson<{ servers?: McpServer[] }>(response);
      setCursorMcpServers(data.servers || []);
    } catch (error) {
      console.error('Error fetching Cursor MCP servers:', error);
    }
  }, []);

  const fetchCodexMcpServers = useCallback(async () => {
    try {
      const configResponse = await authenticatedFetch('/api/codex/mcp/config/read');

      if (configResponse.ok) {
        const configData = await toResponseJson<McpReadResponse>(configResponse);
        if (configData.success && configData.servers) {
          setCodexMcpServers(configData.servers);
          return;
        }
      }

      const cliResponse = await authenticatedFetch('/api/codex/mcp/cli/list');
      if (!cliResponse.ok) {
        return;
      }

      const cliData = await toResponseJson<McpCliReadResponse>(cliResponse);
      if (!cliData.success || !cliData.servers) {
        return;
      }

      setCodexMcpServers(mapCliServersToMcpServers(cliData.servers));
    } catch (error) {
      console.error('Error fetching Codex MCP servers:', error);
    }
  }, []);

  const fetchMcpServers = useCallback(async () => {
    try {
      const configResponse = await authenticatedFetch('/api/mcp/config/read');
      if (configResponse.ok) {
        const configData = await toResponseJson<McpReadResponse>(configResponse);
        if (configData.success && configData.servers) {
          setMcpServers(configData.servers);
          return;
        }
      }

      const cliResponse = await authenticatedFetch('/api/mcp/cli/list');
      if (cliResponse.ok) {
        const cliData = await toResponseJson<McpCliReadResponse>(cliResponse);
        if (cliData.success && cliData.servers) {
          setMcpServers(mapCliServersToMcpServers(cliData.servers));
          return;
        }
      }

      const fallbackResponse = await authenticatedFetch('/api/mcp/servers?scope=user');
      if (!fallbackResponse.ok) {
        console.error('Failed to fetch MCP servers');
        return;
      }

      const fallbackData = await toResponseJson<{ servers?: McpServer[] }>(fallbackResponse);
      setMcpServers(fallbackData.servers || []);
    } catch (error) {
      console.error('Error fetching MCP servers:', error);
    }
  }, []);

  const deleteMcpServer = useCallback(async (serverId: string, scope = 'user') => {
    const response = await authenticatedFetch(`/api/mcp/cli/remove/${serverId}?scope=${scope}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await toResponseJson<JsonResult>(response);
      throw new Error(error.error || 'Failed to delete server');
    }

    const result = await toResponseJson<JsonResult>(response);
    if (!result.success) {
      throw new Error(result.error || 'Failed to delete server via Claude CLI');
    }
  }, []);

  const saveMcpServer = useCallback(
    async (serverData: ClaudeMcpFormState, editingServer: McpServer | null) => {
      const newServerScope = serverData.scope || 'user';

      const response = await authenticatedFetch('/api/mcp/cli/add', {
        method: 'POST',
        body: JSON.stringify({
          name: serverData.name,
          type: serverData.type,
          scope: newServerScope,
          projectPath: serverData.projectPath,
          command: serverData.config.command,
          args: serverData.config.args || [],
          url: serverData.config.url,
          headers: serverData.config.headers || {},
          env: serverData.config.env || {},
        }),
      });

      if (!response.ok) {
        const error = await toResponseJson<JsonResult>(response);
        throw new Error(error.error || 'Failed to save server');
      }

      const result = await toResponseJson<JsonResult>(response);
      if (!result.success) {
        throw new Error(result.error || 'Failed to save server via Claude CLI');
      }

      if (!editingServer?.id) {
        return;
      }

      const previousServerScope = editingServer.scope || 'user';
      const didServerIdentityChange =
        editingServer.id !== serverData.name || previousServerScope !== newServerScope;

      if (!didServerIdentityChange) {
        return;
      }

      try {
        await deleteMcpServer(editingServer.id, previousServerScope);
      } catch (error) {
        console.warn('Saved MCP server update but failed to remove the previous server entry.', {
          previousServerId: editingServer.id,
          previousServerScope,
          error: getErrorMessage(error),
        });
      }
    },
    [deleteMcpServer],
  );

  const submitMcpForm = useCallback(
    async (formData: ClaudeMcpFormState, editingServer: McpServer | null) => {
      if (formData.importMode === 'json') {
        const response = await authenticatedFetch('/api/mcp/cli/add-json', {
          method: 'POST',
          body: JSON.stringify({
            name: formData.name,
            jsonConfig: formData.jsonInput,
            scope: formData.scope,
            projectPath: formData.projectPath,
          }),
        });

        if (!response.ok) {
          const error = await toResponseJson<JsonResult>(response);
          throw new Error(error.error || 'Failed to add server');
        }

        const result = await toResponseJson<JsonResult>(response);
        if (!result.success) {
          throw new Error(result.error || 'Failed to add server via JSON');
        }
      } else {
        await saveMcpServer(formData, editingServer);
      }

      await fetchMcpServers();
      setSaveStatus('success');
      setShowMcpForm(false);
      setEditingMcpServer(null);
    },
    [fetchMcpServers, saveMcpServer],
  );

  const handleMcpDelete = useCallback(
    async (serverId: string, scope = 'user') => {
      if (!window.confirm('Are you sure you want to delete this MCP server?')) {
        return;
      }

      setDeleteError(null);
      try {
        await deleteMcpServer(serverId, scope);
        await fetchMcpServers();
        setDeleteError(null);
        setSaveStatus('success');
      } catch (error) {
        setDeleteError(getErrorMessage(error));
        setSaveStatus('error');
      }
    },
    [deleteMcpServer, fetchMcpServers],
  );

  const testMcpServer = useCallback(async (serverId: string, scope = 'user') => {
    const response = await authenticatedFetch(`/api/mcp/servers/${serverId}/test?scope=${scope}`, {
      method: 'POST',
    });

    if (!response.ok) {
      const error = await toResponseJson<McpTestResponse>(response);
      throw new Error(error.error || 'Failed to test server');
    }

    const data = await toResponseJson<McpTestResponse>(response);
    return data.testResult || { success: false, message: 'No test result returned' };
  }, []);

  const discoverMcpTools = useCallback(async (serverId: string, scope = 'user') => {
    const response = await authenticatedFetch(`/api/mcp/servers/${serverId}/tools?scope=${scope}`, {
      method: 'POST',
    });

    if (!response.ok) {
      const error = await toResponseJson<McpToolsResponse>(response);
      throw new Error(error.error || 'Failed to discover tools');
    }

    const data = await toResponseJson<McpToolsResponse>(response);
    return data.toolsResult || { success: false, tools: [], resources: [], prompts: [] };
  }, []);

  const handleMcpTest = useCallback(
    async (serverId: string, scope = 'user') => {
      try {
        setMcpTestResults((prev) => ({
          ...prev,
          [serverId]: { success: false, message: 'Testing server...', details: [], loading: true },
        }));

        const result = await testMcpServer(serverId, scope);
        setMcpTestResults((prev) => ({ ...prev, [serverId]: result }));
      } catch (error) {
        setMcpTestResults((prev) => ({
          ...prev,
          [serverId]: {
            success: false,
            message: getErrorMessage(error),
            details: [],
          },
        }));
      }
    },
    [testMcpServer],
  );

  const handleMcpToolsDiscovery = useCallback(
    async (serverId: string, scope = 'user') => {
      try {
        setMcpToolsLoading((prev) => ({ ...prev, [serverId]: true }));
        const result = await discoverMcpTools(serverId, scope);
        setMcpServerTools((prev) => ({ ...prev, [serverId]: result }));
      } catch {
        setMcpServerTools((prev) => ({
          ...prev,
          [serverId]: { success: false, tools: [], resources: [], prompts: [] },
        }));
      } finally {
        setMcpToolsLoading((prev) => ({ ...prev, [serverId]: false }));
      }
    },
    [discoverMcpTools],
  );

  const deleteCodexMcpServer = useCallback(async (serverId: string) => {
    const response = await authenticatedFetch(`/api/codex/mcp/cli/remove/${serverId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await toResponseJson<JsonResult>(response);
      throw new Error(error.error || 'Failed to delete server');
    }

    const result = await toResponseJson<JsonResult>(response);
    if (!result.success) {
      throw new Error(result.error || 'Failed to delete Codex MCP server');
    }
  }, []);

  const saveCodexMcpServer = useCallback(
    async (serverData: CodexMcpFormState, editingServer: McpServer | null) => {
      const response = await authenticatedFetch('/api/codex/mcp/cli/add', {
        method: 'POST',
        body: JSON.stringify({
          name: serverData.name,
          command: serverData.config.command,
          args: serverData.config.args || [],
          env: serverData.config.env || {},
        }),
      });

      if (!response.ok) {
        const error = await toResponseJson<JsonResult>(response);
        throw new Error(error.error || 'Failed to save server');
      }

      const result = await toResponseJson<JsonResult>(response);
      if (!result.success) {
        throw new Error(result.error || 'Failed to save Codex MCP server');
      }

      if (!editingServer?.name || editingServer.name === serverData.name) {
        return;
      }

      try {
        await deleteCodexMcpServer(editingServer.name);
      } catch (error) {
        console.warn('Saved Codex MCP server update but failed to remove the previous server entry.', {
          previousServerName: editingServer.name,
          error: getErrorMessage(error),
        });
      }
    },
    [deleteCodexMcpServer],
  );

  const submitCodexMcpForm = useCallback(
    async (formData: CodexMcpFormState, editingServer: McpServer | null) => {
      await saveCodexMcpServer(formData, editingServer);
      await fetchCodexMcpServers();
      setSaveStatus('success');
      setShowCodexMcpForm(false);
      setEditingCodexMcpServer(null);
    },
    [fetchCodexMcpServers, saveCodexMcpServer],
  );

  const handleCodexMcpDelete = useCallback(
    async (serverName: string) => {
      if (!window.confirm('Are you sure you want to delete this MCP server?')) {
        return;
      }

      setDeleteError(null);
      try {
        await deleteCodexMcpServer(serverName);
        await fetchCodexMcpServers();
        setDeleteError(null);
        setSaveStatus('success');
      } catch (error) {
        setDeleteError(getErrorMessage(error));
        setSaveStatus('error');
      }
    },
    [deleteCodexMcpServer, fetchCodexMcpServers],
  );

  const loadSettings = useCallback(async () => {
    try {
      const savedClaudeSettings = parseJson<ClaudeSettingsStorage>(
        localStorage.getItem('claude-settings'),
        {},
      );
      setClaudePermissions({
        allowedTools: savedClaudeSettings.allowedTools || [],
        disallowedTools: savedClaudeSettings.disallowedTools || [],
        skipPermissions: Boolean(savedClaudeSettings.skipPermissions),
      });
      setProjectSortOrder(savedClaudeSettings.projectSortOrder === 'date' ? 'date' : 'name');

      const savedCursorSettings = parseJson<CursorSettingsStorage>(
        localStorage.getItem('cursor-tools-settings'),
        {},
      );
      setCursorPermissions({
        allowedCommands: savedCursorSettings.allowedCommands || [],
        disallowedCommands: savedCursorSettings.disallowedCommands || [],
        skipPermissions: Boolean(savedCursorSettings.skipPermissions),
      });

      const savedCodexSettings = parseJson<CodexSettingsStorage>(
        localStorage.getItem('codex-settings'),
        {},
      );
      setCodexPermissionMode(toCodexPermissionMode(savedCodexSettings.permissionMode));

      const savedGeminiSettings = parseJson<{ permissionMode?: GeminiPermissionMode }>(
        localStorage.getItem('gemini-settings'),
        {},
      );
      setGeminiPermissionMode(savedGeminiSettings.permissionMode || 'default');

      try {
        const notificationResponse = await authenticatedFetch('/api/settings/notification-preferences');
        if (notificationResponse.ok) {
          const notificationData = await toResponseJson<NotificationPreferencesResponse>(notificationResponse);
          if (notificationData.success && notificationData.preferences) {
            setNotificationPreferences(notificationData.preferences);
          } else {
            setNotificationPreferences(createDefaultNotificationPreferences());
          }
        } else {
          setNotificationPreferences(createDefaultNotificationPreferences());
        }
      } catch {
        setNotificationPreferences(createDefaultNotificationPreferences());
      }

      await Promise.all([
        fetchMcpServers(),
        fetchCursorMcpServers(),
        fetchCodexMcpServers(),
      ]);
    } catch (error) {
      console.error('Error loading settings:', error);
      setClaudePermissions(createEmptyClaudePermissions());
      setCursorPermissions(createEmptyCursorPermissions());
      setNotificationPreferences(createDefaultNotificationPreferences());
      setCodexPermissionMode('default');
      setProjectSortOrder('name');
    }
  }, [fetchCodexMcpServers, fetchCursorMcpServers, fetchMcpServers]);

  const openLoginForProvider = useCallback((provider: AgentProvider) => {
    setLoginProvider(provider);
    setSelectedProject(getDefaultProject(projects));
    setShowLoginModal(true);
  }, [projects]);

  const handleLoginComplete = useCallback((exitCode: number) => {
    if (exitCode !== 0 || !loginProvider) {
      return;
    }

    setSaveStatus('success');
    void checkAuthStatus(loginProvider);
  }, [checkAuthStatus, loginProvider]);

  const saveSettings = useCallback(async () => {
    setSaveStatus(null);

    try {
      const now = new Date().toISOString();
      localStorage.setItem('claude-settings', JSON.stringify({
        allowedTools: claudePermissions.allowedTools,
        disallowedTools: claudePermissions.disallowedTools,
        skipPermissions: claudePermissions.skipPermissions,
        projectSortOrder,
        lastUpdated: now,
      }));

      localStorage.setItem('cursor-tools-settings', JSON.stringify({
        allowedCommands: cursorPermissions.allowedCommands,
        disallowedCommands: cursorPermissions.disallowedCommands,
        skipPermissions: cursorPermissions.skipPermissions,
        lastUpdated: now,
      }));

      localStorage.setItem('codex-settings', JSON.stringify({
        permissionMode: codexPermissionMode,
        lastUpdated: now,
      }));

      localStorage.setItem('gemini-settings', JSON.stringify({
        permissionMode: geminiPermissionMode,
        lastUpdated: now,
      }));

      const notificationResponse = await authenticatedFetch('/api/settings/notification-preferences', {
        method: 'PUT',
        body: JSON.stringify(notificationPreferences),
      });
      if (!notificationResponse.ok) {
        throw new Error('Failed to save notification preferences');
      }

      setSaveStatus('success');
    } catch (error) {
      console.error('Error saving settings:', error);
      setSaveStatus('error');
    }
  }, [
    claudePermissions.allowedTools,
    claudePermissions.disallowedTools,
    claudePermissions.skipPermissions,
    codexPermissionMode,
    cursorPermissions.allowedCommands,
    cursorPermissions.disallowedCommands,
    cursorPermissions.skipPermissions,
    notificationPreferences,
    geminiPermissionMode,
    projectSortOrder,
  ]);

  const updateCodeEditorSetting = useCallback(
    <K extends keyof CodeEditorSettingsState>(key: K, value: CodeEditorSettingsState[K]) => {
      setCodeEditorSettings((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const openMcpForm = useCallback((server?: McpServer) => {
    setEditingMcpServer(server || null);
    setShowMcpForm(true);
  }, []);

  const closeMcpForm = useCallback(() => {
    setShowMcpForm(false);
    setEditingMcpServer(null);
  }, []);

  const openCodexMcpForm = useCallback((server?: McpServer) => {
    setEditingCodexMcpServer(server || null);
    setShowCodexMcpForm(true);
  }, []);

  const closeCodexMcpForm = useCallback(() => {
    setShowCodexMcpForm(false);
    setEditingCodexMcpServer(null);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setActiveTab(normalizeMainTab(initialTab));
    void loadSettings();
    void checkAuthStatus('claude');
    void checkAuthStatus('cursor');
    void checkAuthStatus('codex');
    void checkAuthStatus('gemini');
    void checkInstallStatus();
    void fetchKeyStatus();
  }, [checkAuthStatus, checkInstallStatus, fetchKeyStatus, initialTab, isOpen, loadSettings]);

  useEffect(() => {
    localStorage.setItem('codeEditorTheme', codeEditorSettings.theme);
    localStorage.setItem('codeEditorWordWrap', String(codeEditorSettings.wordWrap));
    localStorage.setItem('codeEditorShowMinimap', String(codeEditorSettings.showMinimap));
    localStorage.setItem('codeEditorLineNumbers', String(codeEditorSettings.lineNumbers));
    localStorage.setItem('codeEditorFontSize', codeEditorSettings.fontSize);
    window.dispatchEvent(new Event('codeEditorSettingsChanged'));
  }, [codeEditorSettings]);

  // Auto-save permissions and sort order with debounce
  const autoSaveTimerRef = useRef<number | null>(null);
  const isInitialLoadRef = useRef(true);

  useEffect(() => {
    // Skip auto-save on initial load (settings are being loaded from localStorage)
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      return;
    }

    if (autoSaveTimerRef.current !== null) {
      window.clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = window.setTimeout(() => {
      saveSettings();
    }, 500);

    return () => {
      if (autoSaveTimerRef.current !== null) {
        window.clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [saveSettings]);

  // Clear save status after 2 seconds
  useEffect(() => {
    if (saveStatus === null) {
      return;
    }

    const timer = window.setTimeout(() => setSaveStatus(null), 2000);
    return () => window.clearTimeout(timer);
  }, [saveStatus]);

  // Append real-time install/uninstall log lines received via WebSocket.
  useEffect(() => {
    if (!latestMessage || latestMessage.type !== 'install_log') return;
    const { provider, line } = latestMessage as { provider?: string; line?: string; type: string };
    if (!provider || !line) return;

    const validProviders: AgentProvider[] = ['claude', 'gemini', 'codex', 'cursor'];
    if (!validProviders.includes(provider as AgentProvider)) return;

    setInstallStatusByProvider(provider as AgentProvider, (prev) => ({
      ...prev,
      log: [...prev.log, line],
    }));
  }, [latestMessage, setInstallStatusByProvider]);

  // Reset initial load flag when settings dialog opens
  useEffect(() => {
    if (isOpen) {
      isInitialLoadRef.current = true;
    }
  }, [isOpen]);

  useEffect(() => () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    if (autoSaveTimerRef.current !== null) {
      window.clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
  }, []);

  return {
    activeTab,
    setActiveTab,
    isDarkMode,
    toggleDarkMode,
    saveStatus,
    deleteError,
    projectSortOrder,
    setProjectSortOrder,
    codeEditorSettings,
    updateCodeEditorSetting,
    claudePermissions,
    setClaudePermissions,
    cursorPermissions,
    setCursorPermissions,
    notificationPreferences,
    setNotificationPreferences,
    codexPermissionMode,
    setCodexPermissionMode,
    mcpServers,
    cursorMcpServers,
    codexMcpServers,
    mcpTestResults,
    mcpServerTools,
    mcpToolsLoading,
    showMcpForm,
    editingMcpServer,
    openMcpForm,
    closeMcpForm,
    submitMcpForm,
    handleMcpDelete,
    handleMcpTest,
    handleMcpToolsDiscovery,
    showCodexMcpForm,
    editingCodexMcpServer,
    openCodexMcpForm,
    closeCodexMcpForm,
    submitCodexMcpForm,
    handleCodexMcpDelete,
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
    geminiPermissionMode,
    setGeminiPermissionMode,
    openLoginForProvider,
    showLoginModal,
    setShowLoginModal,
    loginProvider,
    selectedProject,
    handleLoginComplete,
  };
}
