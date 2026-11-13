import { Router } from 'express';
import { validateBody } from '../../middlewares/validate.middleware.js';
import { displayNameSchema } from '../auth/auth.validation.js';
import { join, preview } from './invite.controller.js';

export const inviteRouter = Router();
inviteRouter.get('/:token', preview);
inviteRouter.post('/:token/join', validateBody(displayNameSchema), join);
