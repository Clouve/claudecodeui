import { useState } from 'react';
import { Check, ChevronDown, ChevronRight, Download, ExternalLink, Loader2, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTasksSettings } from '../../../../../contexts/TasksSettingsContext';
import SettingsCard from '../../SettingsCard';
import SettingsRow from '../../SettingsRow';
import SettingsSection from '../../SettingsSection';
import SettingsToggle from '../../SettingsToggle';

type TasksSettingsContextValue = {
  tasksEnabled: boolean;
  setTasksEnabled: (enabled: boolean) => void;
  isTaskMasterInstalled: boolean | null;
  isCheckingInstallation: boolean;
  installing: boolean;
  uninstalling: boolean;
  installError: string | null;
  installLog: string[];
  version: string | null;
  installTaskMaster: () => Promise<void>;
  uninstallTaskMaster: () => Promise<void>;
};

export default function TasksSettingsTab() {
  const { t } = useTranslation('settings');
  const {
    tasksEnabled,
    setTasksEnabled,
    isTaskMasterInstalled,
    isCheckingInstallation,
    installing,
    uninstalling,
    installError,
    installLog,
    version,
    installTaskMaster,
    uninstallTaskMaster,
  } = useTasksSettings() as TasksSettingsContextValue;

  const [showLog, setShowLog] = useState(false);

  const isBusy = installing || uninstalling;

  // Determine overall status for the header badge
  const overallStatus = (() => {
    if (isCheckingInstallation) return 'checking';
    if (installing) return 'installing';
    if (uninstalling) return 'uninstalling';
    if (isTaskMasterInstalled) return 'installed';
    return 'notInstalled';
  })();

  const statusBadge = (() => {
    switch (overallStatus) {
      case 'checking':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
            <Loader2 className="h-3 w-3 animate-spin" />
            {t('tasks.checking')}
          </span>
        );
      case 'installing':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
            <Loader2 className="h-3 w-3 animate-spin" />
            {t('tasks.install.installing')}
          </span>
        );
      case 'uninstalling':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
            <Loader2 className="h-3 w-3 animate-spin" />
            {t('tasks.install.uninstalling')}
          </span>
        );
      case 'installed':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-300">
            <Check className="h-3 w-3" />
            {t('tasks.install.installed')}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800 dark:bg-gray-800 dark:text-gray-300">
            {t('tasks.install.notInstalled')}
          </span>
        );
    }
  })();

  return (
    <div className="space-y-8">
      <SettingsSection title={t('mainTabs.tasks')}>
        {/* TaskMaster installer card */}
        <div className="rounded-lg border border-teal-200 bg-teal-50 p-4 dark:border-teal-800 dark:bg-teal-950/20">
          <div className="space-y-4">
            {/* Header: name + badge */}
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-teal-100 dark:bg-teal-900/50">
                <svg className="h-4 w-4 text-teal-700 dark:text-teal-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-teal-900 dark:text-teal-100">{t('tasks.title')}</h3>
                <p className="text-sm text-teal-700 dark:text-teal-300">{t('tasks.description')}</p>
              </div>
              {statusBadge}
            </div>

            {/* Not installed state — install button + description */}
            {!isTaskMasterInstalled && !isCheckingInstallation && (
              <div className="border-t border-teal-200/50 pt-4 dark:border-teal-800/50">
                <p className="mb-3 text-sm text-teal-800 dark:text-teal-200">
                  {t('tasks.notInstalled.description')}
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={installTaskMaster}
                    disabled={isBusy}
                    className="inline-flex items-center gap-2 rounded-md bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800 active:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {installing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    {installing ? t('tasks.install.installing') : t('tasks.install.installButton')}
                  </button>
                  <a
                    href="https://github.com/eyaltoledano/claude-task-master"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-700 hover:text-teal-800 dark:text-teal-300 dark:hover:text-teal-200"
                  >
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z" clipRule="evenodd" />
                    </svg>
                    {t('tasks.notInstalled.viewOnGitHub')}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            )}

            {/* Installed state — version + reinstall/uninstall */}
            {isTaskMasterInstalled && (
              <div className="border-t border-teal-200/50 pt-4 dark:border-teal-800/50">
                <div className="space-y-2">
                  {version && (
                    <div className="flex items-center gap-2 text-sm text-teal-700 dark:text-teal-300">
                      <Download className="h-3.5 w-3.5" />
                      {t('tasks.install.version', { version })}
                    </div>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={installTaskMaster}
                    disabled={isBusy}
                    className="inline-flex items-center gap-2 rounded-md bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800 active:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Download className="h-4 w-4" />
                    {t('tasks.install.reinstallButton')}
                  </button>
                  <button
                    onClick={uninstallTaskMaster}
                    disabled={isBusy}
                    className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                    {t('tasks.install.uninstallButton')}
                  </button>
                </div>
              </div>
            )}

            {/* Install/uninstall log */}
            {(isBusy || installLog.length > 0) && (
              <div className="border-t border-teal-200/50 pt-3 dark:border-teal-800/50">
                <button
                  onClick={() => setShowLog(!showLog)}
                  className="flex items-center gap-1 text-xs font-medium text-teal-700 hover:underline dark:text-teal-300"
                >
                  {(showLog || isBusy) ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  {(showLog || isBusy) ? t('tasks.install.hideLog') : t('tasks.install.showLog')}
                </button>
                {(showLog || isBusy) && (
                  <pre className="mt-2 max-h-40 overflow-auto rounded bg-black/10 p-2 text-xs text-foreground dark:bg-white/5">
                    {installLog.length > 0
                      ? installLog.join('\n')
                      : (installing ? t('tasks.install.waitingForLog') : t('tasks.install.uninstallWaitingForLog'))}
                  </pre>
                )}
              </div>
            )}

            {/* Error display */}
            {installError && (
              <div className="border-t border-teal-200/50 pt-3 dark:border-teal-800/50">
                <div className="text-sm text-red-600 dark:text-red-400">
                  {installError}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Enable/disable toggle — only when installed */}
        {isTaskMasterInstalled && (
          <SettingsCard>
            <SettingsRow
              label={t('tasks.settings.enableLabel')}
              description={t('tasks.settings.enableDescription')}
            >
              <SettingsToggle
                checked={tasksEnabled}
                onChange={setTasksEnabled}
                ariaLabel={t('tasks.settings.enableLabel')}
              />
            </SettingsRow>
          </SettingsCard>
        )}
      </SettingsSection>
    </div>
  );
}
