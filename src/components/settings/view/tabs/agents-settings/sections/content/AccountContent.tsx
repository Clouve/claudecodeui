import { useEffect, useState } from 'react';
import { Check, ChevronDown, ChevronRight, Download, ExternalLink, Loader2, Plug, Trash2, X } from 'lucide-react';
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
  keyUrl: string;
  description?: string;
};

const agentConfig: Record<AgentProvider, AgentVisualConfig> = {
  claude: {
    name: 'Claude',
    bgClass: 'bg-amber-50 dark:bg-amber-950/20',
    borderClass: 'border-amber-200 dark:border-amber-800',
    textClass: 'text-amber-900 dark:text-amber-100',
    subtextClass: 'text-amber-700 dark:text-amber-300',
    buttonClass: 'bg-stone-800 hover:bg-stone-900 active:bg-stone-950',
    keyUrl: 'https://console.anthropic.com/settings/keys',
  },
  cursor: {
    name: 'Cursor',
    bgClass: 'bg-stone-50 dark:bg-stone-900/20',
    borderClass: 'border-stone-200 dark:border-stone-700',
    textClass: 'text-stone-900 dark:text-stone-100',
    subtextClass: 'text-stone-600 dark:text-stone-400',
    buttonClass: 'bg-stone-800 hover:bg-stone-900 active:bg-stone-950 dark:bg-stone-700 dark:hover:bg-stone-600 dark:active:bg-stone-500',
    keyUrl: 'https://www.cursor.com/settings',
  },
  codex: {
    name: 'Codex',
    bgClass: 'bg-violet-50 dark:bg-violet-950/20',
    borderClass: 'border-violet-200 dark:border-violet-800',
    textClass: 'text-violet-900 dark:text-violet-100',
    subtextClass: 'text-violet-700 dark:text-violet-300',
    buttonClass: 'bg-violet-700 hover:bg-violet-800 active:bg-violet-900',
    keyUrl: 'https://platform.openai.com/api-keys',
  },
  gemini: {
    name: 'Gemini',
    description: 'Google Gemini AI assistant',
    bgClass: 'bg-blue-50 dark:bg-blue-950/20',
    borderClass: 'border-blue-200 dark:border-blue-800',
    textClass: 'text-blue-900 dark:text-blue-100',
    subtextClass: 'text-blue-700 dark:text-blue-300',
    buttonClass: 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800',
    keyUrl: 'https://aistudio.google.com/apikey',
  },
};

export default function AccountContent({ agent, authStatus, installStatus, apiKeyStatus, onLogin: _onLogin, onInstall, onUninstall, onValidateApiKey, onResetApiKeyValidation }: AccountContentProps) {
  const { t } = useTranslation('settings');
  const config = agentConfig[agent];
  const [showLog, setShowLog] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [pendingInstall, setPendingInstall] = useState(false);

  const isBusy = installStatus.installing || installStatus.uninstalling;
  const isCursor = agent === 'cursor';
  const hasPersistedKey = apiKeyStatus.source === 'env';
  const isKeyValidated = apiKeyStatus.validationStatus === 'valid';
  const isValidating = apiKeyStatus.validationStatus === 'validating';
  const canInstall = isCursor || isKeyValidated || hasPersistedKey;

  // Chain: after validation succeeds, auto-trigger install
  useEffect(() => {
    if (!pendingInstall) return;
    if (apiKeyStatus.validationStatus === 'valid') {
      setPendingInstall(false);
      onInstall();
    } else if (apiKeyStatus.validationStatus === 'invalid') {
      setPendingInstall(false);
    }
  }, [pendingInstall, apiKeyStatus.validationStatus, onInstall]);

  const handleApiKeyChange = (value: string) => {
    setApiKeyInput(value);
    if (apiKeyStatus.validationStatus === 'valid' || apiKeyStatus.validationStatus === 'invalid') {
      onResetApiKeyValidation();
    }
  };

  const handleValidateAndInstall = () => {
    if (!installStatus.installed) {
      setPendingInstall(true);
    }
    void onValidateApiKey(apiKeyInput.trim());
  };

  // Determine the overall status for the header badge
  const overallStatus = (() => {
    if (installStatus.loading || authStatus.loading) return 'checking';
    if (isValidating) return 'validating';
    if (pendingInstall || installStatus.installing) return 'installing';
    if (installStatus.uninstalling) return 'uninstalling';
    if (installStatus.installed && authStatus.authenticated) return 'connected';
    if (installStatus.installed) return 'installed';
    if (isKeyValidated || hasPersistedKey) return 'ready';
    return 'notSetUp';
  })();

  const statusBadge = (() => {
    switch (overallStatus) {
      case 'checking':
        return (
          <Badge variant="secondary" className="bg-muted">
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            {t('agents.authStatus.checking')}
          </Badge>
        );
      case 'validating':
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            {isCursor ? t('agents.apiKey.saving') : t('agents.apiKey.validating')}
          </Badge>
        );
      case 'installing':
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            {t('agents.install.installing')}
          </Badge>
        );
      case 'uninstalling':
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            {t('agents.install.uninstalling')}
          </Badge>
        );
      case 'connected':
        return (
          <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
            <Check className="mr-1 h-3 w-3" />
            {t('agents.authStatus.connected')}
          </Badge>
        );
      case 'installed':
        return (
          <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
            <Check className="mr-1 h-3 w-3" />
            {t('agents.install.installed')}
          </Badge>
        );
      case 'ready':
        return (
          <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
            {t('agents.unified.ready')}
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">
            {t('agents.unified.notSetUp')}
          </Badge>
        );
    }
  })();

  // Primary action button for non-installed state
  const primaryActionButton = (() => {
    if (installStatus.installed) return null;

    const isInProgress = isValidating || pendingInstall || installStatus.installing;

    // Env key or already validated — just install
    if (canInstall && !isInProgress) {
      return (
        <Button
          onClick={onInstall}
          disabled={isBusy}
          className={`${config.buttonClass} text-white`}
          size="sm"
        >
          <Download className="mr-2 h-4 w-4" />
          {t('agents.install.installButton')}
        </Button>
      );
    }

    // In progress — show current step
    if (isInProgress) {
      return (
        <Button disabled className={`${config.buttonClass} text-white`} size="sm">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {installStatus.installing
            ? t('agents.install.installing')
            : isValidating
              ? (isCursor ? t('agents.apiKey.saving') : t('agents.apiKey.validating'))
              : t('agents.unified.settingUp')}
        </Button>
      );
    }

    // Need key validation first — combined button
    return (
      <Button
        onClick={handleValidateAndInstall}
        disabled={!apiKeyInput.trim()}
        className={`${config.buttonClass} text-white`}
        size="sm"
      >
        <Download className="mr-2 h-4 w-4" />
        {isCursor ? t('agents.unified.saveAndInstall') : t('agents.unified.validateAndInstall')}
      </Button>
    );
  })();

  return (
    <div className="space-y-4">
      {/* Unified card */}
      <div className={`${config.bgClass} border ${config.borderClass} rounded-lg p-4`}>
        <div className="space-y-4">
          {/* Header: logo, name, badge */}
          <div className="flex items-center gap-3">
            <SessionProviderLogo provider={agent} className="h-6 w-6" />
            <div className="flex-1">
              <h3 className={`font-medium ${config.textClass}`}>{config.name}</h3>
              <p className={`text-sm ${config.subtextClass}`}>{t(`agents.account.${agent}.description`)}</p>
            </div>
            {statusBadge}
          </div>

          {/* API Key input */}
          <div className="border-t border-border/50 pt-4">
            <div className={`mb-2 flex items-center text-sm font-medium ${config.textClass}`}>
              <span>
                {t('agents.apiKey.title')}
                {hasPersistedKey && (
                  <span className={`ml-2 text-xs font-normal ${config.subtextClass}`}>
                    {t('agents.apiKey.setViaEnv')}
                  </span>
                )}
                {isKeyValidated && !hasPersistedKey && (
                  <span className="ml-2 text-xs font-normal text-green-600 dark:text-green-400">
                    <Check className="mr-0.5 inline h-3 w-3" />
                    {isCursor ? t('agents.apiKey.saved') : t('agents.apiKey.valid')}
                  </span>
                )}
                {apiKeyStatus.validationStatus === 'invalid' && (
                  <span className="ml-2 text-xs font-normal text-red-600 dark:text-red-400">
                    <X className="mr-0.5 inline h-3 w-3" />
                    {t('agents.apiKey.invalid')}
                  </span>
                )}
              </span>
              <a
                href={config.keyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`ml-auto flex items-center gap-1 text-xs font-normal ${config.subtextClass} hover:underline`}
              >
                {t('agents.apiKey.getKey')}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => handleApiKeyChange(e.target.value)}
                disabled={isValidating || installStatus.installing}
                placeholder={hasPersistedKey && apiKeyStatus.masked ? apiKeyStatus.masked : t('agents.apiKey.placeholder', { agent: config.name })}
                className="h-9 flex-1 rounded-md border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                autoComplete="off"
                spellCheck={false}
              />
              {/* Primary action when not installed */}
              {primaryActionButton}
              {/* Update key button when already installed */}
              {installStatus.installed && (
                <Button
                  onClick={() => void onValidateApiKey(apiKeyInput.trim())}
                  disabled={isValidating || !apiKeyInput.trim()}
                  className={`${config.buttonClass} text-white`}
                  size="sm"
                >
                  {isValidating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="mr-2 h-4 w-4" />
                  )}
                  {t('agents.apiKey.updateButton')}
                </Button>
              )}
            </div>

            {apiKeyStatus.validationError && (
              <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">
                {apiKeyStatus.validationError}
              </p>
            )}
            {!canInstall && !installStatus.installed && !isBusy && !isValidating && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                {isCursor ? t('agents.apiKey.cursorNote') : t('agents.apiKey.description', { agent: config.name })}
              </p>
            )}
            {installStatus.installed && !isValidating && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                {t('agents.apiKey.updateHint')}
              </p>
            )}
          </div>

          {/* Status details (when installed) */}
          {installStatus.installed && (
            <div className="border-t border-border/50 pt-4">
              <div className="space-y-2">
                {installStatus.version && (
                  <div className={`flex items-center gap-2 text-sm ${config.subtextClass}`}>
                    <Download className="h-3.5 w-3.5" />
                    {t('agents.install.version', { version: installStatus.version })}
                  </div>
                )}
                <div className={`flex items-center gap-2 text-sm ${config.subtextClass}`}>
                  <Plug className="h-3.5 w-3.5" />
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

              {/* Reinstall / Uninstall actions */}
              <div className="mt-3 flex items-center gap-2">
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
              </div>
            </div>
          )}

          {/* Install log */}
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

          {/* Errors — only show auth errors when the client is installed */}
          {(installStatus.error || (authStatus.error && installStatus.installed)) && (
            <div className="border-t border-border/50 pt-3">
              {installStatus.error && (
                <div className="text-sm text-red-600 dark:text-red-400">
                  {installStatus.error}
                </div>
              )}
              {authStatus.error && installStatus.installed && (
                <div className="text-sm text-red-600 dark:text-red-400">
                  {authStatus.error}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
