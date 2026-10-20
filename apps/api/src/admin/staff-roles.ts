import { AdminRole } from '@watsapp/database';

/** أدوار بوابة الموظفين /staff */
export const EMPLOYEE_ROLES: AdminRole[] = [
  AdminRole.STAFF,
  AdminRole.ACCOUNTANT,
  AdminRole.MAILBOX_CREATOR,
];

export const ACCOUNTANT_ROLES: AdminRole[] = [AdminRole.STAFF, AdminRole.ACCOUNTANT];

export const MAILBOX_STAFF_ROLES: AdminRole[] = [AdminRole.MAILBOX_CREATOR];

export function isEmployeeRole(role: AdminRole | string) {
  return EMPLOYEE_ROLES.includes(role as AdminRole);
}

export function parseStoredRoles(raw: unknown, fallbackRole?: AdminRole | string | null): AdminRole[] {
  const out: AdminRole[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === 'string' && EMPLOYEE_ROLES.includes(item as AdminRole)) {
        out.push(item as AdminRole);
      }
    }
  }
  if (!out.length && fallbackRole && isEmployeeRole(fallbackRole)) {
    out.push(fallbackRole as AdminRole);
  }
  return [...new Set(out)];
}

/** تطبيع قائمة أدوار الموظف — يجب اختيار دور واحد على الأقل */
export function normalizeStaffRoles(input?: string[] | string | null): AdminRole[] {
  const list = Array.isArray(input) ? input : input ? [input] : [];
  const unique = [...new Set(list.map((r) => String(r).trim()).filter(Boolean))]
    .filter((r) => EMPLOYEE_ROLES.includes(r as AdminRole))
    .map((r) => r as AdminRole);
  if (!unique.length) return [AdminRole.ACCOUNTANT];
  return unique;
}

/** الدور الأساسي المخزّن في عمود role (للتوافق) */
export function primaryStaffRole(roles: AdminRole[]): AdminRole {
  if (roles.includes(AdminRole.ACCOUNTANT)) return AdminRole.ACCOUNTANT;
  if (roles.includes(AdminRole.MAILBOX_CREATOR)) return AdminRole.MAILBOX_CREATOR;
  if (roles.includes(AdminRole.STAFF)) return AdminRole.STAFF;
  return roles[0] ?? AdminRole.ACCOUNTANT;
}

export function resolveAdminRoles(role: AdminRole, storedRoles: unknown): AdminRole[] {
  if (!isEmployeeRole(role)) return [role];
  const parsed = parseStoredRoles(storedRoles, role);
  return parsed.length ? parsed : [role];
}

export function hasAnyRole(roles: AdminRole[], required: AdminRole[]) {
  return required.some((r) => roles.includes(r));
}

export function canManageSubscriptions(roles: AdminRole[] | AdminRole | string) {
  const list = Array.isArray(roles) ? roles : [roles as AdminRole];
  return (
    list.includes(AdminRole.SUPER_ADMIN) ||
    list.includes(AdminRole.BILLING_MANAGER) ||
    hasAnyRole(list, ACCOUNTANT_ROLES)
  );
}

export function canManageMailboxes(roles: AdminRole[] | AdminRole | string) {
  const list = Array.isArray(roles) ? roles : [roles as AdminRole];
  return (
    list.includes(AdminRole.SUPER_ADMIN) ||
    list.includes(AdminRole.SUPPORT_AGENT) ||
    hasAnyRole(list, MAILBOX_STAFF_ROLES)
  );
}

export function canEditReferrals(roles: AdminRole[] | AdminRole | string) {
  const list = Array.isArray(roles) ? roles : [roles as AdminRole];
  return list.includes(AdminRole.SUPER_ADMIN);
}

export const STAFF_ROLE_OPTIONS = [
  { value: AdminRole.ACCOUNTANT, labelAr: 'محاسب (تفعيل الاشتراكات)' },
  { value: AdminRole.MAILBOX_CREATOR, labelAr: 'إنشاء الحسابات (البريد)' },
  { value: AdminRole.STAFF, labelAr: 'موظف عام (اشتراكات)' },
] as const;
