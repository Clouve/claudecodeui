import { useMemo, useState } from 'react';
import type { AgentCategory, AgentProvider } from '../../../types/types';
import AgentCategoryContentSection from './sections/AgentCategoryContentSection';
import AgentCategoryTabsSection from './sections/AgentCategoryTabsSection';
import AgentSelectorSection from './sections/AgentSelectorSection';
import type { AgentContext, AgentsSettingsTabProps } from './types';

export default function AgentsSettingsTab({
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
  onClaudeLogin,
  onCursorLogin,
  onCodexLogin,
  onGeminiLogin,
  onInstallClient,
  onUninstallClient,
  onValidateApiKey,
  onResetApiKeyValidation,
  claudePermissions,
  onClaudePermissionsChange,
  cursorPermissions,
  onCursorPermissionsChange,
  codexPermissionMode,
  onCodexPermissionModeChange,
  geminiPermissionMode,
  onGeminiPermissionModeChange,
  mcpServers,
  cursorMcpServers,
  codexMcpServers,
  mcpTestResults,
  mcpServerTools,
  mcpToolsLoading,
  deleteError,
  onOpenMcpForm,
  onDeleteMcpServer,
  onTestMcpServer,
  onDiscoverMcpTools,
  onOpenCodexMcpForm,
  onDeleteCodexMcpServer,
}: AgentsSettingsTabProps) {
  const [selectedAgent, setSelectedAgent] = useState<AgentProvider>('claude');
  const [selectedCategory, setSelectedCategory] = useState<AgentCategory>('account');

  const agentContextById = useMemo<Record<AgentProvider, AgentContext>>(() => ({
    claude: {
      authStatus: claudeAuthStatus,
      installStatus: claudeInstallStatus,
      apiKeyStatus: claudeApiKeyStatus,
      onLogin: onClaudeLogin,
      onInstall: () => onInstallClient('claude'),
      onUninstall: () => onUninstallClient('claude'),
      onValidateApiKey: (key: string) => onValidateApiKey('claude', key),
      onResetApiKeyValidation: () => onResetApiKeyValidation('claude'),
    },
    cursor: {
      authStatus: cursorAuthStatus,
      installStatus: cursorInstallStatus,
      apiKeyStatus: cursorApiKeyStatus,
      onLogin: onCursorLogin,
      onInstall: () => onInstallClient('cursor'),
      onUninstall: () => onUninstallClient('cursor'),
      onValidateApiKey: (key: string) => onValidateApiKey('cursor', key),
      onResetApiKeyValidation: () => onResetApiKeyValidation('cursor'),
    },
    codex: {
      authStatus: codexAuthStatus,
      installStatus: codexInstallStatus,
      apiKeyStatus: codexApiKeyStatus,
      onLogin: onCodexLogin,
      onInstall: () => onInstallClient('codex'),
      onUninstall: () => onUninstallClient('codex'),
      onValidateApiKey: (key: string) => onValidateApiKey('codex', key),
      onResetApiKeyValidation: () => onResetApiKeyValidation('codex'),
    },
    gemini: {
      authStatus: geminiAuthStatus,
      installStatus: geminiInstallStatus,
      apiKeyStatus: geminiApiKeyStatus,
      onLogin: onGeminiLogin,
      onInstall: () => onInstallClient('gemini'),
      onUninstall: () => onUninstallClient('gemini'),
      onValidateApiKey: (key: string) => onValidateApiKey('gemini', key),
      onResetApiKeyValidation: () => onResetApiKeyValidation('gemini'),
    },
  }), [
    claudeApiKeyStatus,
    claudeAuthStatus,
    claudeInstallStatus,
    codexApiKeyStatus,
    codexAuthStatus,
    codexInstallStatus,
    cursorApiKeyStatus,
    cursorAuthStatus,
    cursorInstallStatus,
    geminiApiKeyStatus,
    geminiAuthStatus,
    geminiInstallStatus,
    onClaudeLogin,
    onCodexLogin,
    onCursorLogin,
    onGeminiLogin,
    onInstallClient,
    onResetApiKeyValidation,
    onUninstallClient,
    onValidateApiKey,
  ]);

  return (
    <div className="-mx-4 -mb-4 -mt-2 flex min-h-[300px] flex-col overflow-hidden md:-mx-6 md:-mb-6 md:-mt-2 md:min-h-[500px]">
      <AgentSelectorSection
        selectedAgent={selectedAgent}
        onSelectAgent={setSelectedAgent}
        agentContextById={agentContextById}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <AgentCategoryTabsSection
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        />

        <AgentCategoryContentSection
          selectedAgent={selectedAgent}
          selectedCategory={selectedCategory}
          agentContextById={agentContextById}
          claudePermissions={claudePermissions}
          onClaudePermissionsChange={onClaudePermissionsChange}
          cursorPermissions={cursorPermissions}
          onCursorPermissionsChange={onCursorPermissionsChange}
          codexPermissionMode={codexPermissionMode}
          onCodexPermissionModeChange={onCodexPermissionModeChange}
          geminiPermissionMode={geminiPermissionMode}
          onGeminiPermissionModeChange={onGeminiPermissionModeChange}
          mcpServers={mcpServers}
          cursorMcpServers={cursorMcpServers}
          codexMcpServers={codexMcpServers}
          mcpTestResults={mcpTestResults}
          mcpServerTools={mcpServerTools}
          mcpToolsLoading={mcpToolsLoading}
          deleteError={deleteError}
          onOpenMcpForm={onOpenMcpForm}
          onDeleteMcpServer={onDeleteMcpServer}
          onTestMcpServer={onTestMcpServer}
          onDiscoverMcpTools={onDiscoverMcpTools}
          onOpenCodexMcpForm={onOpenCodexMcpForm}
          onDeleteCodexMcpServer={onDeleteCodexMcpServer}
        />
      </div>
    </div>
  );
}
