import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { bigintJsonReplacer } from './utils/bigint.js';
import { attachAuth } from './middlewares/auth.middleware.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { tripRouter } from './modules/trip/trip.routes.js';
import { inviteRouter } from './modules/invite/invite.routes.js';
import { DEMO_TRIP_ID, getDemoTrip } from './modules/demo/demo.service.js';

export const app = express();
app.disable('x-powered-by');
app.set('json replacer', bigintJsonReplacer);

app.use(cors({ origin: env.CLIENT_URL, credentials: true, exposedHeaders: ['X-Cache'] }));
app.use(express.json());
app.use(cookieParser());

app.get('/api/health', (_request, response) => {
  response.json({
    status: 'ok',
    service: 'HaGiangWiki API',
    time: new Date().toISOString(),
  });
});

app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});
app.get(`/api/trips/${DEMO_TRIP_ID}`, async (_req, res) => {
  res.json(await getDemoTrip());
});
app.use(attachAuth);
app.use('/api/auth', authRouter);
app.use('/api/trips', tripRouter);
app.use('/api/invites', inviteRouter);
app.use((_req, res) => { res.status(404).json({ error: 'Không tìm thấy API.' }); });
app.use(errorHandler);
