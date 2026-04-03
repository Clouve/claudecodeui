import { useState } from 'react';
import { Check, ChevronDown, ChevronRight, Download, HardDrive, Key, Loader2, Plug, Trash2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge, Button } from '../../../../../../../shared/view/ui';
import SessionProviderLogo from '../../../../../../llm-logo-provider/SessionProviderLogo';
import type { AgentProvider, ApiKeyStatus, AuthStatus, InstallStatus } from '../../../../../types/types';

type AccountContentProps = {
  agent: AgentProvider;
  authStatus: AuthStatus;
  installStatus: InstallStatus;
  apiKeyStatus: ApiKeyStatus;
  onLogin: () => void;
  onInstall: () => void;
  onUninstall: () => void;
  onValidateApiKey: (key: string) => Promise<void>;
  onResetApiKeyValidation: () => void;
};

type AgentVisualConfig = {
  name: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
  subtextClass: string;
  buttonClass: string;
  description?: string;
};

const agentConfig: Record<AgentProvider, AgentVisualConfig> = {
  claude: {
    name: 'Claude',
    bgClass: 'bg-blue-50 dark:bg-blue-900/20',
    borderClass: 'border-blue-200 dark:border-blue-800',
    textClass: 'text-blue-900 dark:text-blue-100',
    subtextClass: 'text-blue-700 dark:text-blue-300',
    buttonClass: 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800',
  },
  cursor: {
    name: 'Cursor',
    bgClass: 'bg-purple-50 dark:bg-purple-900/20',
    borderClass: 'border-purple-200 dark:border-purple-800',
    textClass: 'text-purple-900 dark:text-purple-100',
    subtextClass: 'text-purple-700 dark:text-purple-300',
    buttonClass: 'bg-purple-600 hover:bg-purple-700 active:bg-purple-800',
  },
  codex: {
    name: 'Codex',
    bgClass: 'bg-muted/50',
    borderClass: 'border-gray-300 dark:border-gray-600',
    textClass: 'text-gray-900 dark:text-gray-100',
    subtextClass: 'text-gray-700 dark:text-gray-300',
    buttonClass: 'bg-gray-800 hover:bg-gray-900 active:bg-gray-950 dark:bg-gray-700 dark:hover:bg-gray-600 dark:active:bg-gray-500',
  },
  gemini: {
    name: 'Gemini',
    description: 'Google Gemini AI assistant',
    bgClass: 'bg-indigo-50 dark:bg-indigo-900/20',
    borderClass: 'border-indigo-200 dark:border-indigo-800',
    textClass: 'text-indigo-900 dark:text-indigo-100',
    subtextClass: 'text-indigo-700 dark:text-indigo-300',
    buttonClass: 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800',
  },
};

export default function AccountContent({ agent, authStatus, installStatus, apiKeyStatus, onLogin, onInstall, onUninstall, onValidateApiKey, onResetApiKeyValidation }: AccountContentProps) {
  const { t } = useTranslation('settings');
  const config = agentConfig[agent];
  const [showLog, setShowLog] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');

  const isBusy = installStatus.installing || installStatus.uninstalling;
  const isCursor = agent === 'cursor';
  const isEnvKey = apiKeyStatus.source === 'env';
  const isKeyValidated = apiKeyStatus.validationStatus === 'valid';
  const isValidating = apiKeyStatus.validationStatus === 'validating';
  const canInstall = isCursor || isKeyValidated;

  const handleApiKeyChange = (value: string) => {
    setApiKeyInput(value);
    // Any modification after a previous validation invalidates the result
    if (apiKeyStatus.validationStatus === 'valid' || apiKeyStatus.validationStatus === 'invalid') {
      onResetApiKeyValidation();
    }
  };

  return (
    <div className="space-y-6">
      <div className="mb-4 flex items-center gap-3">
        <SessionProviderLogo provider={agent} className="h-6 w-6" />
        <div>
          <h3 className="text-lg font-medium text-foreground">{config.name}</h3>
          <p className="text-sm text-muted-foreground">{t(`agents.account.${agent}.description`)}</p>
        </div>
      </div>

      {/* API Key section */}
      <div className={`${config.bgClass} border ${config.borderClass} rounded-lg p-4`}>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className={`font-medium ${config.textClass}`}>
                <Key className="mr-1.5 inline h-4 w-4" />
                {t('agents.apiKey.title')}
              </div>
              <div className={`text-sm ${config.subtextClass}`}>
                {isEnvKey ? (
                  t('agents.apiKey.setViaEnv')
                ) : isKeyValidated ? (
                  isCursor ? t('agents.apiKey.cursorSaved') : t('agents.apiKey.validated')
                ) : isCursor ? (
                  t('agents.apiKey.cursorNote')
                ) : (
                  t('agents.apiKey.description', { agent: config.name })
                )}
              </div>
            </div>
            <div>
              {isValidating ? (
                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  {isCursor ? t('agents.apiKey.saving') : t('agents.apiKey.validating')}
                </Badge>
              ) : isKeyValidated ? (
                <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                  <Check className="mr-1 h-3 w-3" />
                  {isCursor ? t('agents.apiKey.saved') : t('agents.apiKey.valid')}
                </Badge>
              ) : apiKeyStatus.validationStatus === 'invalid' ? (
                <Badge variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                  <X className="mr-1 h-3 w-3" />
                  {t('agents.apiKey.invalid')}
                </Badge>
              ) : (
                <Badge variant="secondary" className="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">
                  {t('agents.apiKey.notSet')}
                </Badge>
              )}
            </div>
          </div>

          {/* Key input — disabled for env vars */}
          <div className="border-t border-border/50 pt-4">
            <div className="flex items-center gap-2">
              <input
                type="password"
                value={isEnvKey ? '' : apiKeyInput}
                onChange={(e) => handleApiKeyChange(e.target.value)}
                disabled={isEnvKey || isValidating}
                placeholder={isEnvKey && apiKeyStatus.masked ? apiKeyStatus.masked : t('agents.apiKey.placeholder', { agent: config.name })}
                className="h-9 flex-1 rounded-md border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                autoComplete="off"
                spellCheck={false}
              />
              <Button
                onClick={() => void onValidateApiKey(apiKeyInput.trim())}
                disabled={isEnvKey || isValidating || !apiKeyInput.trim()}
                className={`${config.buttonClass} text-white`}
                size="sm"
              >
                {isValidating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-2 h-4 w-4" />
                )}
                {isCursor ? t('agents.apiKey.saveButton') : t('agents.apiKey.validateButton')}
              </Button>
            </div>
            {isEnvKey && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                {t('agents.apiKey.envLabel')}
              </p>
            )}
            {apiKeyStatus.validationError && (
              <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">
                {apiKeyStatus.validationError}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Installation status section */}
      <div className={`${config.bgClass} border ${config.borderClass} rounded-lg p-4`}>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className={`font-medium ${config.textClass}`}>
                <HardDrive className="mr-1.5 inline h-4 w-4" />
                {t('agents.installStatus')}
              </div>
              <div className={`text-sm ${config.subtextClass}`}>
                {installStatus.loading ? (
                  t('agents.authStatus.checkingAuth')
                ) : installStatus.installing ? (
                  t('agents.install.installing')
                ) : installStatus.uninstalling ? (
                  t('agents.install.uninstalling')
                ) : installStatus.installed ? (
                  installStatus.version
                    ? t('agents.install.version', { version: installStatus.version })
                    : t('agents.install.installedDescription', { agent: config.name })
                ) : (
                  t('agents.install.installDescription', { agent: config.name })
                )}
              </div>
            </div>
            <div>
              {installStatus.loading ? (
                <Badge variant="secondary" className="bg-muted">
                  {t('agents.authStatus.checking')}
                </Badge>
              ) : isBusy ? (
                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                  {installStatus.installing ? t('agents.install.installing') : t('agents.install.uninstalling')}
                </Badge>
              ) : installStatus.installed ? (
                <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                  {t('agents.install.installed')}
                </Badge>
              ) : (
                <Badge variant="secondary" className="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">
                  {t('agents.install.notInstalled')}
                </Badge>
              )}
            </div>
          </div>

          {/* Install/Uninstall actions */}
          {!installStatus.loading && (
            <div className="border-t border-border/50 pt-4">
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-2">
                  {!installStatus.installed && (
                    <div className="group relative">
                      <Button
                        onClick={onInstall}
                        disabled={isBusy || !canInstall}
                        className={`${config.buttonClass} text-white`}
                        size="sm"
                      >
                        <Download className="mr-2 h-4 w-4" />
                        {t('agents.install.installButton')}
                      </Button>
                      {!canInstall && !isBusy && (
                        <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded bg-popover px-2 py-1 text-xs text-popover-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100">
                          {t('agents.apiKey.validateFirst')}
                        </div>
                      )}
                    </div>
                  )}
                  {installStatus.installed && (
                    <>
                      <Button
                        onClick={onInstall}
                        disabled={isBusy}
                        className={`${config.buttonClass} text-white`}
                        size="sm"
                      >
                        <Download className="mr-2 h-4 w-4" />
                        {t('agents.install.reinstallButton')}
                      </Button>
                      <Button
                        onClick={onUninstall}
                        disabled={isBusy}
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700 dark:text-red-400"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        {t('agents.install.uninstallButton')}
                      </Button>
                    </>
                  )}
                </div>
                {!canInstall && !installStatus.installed && !isBusy && (
                  <p className="text-xs text-muted-foreground">
                    {t('agents.apiKey.validateFirst')}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Install log — auto-expanded while busy, collapsible otherwise */}
          {(isBusy || installStatus.log.length > 0) && (
            <div className="border-t border-border/50 pt-3">
              <button
                onClick={() => setShowLog(!showLog)}
                className={`flex items-center gap-1 text-xs font-medium ${config.subtextClass} hover:underline`}
              >
                {(showLog || isBusy) ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                {(showLog || isBusy) ? t('agents.install.hideLog') : t('agents.install.showLog')}
              </button>
              {(showLog || isBusy) && (
                <pre className="mt-2 max-h-40 overflow-auto rounded bg-black/10 p-2 text-xs text-foreground dark:bg-white/5">
                  {installStatus.log.length > 0
                    ? installStatus.log.join('\n')
                    : (installStatus.installing ? t('agents.install.waitingForLog') : t('agents.install.uninstallWaitingForLog'))}
                </pre>
              )}
            </div>
          )}

          {/* Install error */}
          {installStatus.error && (
            <div className="border-t border-border/50 pt-3">
              <div className="text-sm text-red-600 dark:text-red-400">
                {t('agents.error', { error: installStatus.error })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Connection status section (only shown when installed) */}
      {installStatus.installed && (
        <div className={`${config.bgClass} border ${config.borderClass} rounded-lg p-4`}>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className={`font-medium ${config.textClass}`}>
                  <Plug className="mr-1.5 inline h-4 w-4" />
                  {t('agents.connectionStatus')}
                </div>
                <div className={`text-sm ${config.subtextClass}`}>
                  {authStatus.loading ? (
                    t('agents.authStatus.checkingAuth')
                  ) : authStatus.authenticated ? (
                    t('agents.authStatus.loggedInAs', {
                      email: authStatus.email || t('agents.authStatus.authenticatedUser'),
                    })
                  ) : (
                    t('agents.authStatus.notConnected')
                  )}
                </div>
              </div>
              <div>
                {authStatus.loading ? (
                  <Badge variant="secondary" className="bg-muted">
                    {t('agents.authStatus.checking')}
                  </Badge>
                ) : authStatus.authenticated ? (
                  <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                    {t('agents.authStatus.connected')}
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                    {t('agents.authStatus.disconnected')}
                  </Badge>
                )}
              </div>
            </div>

            {authStatus.error && (
              <div className="border-t border-border/50 pt-4">
                <div className="text-sm text-red-600 dark:text-red-400">
                  {t('agents.error', { error: authStatus.error })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
