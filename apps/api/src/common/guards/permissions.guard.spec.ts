import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permission, TeamRole } from '@watsapp/database';
import { REQUIRED_PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import { PermissionsGuard } from './permissions.guard';

function contextWithPrincipal(principal: unknown): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ principal }) }),
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard', () => {
  it('allows owners to bypass explicit permission checks', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue([Permission.INBOX_WRITE]) } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    expect(guard.canActivate(contextWithPrincipal({ teamId: 'team', role: TeamRole.OWNER, permissions: [] }))).toBe(true);
  });

  it('allows principals with all required permissions', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue([Permission.INBOX_READ, Permission.INBOX_WRITE]) } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    expect(guard.canActivate(contextWithPrincipal({ teamId: 'team', role: TeamRole.MEMBER, permissions: [Permission.INBOX_READ, Permission.INBOX_WRITE] }))).toBe(true);
  });

  it('rejects principals missing required permissions', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue([Permission.AGENT_MANAGE]) } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    expect(() => guard.canActivate(contextWithPrincipal({ teamId: 'team', role: TeamRole.MEMBER, permissions: [Permission.INBOX_READ] }))).toThrow(ForbiddenException);
  });
});
