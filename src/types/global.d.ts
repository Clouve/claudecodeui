export {};

declare global {
  interface Window {
    __ROUTER_BASENAME__?: string;
    refreshProjects?: () => void | Promise<void>;
    openSettings?: (tab?: string) => void;
    openCreateProject?: () => void;
  }

  interface EventSourceEventMap {
    result: MessageEvent;
    progress: MessageEvent;
    done: MessageEvent;
  }
}
