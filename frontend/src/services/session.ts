import { api, ApiError } from './api';
import type { AuthMe, User } from '../types/api';

export async function ensureSession(displayName: string): Promise<User> {
  try {
    return (await api<AuthMe>('/auth/me')).user;
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
  }
  return api<User>('/auth/register-anonymous', { method: 'POST', body: { displayName } });
}
