import type {
  AgentProvider,
  ApiKeyStatus,
  AuthStatus,
  InstallStatus,
  AgentCategory,
  ClaudePermissionsState,
  CursorPermissionsState,
  CodexPermissionMode,
  GeminiPermissionMode,
  McpServer,
  McpToolsResult,
  McpTestResult,
} from '../../../types/types';

export type AgentContext = {
  authStatus: AuthStatus;
  installStatus: InstallStatus;
  apiKeyStatus: ApiKeyStatus;
  onLogin: () => void;
  onInstall: () => void;
  onUninstall: () => void;
  onValidateApiKey: (key: string) => Promise<void>;
  onResetApiKeyValidation: () => void;
};

export type AgentContextByProvider = Record<AgentProvider, AgentContext>;

export type AgentsSettingsTabProps = {
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
  onClaudeLogin: () => void;
  onCursorLogin: () => void;
  onCodexLogin: () => void;
  onGeminiLogin: () => void;
  onInstallClient: (provider: AgentProvider) => void;
  onUninstallClient: (provider: AgentProvider) => void;
  onValidateApiKey: (provider: AgentProvider, key: string) => Promise<void>;
  onResetApiKeyValidation: (provider: AgentProvider) => void;
  claudePermissions: ClaudePermissionsState;
  onClaudePermissionsChange: (value: ClaudePermissionsState) => void;
  cursorPermissions: CursorPermissionsState;
  onCursorPermissionsChange: (value: CursorPermissionsState) => void;
  codexPermissionMode: CodexPermissionMode;
  onCodexPermissionModeChange: (value: CodexPermissionMode) => void;
  geminiPermissionMode: GeminiPermissionMode;
  onGeminiPermissionModeChange: (value: GeminiPermissionMode) => void;
  mcpServers: McpServer[];
  cursorMcpServers: McpServer[];
  codexMcpServers: McpServer[];
  mcpTestResults: Record<string, McpTestResult>;
  mcpServerTools: Record<string, McpToolsResult>;
  mcpToolsLoading: Record<string, boolean>;
  deleteError: string | null;
  onOpenMcpForm: (server?: McpServer) => void;
  onDeleteMcpServer: (serverId: string, scope?: string) => void;
  onTestMcpServer: (serverId: string, scope?: string) => void;
  onDiscoverMcpTools: (serverId: string, scope?: string) => void;
  onOpenCodexMcpForm: (server?: McpServer) => void;
  onDeleteCodexMcpServer: (serverId: string) => void;
};

export type AgentCategoryTabsSectionProps = {
  selectedCategory: AgentCategory;
  onSelectCategory: (category: AgentCategory) => void;
};

export type AgentSelectorSectionProps = {
  selectedAgent: AgentProvider;
  onSelectAgent: (agent: AgentProvider) => void;
  agentContextById: AgentContextByProvider;
};

export type AgentCategoryContentSectionProps = {
  selectedAgent: AgentProvider;
  selectedCategory: AgentCategory;
  agentContextById: AgentContextByProvider;
  claudePermissions: ClaudePermissionsState;
  onClaudePermissionsChange: (value: ClaudePermissionsState) => void;
  cursorPermissions: CursorPermissionsState;
  onCursorPermissionsChange: (value: CursorPermissionsState) => void;
  codexPermissionMode: CodexPermissionMode;
  onCodexPermissionModeChange: (value: CodexPermissionMode) => void;
  geminiPermissionMode: GeminiPermissionMode;
  onGeminiPermissionModeChange: (value: GeminiPermissionMode) => void;
  mcpServers: McpServer[];
  cursorMcpServers: McpServer[];
  codexMcpServers: McpServer[];
  mcpTestResults: Record<string, McpTestResult>;
  mcpServerTools: Record<string, McpToolsResult>;
  mcpToolsLoading: Record<string, boolean>;
  deleteError: string | null;
  onOpenMcpForm: (server?: McpServer) => void;
  onDeleteMcpServer: (serverId: string, scope?: string) => void;
  onTestMcpServer: (serverId: string, scope?: string) => void;
  onDiscoverMcpTools: (serverId: string, scope?: string) => void;
  onOpenCodexMcpForm: (server?: McpServer) => void;
  onDeleteCodexMcpServer: (serverId: string) => void;
};
