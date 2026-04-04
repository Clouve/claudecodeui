import { useEffect, useRef } from 'react';
import { Check, ChevronDown, ChevronRight, Loader2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../lib/utils';
import type { TaskmasterInitStatus } from '../hooks/useTaskmasterInit';

type TaskmasterInitPanelProps = {
  status: TaskmasterInitStatus;
  log: string[];
  error: string | null;
  showLog: boolean;
  onToggleLog: () => void;
  onRunInit: () => void;
  onClose: () => void;
  projectDisplayName: string;
  isBusy?: boolean;
  hideIdlePrompt?: boolean;
  className?: string;
};

export default function TaskmasterInitPanel({
  status,
  log,
  error,
  showLog,
  onToggleLog,
  onRunInit,
  onClose,
  projectDisplayName,
  isBusy = status === 'initializing',
  hideIdlePrompt = false,
  className,
}: TaskmasterInitPanelProps) {
  const { t } = useTranslation('tasks');
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log]);

  const statusBadge = (() => {
    switch (status) {
      case 'initializing':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
            <Loader2 className="h-3 w-3 animate-spin" />
            {t('setupModal.statusInitializing')}
          </span>
        );
      case 'success':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-300">
            <Check className="h-3 w-3" />
            {t('setupModal.statusComplete')}
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/30 dark:text-red-300">
            <X className="h-3 w-3" />
            {t('setupModal.statusFailed')}
          </span>
        );
      default:
        return null;
    }
  })();

  return (
    <div className={cn('space-y-4', className)}>
      {statusBadge && <div>{statusBadge}</div>}

      {/* Idle state — confirmation prompt */}
      {status === 'idle' && !hideIdlePrompt && (
        <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
          <p>{t('setupModal.confirmDescription', { projectName: projectDisplayName })}</p>
          <button
            onClick={onRunInit}
            className="inline-flex items-center gap-2 rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 active:bg-teal-900"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            {t('setupModal.initButton')}
          </button>
        </div>
      )}

      {/* Log output */}
      {(isBusy || log.length > 0) && (
        <div>
          <button
            onClick={onToggleLog}
            className="flex items-center gap-1 text-xs font-medium text-gray-600 hover:underline dark:text-gray-400"
          >
            {showLog || isBusy ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            {showLog || isBusy ? t('setupModal.hideLog') : t('setupModal.showLog')}
          </button>
          {(showLog || isBusy) && (
            <pre className="mt-2 max-h-60 overflow-auto rounded bg-gray-950 p-3 text-xs text-gray-300">
              {log.length > 0 ? log.join('\n') : t('setupModal.waitingForOutput')}
              <div ref={logEndRef} />
            </pre>
          )}
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Success message */}
      {status === 'success' && (
        <div className="rounded-md border border-green-200 bg-green-50 p-3 dark:border-green-800/50 dark:bg-green-950/30">
          <div className="flex items-center gap-2 text-sm font-medium text-green-800 dark:text-green-300">
            <Check className="h-4 w-4" />
            {t('setupModal.completed')}
          </div>
        </div>
      )}

      {/* Footer actions */}
      <div className="flex items-center justify-end gap-2">
        {status === 'error' && (
          <button
            onClick={onRunInit}
            disabled={isBusy}
            className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
          >
            {t('setupModal.retryButton')}
          </button>
        )}
        <button
          onClick={onClose}
          className={cn(
            'px-4 py-2 text-sm font-medium rounded-md transition-colors',
            status === 'success'
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600',
          )}
        >
          {status === 'success' ? t('setupModal.closeContinueButton') : t('setupModal.closeButton')}
        </button>
      </div>
    </div>
  );
}
