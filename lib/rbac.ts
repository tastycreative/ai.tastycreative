/**
 * Role-Based Access Control (RBAC) utilities for Caption Queue
 *
 * Roles (TeamRole):
 *   OWNER   – full control
 *   ADMIN   – full control
 *   MANAGER – can create / manage queues; can assign creators
 *   CREATOR – can view queues assigned to them; cannot create
 *   VIEWER  – read-only; cannot see caption queue
 *   MEMBER  – read-only; cannot see caption queue
 */

export type OrgRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'CREATOR' | 'VIEWER' | 'MEMBER';

/** Roles that are allowed to CREATE a caption queue ticket */
export const QUEUE_CREATE_ROLES: OrgRole[] = ['OWNER', 'ADMIN', 'MANAGER'];

/** Roles that are allowed to VIEW caption queue tickets */
export const QUEUE_VIEW_ROLES: OrgRole[] = ['OWNER', 'ADMIN', 'MANAGER', 'CREATOR'];

/** Roles that are allowed to DELETE / EDIT any caption queue ticket */
export const QUEUE_MANAGE_ROLES: OrgRole[] = ['OWNER', 'ADMIN', 'MANAGER'];

/** Roles that can be assigned as queue creators */
export const ASSIGNABLE_CREATOR_ROLES: OrgRole[] = ['CREATOR'];

/** Whether the given role can create a caption queue item */
export function canCreateQueue(role: OrgRole | null | undefined): boolean {
  return !!role && (QUEUE_CREATE_ROLES as string[]).includes(role);
}

/** Whether the given role can view caption queue items */
export function canViewQueue(role: OrgRole | null | undefined): boolean {
  return !!role && (QUEUE_VIEW_ROLES as string[]).includes(role);
}

/** Whether the given role can manage (delete/edit) caption queue items */
export function canManageQueue(role: OrgRole | null | undefined): boolean {
  return !!role && (QUEUE_MANAGE_ROLES as string[]).includes(role);
}

/** Whether the given role is a CREATOR (assigned work consumer) */
export function isCreatorRole(role: OrgRole | null | undefined): boolean {
  return role === 'CREATOR';
}
