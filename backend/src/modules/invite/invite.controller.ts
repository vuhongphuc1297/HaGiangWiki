import type { RequestHandler } from 'express';
import { stringParam } from '../../middlewares/validate.middleware.js';
import { AUTH_REQUIRED, HttpError } from '../../utils/httpError.js';
import { displayNameSchema } from '../auth/auth.validation.js';
import { SESSION_COOKIE, SESSION_LIFETIME_MS, sessionCookieOptions } from '../auth/auth.service.js';
import { issueInvite, joinInvite, previewInvite } from './invite.service.js';

export const createInvite: RequestHandler = async (req, res) => {
  if (!req.user) throw new HttpError(401, AUTH_REQUIRED);
  res.status(201).json(await issueInvite(stringParam(req, 'tripId'), req.user.id));
};

export const preview: RequestHandler = async (req, res) => {
  res.json(await previewInvite(stringParam(req, 'token')));
};

export const join: RequestHandler = async (req, res) => {
  const input = displayNameSchema.parse(req.body);
  const result = await joinInvite(stringParam(req, 'token'), input.displayName, req.user);
  if (result.sessionToken) res.cookie(SESSION_COOKIE, result.sessionToken, { ...sessionCookieOptions(), maxAge: SESSION_LIFETIME_MS });
  res.json({ success: true, tripId: result.tripId, memberId: result.memberId });
};
