import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api, authenticatedFetch } from '../utils/api';
import { useWebSocket } from './WebSocketContext';

const TasksSettingsContext = createContext({
  tasksEnabled: true,
  setTasksEnabled: () => {},
  toggleTasksEnabled: () => {},
  isTaskMasterInstalled: null,
  isTaskMasterReady: null,
  installationStatus: null,
  isCheckingInstallation: true,
  // Install lifecycle
  installing: false,
  uninstalling: false,
  installError: null,
  installLog: [],
  version: null,
  installTaskMaster: async () => {},
  uninstallTaskMaster: async () => {},
});

export const useTasksSettings = () => {
  const context = useContext(TasksSettingsContext);
  if (!context) {
    throw new Error('useTasksSettings must be used within a TasksSettingsProvider');
  }
  return context;
};

export const TasksSettingsProvider = ({ children }) => {
  const { latestMessage } = useWebSocket();

  const [tasksEnabled, setTasksEnabled] = useState(() => {
    const saved = localStorage.getItem('tasks-enabled');
    return saved !== null ? JSON.parse(saved) : true;
  });

  const [isTaskMasterInstalled, setIsTaskMasterInstalled] = useState(null);
  const [isTaskMasterReady, setIsTaskMasterReady] = useState(null);
  const [installationStatus, setInstallationStatus] = useState(null);
  const [isCheckingInstallation, setIsCheckingInstallation] = useState(true);

  // Install lifecycle state
  const [installing, setInstalling] = useState(false);
  const [uninstalling, setUninstalling] = useState(false);
  const [installError, setInstallError] = useState(null);
  const [installLog, setInstallLog] = useState([]);
  const [version, setVersion] = useState(null);

  // Save to localStorage whenever tasksEnabled changes
  useEffect(() => {
    localStorage.setItem('tasks-enabled', JSON.stringify(tasksEnabled));
  }, [tasksEnabled]);

  // Check TaskMaster installation status
  const checkInstallation = useCallback(async () => {
    try {
      // Check via the cli-installer endpoint (consistent with agents)
      const cliResponse = await authenticatedFetch('/api/cli-installer/taskmaster/status');
      if (cliResponse.ok) {
        const cliData = await cliResponse.json();
        setIsTaskMasterInstalled(Boolean(cliData.installed));
        setVersion(cliData.version || null);
      }

      // Also check the taskmaster-specific endpoint for MCP/readiness
      const response = await api.get('/taskmaster/installation-status');
      if (response.ok) {
        const data = await response.json();
        setInstallationStatus(data);
        setIsTaskMasterInstalled(data.installation?.isInstalled || false);
        setIsTaskMasterReady(data.isReady || false);
        setVersion(data.installation?.version || null);

        const userEnabledTasks = localStorage.getItem('tasks-enabled');
        if (!data.installation?.isInstalled && !userEnabledTasks) {
          setTasksEnabled(false);
        }
      } else {
        setIsTaskMasterInstalled(false);
        setIsTaskMasterReady(false);
      }
    } catch (error) {
      console.error('Error checking TaskMaster installation:', error);
      setIsTaskMasterInstalled(false);
      setIsTaskMasterReady(false);
    } finally {
      setIsCheckingInstallation(false);
    }
  }, []);

  // Initial check on mount
  useEffect(() => {
    setTimeout(checkInstallation, 0);
  }, [checkInstallation]);

  // Install TaskMaster via cli-installer endpoint
  const installTaskMaster = useCallback(async () => {
    setInstalling(true);
    setInstallError(null);
    setInstallLog([]);

    try {
      const response = await authenticatedFetch('/api/cli-installer/taskmaster/install', {
        method: 'POST',
      });

      const data = await response.json();

      setInstalling(false);
      setInstallLog(data.log || []);

      if (data.success) {
        setIsTaskMasterInstalled(true);
        setVersion(data.version || null);
        setInstallError(null);
        // Re-check full installation status (MCP, readiness, etc.)
        await checkInstallation();
      } else {
        setInstallError(data.message || 'Installation failed');
      }
    } catch (error) {
      setInstalling(false);
      setInstallError(error instanceof Error ? error.message : 'Installation failed');
    }
  }, [checkInstallation]);

  // Uninstall TaskMaster via cli-installer endpoint
  const uninstallTaskMaster = useCallback(async () => {
    setUninstalling(true);
    setInstallError(null);
    setInstallLog([]);

    try {
      const response = await authenticatedFetch('/api/cli-installer/taskmaster/uninstall', {
        method: 'POST',
      });

      const data = await response.json();

      setUninstalling(false);
      setInstallLog(data.log || []);

      if (data.success) {
        setIsTaskMasterInstalled(false);
        setIsTaskMasterReady(false);
        setVersion(null);
        setInstallError(null);
      } else {
        setInstallError(data.message || 'Uninstall failed');
      }
    } catch (error) {
      setUninstalling(false);
      setInstallError(error instanceof Error ? error.message : 'Uninstall failed');
    }
  }, []);

  // Append real-time install/uninstall log lines received via WebSocket
  useEffect(() => {
    if (!latestMessage || latestMessage.type !== 'install_log') return;
    if (latestMessage.provider !== 'taskmaster') return;
    if (!latestMessage.line) return;

    setInstallLog((prev) => [...prev, latestMessage.line]);
  }, [latestMessage]);

  const toggleTasksEnabled = () => {
    setTasksEnabled(prev => !prev);
  };

  const contextValue = {
    tasksEnabled,
    setTasksEnabled,
    toggleTasksEnabled,
    isTaskMasterInstalled,
    isTaskMasterReady,
    installationStatus,
    isCheckingInstallation,
    // Install lifecycle
    installing,
    uninstalling,
    installError,
    installLog,
    version,
    installTaskMaster,
    uninstallTaskMaster,
  };

  return (
    <TasksSettingsContext.Provider value={contextValue}>
      {children}
    </TasksSettingsContext.Provider>
  );
};

export default TasksSettingsContext;
