import { useCallback } from 'react';
import { Check, Loader2, Plus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTaskMaster } from '../../context/TaskMasterContext';
import { useTaskmasterInit } from '../../hooks/useTaskmasterInit';
import type { TaskMasterProject } from '../../types';
import TaskmasterInitPanel from '../TaskmasterInitPanel';

type TaskMasterSetupModalProps = {
  isOpen: boolean;
  project: TaskMasterProject | null;
  onClose: () => void;
  onAfterClose?: (() => void) | null;
};

export default function TaskMasterSetupModal({ isOpen, project, onClose, onAfterClose = null }: TaskMasterSetupModalProps) {
  const { t } = useTranslation('tasks');
  const { refreshProjects, refreshTasks } = useTaskMaster();

  const onInitSuccess = useCallback(async () => {
    await refreshProjects();
    void refreshTasks();
  }, [refreshProjects, refreshTasks]);

  const { status, log, error, showLog, setShowLog, runInit, resetState } = useTaskmasterInit({
    projectName: project?.name,
    onSuccess: onInitSuccess,
  });

  if (!isOpen || !project) {
    return null;
  }

  const closeModal = () => {
    onClose();

    if (status === 'success') {
      onAfterClose?.();
    }

    resetState();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-16 backdrop-blur-sm">
      <div className="flex w-full max-w-2xl flex-col rounded-lg border border-gray-200 bg-white text-left shadow-xl dark:border-gray-700 dark:bg-gray-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-100 dark:bg-teal-900/50">
              <svg className="h-4 w-4 text-teal-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('setupModal.title')}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('setupModal.subtitle', { projectName: project.displayName })}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {status === 'initializing' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                <Loader2 className="h-3 w-3 animate-spin" />
                {t('setupModal.statusInitializing')}
              </span>
            )}
            {status === 'success' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-300">
                <Check className="h-3 w-3" />
                {t('setupModal.statusComplete')}
              </span>
            )}
            {status === 'error' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/30 dark:text-red-300">
                <X className="h-3 w-3" />
                {t('setupModal.statusFailed')}
              </span>
            )}
            <button
              onClick={closeModal}
              className="rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
              title="Close"
            >
              <Plus className="h-5 w-5 rotate-45" />
            </button>
          </div>
        </div>

        {/* Content + Footer via shared panel */}
        <TaskmasterInitPanel
          className="p-4"
          status={status}
          log={log}
          error={error}
          showLog={showLog}
          onToggleLog={() => setShowLog((v) => !v)}
          onRunInit={runInit}
          onClose={closeModal}
          projectDisplayName={project.displayName}
          hideStatusBadge
        />
      </div>
    </div>
  );
}
