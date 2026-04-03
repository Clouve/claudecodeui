import { useState } from 'react';
import { ChevronDown, ChevronRight, Download, LogIn, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge, Button } from '../../../../../../../shared/view/ui';
import SessionProviderLogo from '../../../../../../llm-logo-provider/SessionProviderLogo';
import type { AgentProvider, AuthStatus, InstallStatus } from '../../../../../types/types';

type AccountContentProps = {
  agent: AgentProvider;
  authStatus: AuthStatus;
  installStatus: InstallStatus;
  onLogin: () => void;
  onInstall: () => void;
  onUninstall: () => void;
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

export default function AccountContent({ agent, authStatus, installStatus, onLogin, onInstall, onUninstall }: AccountContentProps) {
  const { t } = useTranslation('settings');
  const config = agentConfig[agent];
  const [showLog, setShowLog] = useState(false);

  const isBusy = installStatus.installing || installStatus.uninstalling;

  return (
    <div className="space-y-6">
      <div className="mb-4 flex items-center gap-3">
        <SessionProviderLogo provider={agent} className="h-6 w-6" />
        <div>
          <h3 className="text-lg font-medium text-foreground">{config.name}</h3>
          <p className="text-sm text-muted-foreground">{t(`agents.account.${agent}.description`)}</p>
        </div>
      </div>

      {/* Installation status section */}
      <div className={`${config.bgClass} border ${config.borderClass} rounded-lg p-4`}>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className={`font-medium ${config.textClass}`}>
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
              <div className="flex items-center gap-2">
                {!installStatus.installed && (
                  <Button
                    onClick={onInstall}
                    disabled={isBusy}
                    className={`${config.buttonClass} text-white`}
                    size="sm"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    {t('agents.install.installButton')}
                  </Button>
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
            </div>
          )}

          {/* Install log (collapsible) */}
          {installStatus.log.length > 0 && (
            <div className="border-t border-border/50 pt-3">
              <button
                onClick={() => setShowLog(!showLog)}
                className={`flex items-center gap-1 text-xs font-medium ${config.subtextClass} hover:underline`}
              >
                {showLog ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                {showLog ? t('agents.install.hideLog') : t('agents.install.showLog')}
              </button>
              {showLog && (
                <pre className="mt-2 max-h-40 overflow-auto rounded bg-black/10 p-2 text-xs text-foreground dark:bg-white/5">
                  {installStatus.log.join('\n')}
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
                  <Badge variant="secondary" className="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">
                    {t('agents.authStatus.disconnected')}
                  </Badge>
                )}
              </div>
            </div>

            {authStatus.method !== 'api_key' && (
              <div className="border-t border-border/50 pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className={`font-medium ${config.textClass}`}>
                      {authStatus.authenticated ? t('agents.login.reAuthenticate') : t('agents.login.title')}
                    </div>
                    <div className={`text-sm ${config.subtextClass}`}>
                      {authStatus.authenticated
                        ? t('agents.login.reAuthDescription')
                        : t('agents.login.description', { agent: config.name })}
                    </div>
                  </div>
                  <Button
                    onClick={onLogin}
                    className={`${config.buttonClass} text-white`}
                    size="sm"
                  >
                    <LogIn className="mr-2 h-4 w-4" />
                    {authStatus.authenticated ? t('agents.login.reLoginButton') : t('agents.login.button')}
                  </Button>
                </div>
              </div>
            )}

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
