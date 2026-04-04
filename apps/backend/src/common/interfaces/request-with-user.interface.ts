import { Request } from 'express';
import { JwtUserPayload } from '../types/domain';

export interface RequestWithUser extends Request {
  user: JwtUserPayload;
}
