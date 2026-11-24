import { Router } from 'express';
import { dayRouteSummary, route, weather } from './external.controller.js';

export const externalRouter = Router({ mergeParams: true });
externalRouter.get('/weather', weather);
externalRouter.get('/route', route);
externalRouter.get('/day-route-summary', dayRouteSummary);
