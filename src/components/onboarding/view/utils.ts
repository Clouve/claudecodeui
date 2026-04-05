import { IS_PLATFORM } from '../../../constants/config';

export const gitEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const selectedProject = {
  name: 'default',
  displayName: 'default',
  fullPath: IS_PLATFORM ? '/workspace' : '',
  path: IS_PLATFORM ? '/workspace' : '',
};

export const readErrorMessageFromResponse = async (response: Response, fallback: string) => {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error || fallback;
  } catch {
    return fallback;
  }
};
