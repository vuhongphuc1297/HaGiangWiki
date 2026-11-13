import type { RequestHandler, Request } from 'express';
import { z } from 'zod';

export function validateBody(schema: z.ZodType): RequestHandler {
  return (req, _res, next) => {
    req.body = schema.parse(req.body);
    next();
  };
}

export function stringParam(req: Request, name: string): string {
  return z.string().min(1).max(200).parse(req.params[name]);
}
