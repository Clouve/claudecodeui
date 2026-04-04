import { useEffect, useMemo, useState } from 'react';
import { ListChecks } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TaskmasterInitStatus } from '../../task-master/hooks/useTaskmasterInit';
import TaskmasterInitPanel from '../../task-master/view/TaskmasterInitPanel';
import { checkTaskmasterInstalled } from '../data/workspaceApi';
import { isSshGitUrl } from '../utils/pathUtils';
import type { WizardFormState } from '../types';

type TaskmasterInitState = {
  status: TaskmasterInitStatus;
  log: string[];
  error: string | null;
  showLog: boolean;
  onToggleLog: () => void;
  onRunInit: () => void;
  projectDisplayName: string;
} | null;

type StepReviewProps = {
  formState: WizardFormState;
  selectedTokenName: string | null;
  isCreating: boolean;
  cloneProgress: string;
  onInitializeTaskmasterChange: (value: boolean) => void;
  onClose: () => void;
  taskmasterInit: TaskmasterInitState;
};

export default function StepReview({
  formState,
  selectedTokenName,
  isCreating,
  cloneProgress,
  onInitializeTaskmasterChange,
  onClose,
  taskmasterInit,
}: StepReviewProps) {
  const { t } = useTranslation();

  const authenticationLabel = useMemo(() => {
    if (formState.tokenMode === 'stored' && formState.selectedGithubToken) {
      return `${t('projectWizard.step3.usingStoredToken')} ${selectedTokenName || 'Unknown'}`;
    }

    if (formState.tokenMode === 'new' && formState.newGithubToken.trim()) {
      return t('projectWizard.step3.usingProvidedToken');
    }

    if (isSshGitUrl(formState.githubUrl)) {
      return t('projectWizard.step3.sshKey', { defaultValue: 'SSH Key' });
    }

    return t('projectWizard.step3.noAuthentication');
  }, [formState, selectedTokenName, t]);

  const [taskmasterInstalled, setTaskmasterInstalled] = useState(false);

  useEffect(() => {
    checkTaskmasterInstalled().then(setTaskmasterInstalled);
  }, []);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/50">
        <h4 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
          {t('projectWizard.step3.reviewConfig')}
        </h4>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">
              {t('projectWizard.step3.workspaceType')}
            </span>
            <span className="font-medium text-gray-900 dark:text-white">
              {formState.workspaceType === 'existing'
                ? t('projectWizard.step3.existingWorkspace')
                : t('projectWizard.step3.newWorkspace')}
            </span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">{t('projectWizard.step3.path')}</span>
            <span className="break-all font-mono text-xs text-gray-900 dark:text-white">
              {formState.workspacePath}
            </span>
          </div>

          {formState.workspaceType === 'new' && formState.githubUrl && (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  {t('projectWizard.step3.cloneFrom')}
                </span>
                <span className="break-all font-mono text-xs text-gray-900 dark:text-white">
                  {formState.githubUrl}
                </span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  {t('projectWizard.step3.authentication')}
                </span>
                <span className="text-xs text-gray-900 dark:text-white">{authenticationLabel}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {taskmasterInstalled && !taskmasterInit && (
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-4 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800/50">
          <input
            type="checkbox"
            checked={formState.initializeTaskmaster}
            onChange={(e) => onInitializeTaskmasterChange(e.target.checked)}
            disabled={isCreating}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600"
          />
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/50">
              <ListChecks className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {t('projectWizard.step3.initTaskmaster', { defaultValue: 'Initialize TaskMaster' })}
              </span>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {t('projectWizard.step3.initTaskmasterHelp', {
                  defaultValue: 'Set up task management for this workspace so you can plan and track work with AI',
                })}
              </p>
            </div>
          </div>
        </label>
      )}

      {taskmasterInit ? (
        <TaskmasterInitPanel
          status={taskmasterInit.status}
          log={taskmasterInit.log}
          error={taskmasterInit.error}
          showLog={taskmasterInit.showLog}
          onToggleLog={taskmasterInit.onToggleLog}
          onRunInit={taskmasterInit.onRunInit}
          onClose={onClose}
          projectDisplayName={taskmasterInit.projectDisplayName}
          hideIdlePrompt
        />
      ) : (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
          {isCreating && cloneProgress ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                {t('projectWizard.step3.cloningRepository', { defaultValue: 'Cloning repository...' })}
              </p>
              <code className="block whitespace-pre-wrap break-all font-mono text-xs text-blue-700 dark:text-blue-300">
                {cloneProgress}
              </code>
            </div>
          ) : (
            <p className="text-sm text-blue-800 dark:text-blue-200">
              {formState.workspaceType === 'existing'
                ? t('projectWizard.step3.existingInfo')
                : formState.githubUrl
                  ? t('projectWizard.step3.newWithClone')
                  : t('projectWizard.step3.newEmpty')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
