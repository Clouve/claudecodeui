import { useCallback, useEffect, useRef, useState } from 'react';
import { authenticatedFetch } from '../utils/api';
import type { SessionProvider } from '../types/app';

interface ModelOption {
  value: string;
  label: string;
}

interface ProviderModels {
  options: ModelOption[];
  default: string;
  discoveredAt: string | null;
}

type AllModels = Record<string, ProviderModels>;

/** Empty placeholder shown while the API response is in flight. */
const EMPTY_PROVIDER: ProviderModels = { options: [], default: '', discoveredAt: null };

/** Module-level cache so multiple components share one fetch. */
let sharedCache: AllModels | null = null;
let fetchPromise: Promise<AllModels | null> | null = null;

async function fetchAllModels(): Promise<AllModels | null> {
  try {
    const res = await authenticatedFetch('/api/models');
    if (!res.ok) return null;
    const data = await res.json();
    if (data.success && data.models) {
      return data.models as AllModels;
    }
  } catch {
    // Network error — fall back to cache
  }
  return null;
}

/**
 * Hook that provides the dynamic model list for all providers.
 *
 * On mount it fetches the runtime registry from the server.
 * Multiple components share the same in-flight fetch.
 */
export function useModels() {
  const [models, setModels] = useState<AllModels | null>(sharedCache);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    if (sharedCache) {
      setModels(sharedCache);
      return;
    }

    if (!fetchPromise) {
      fetchPromise = fetchAllModels().then((result) => {
        if (result) {
          sharedCache = result;
        }
        fetchPromise = null;
        return result;
      });
    }

    fetchPromise.then((result) => {
      if (mounted.current && result) {
        setModels(result);
      }
    });

    return () => {
      mounted.current = false;
    };
  }, []);

  /** Force a re-fetch (e.g. after installing a provider). */
  const refresh = useCallback(async () => {
    sharedCache = null;
    fetchPromise = null;
    const result = await fetchAllModels();
    if (result) {
      sharedCache = result;
      setModels(result);
    }
  }, []);

  const getProviderModels = useCallback(
    (provider: SessionProvider): ProviderModels => {
      return models?.[provider] ?? EMPTY_PROVIDER;
    },
    [models],
  );

  return { models, getProviderModels, refresh };
}
