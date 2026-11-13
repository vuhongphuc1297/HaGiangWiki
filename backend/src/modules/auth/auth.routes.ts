import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { validateBody } from '../../middlewares/validate.middleware.js';
import { logout, me, register } from './auth.controller.js';
import { displayNameSchema } from './auth.validation.js';

export const authRouter = Router();
authRouter.post('/register-anonymous', validateBody(displayNameSchema), register);
authRouter.get('/me', requireAuth, me);
authRouter.post('/logout', logout);
