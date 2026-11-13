import type { RequestHandler } from 'express';
import { HttpError, AUTH_REQUIRED } from '../../utils/httpError.js';
import { currentUser, logoutSession, registerAnonymous, SESSION_COOKIE, SESSION_LIFETIME_MS, sessionCookieOptions } from './auth.service.js';
import { displayNameSchema } from './auth.validation.js';

export const register: RequestHandler = async (req, res) => {
  const input = displayNameSchema.parse(req.body);
  const { user, token } = await registerAnonymous(input.displayName);
  res.cookie(SESSION_COOKIE, token, { ...sessionCookieOptions(), maxAge: SESSION_LIFETIME_MS });
  res.status(201).json({ id: user.id, displayName: user.displayName });
};

export const me: RequestHandler = async (req, res) => {
  if (!req.user) throw new HttpError(401, AUTH_REQUIRED);
  const trips = await currentUser(req.user.id);
  res.json({ user: { id: req.user.id, displayName: req.user.displayName }, trips });
};

export const logout: RequestHandler = async (req, res) => {
  await logoutSession(req.session?.id);
  res.clearCookie(SESSION_COOKIE, sessionCookieOptions());
  res.json({ success: true });
};
