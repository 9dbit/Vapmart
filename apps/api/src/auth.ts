import { CanActivate, ExecutionContext, ForbiddenException, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { DatabaseService } from './database';

export interface Principal { id: string; email: string | null; }

export function readBearer(value?: string): string {
  const match = /^Bearer ([A-Za-z0-9._~+/=-]+)$/.exec(value || '');
  if (!match) throw new UnauthorizedException('Bearer token required');
  return match[1];
}

@Injectable()
export class SupabaseAuthService {
  async verify(authorization?: string): Promise<Principal> {
    const token = readBearer(authorization);
    const base = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!base || !key) throw new ServiceUnavailableException('Supabase Auth not configured');
    let response: Response;
    try {
      response = await fetch(new URL('/auth/v1/user', base), {
        headers: { Authorization: `Bearer ${token}`, apikey: key },
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      throw new ServiceUnavailableException('Auth provider unavailable');
    }
    if (!response.ok) throw new UnauthorizedException('Invalid or expired access token');
    const user = await response.json() as { id?: unknown; email?: unknown };
    if (typeof user.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(user.id)) {
      throw new UnauthorizedException('Invalid user identity');
    }
    return { id: user.id, email: typeof user.email === 'string' ? user.email : null };
  }
}

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly auth: SupabaseAuthService, private readonly db: DatabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{headers:{authorization?:string}; user?:Principal}>();
    const user = await this.auth.verify(request.headers.authorization);
    const result = await this.db.query(
      'SELECT 1 FROM public.staff_roles WHERE user_id = $1 AND role = $2 AND is_active = true LIMIT 1',
      [user.id, 'admin']
    );
    if (!result.rows.length) throw new ForbiddenException('Admin role required');
    request.user = user;
    return true;
  }
}

@Injectable()
export class CustomerGuard implements CanActivate {
  constructor(private readonly auth:SupabaseAuthService){}
  async canActivate(context:ExecutionContext):Promise<boolean>{
    const req=context.switchToHttp().getRequest<{headers:{authorization?:string};user?:Principal}>();
    req.user=await this.auth.verify(req.headers.authorization);
    return true;
  }
}
