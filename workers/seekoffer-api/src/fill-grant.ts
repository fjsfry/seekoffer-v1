import { ApiError } from './auth.ts';

export const FILL_GRANT_PROTOCOL = 'seekoffer-fill/v1';
export const FILL_AUTHORIZATION_URL = 'https://migration.seekoffer.com.cn/v1/me/billing';
export const FILL_GRANT_TTL_MS = 5 * 60_000;
const fieldIds = new Set([
  'name', 'email', 'phone', 'undergraduateSchool', 'major', 'grade',
  'targetMajor', 'targetRegion', 'targetSchool', 'targetDepartment'
]);
const boundId = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export type FillGrant = {
  protocol: typeof FILL_GRANT_PROTOCOL;
  grantId: string;
  userIdHash: string;
  applicationId: string;
  schoolId?: string;
  departmentId?: string;
  fieldIds: string[];
  issuedAt: string;
  expiresAt: string;
  nonce: string;
};

export function fillRequestId(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{16,120}$/.test(value)) {
    throw new ApiError(400, 'INVALID_REQUEST_ID');
  }
  return value;
}

export async function fillOwnerHash(owner: string): Promise<string> {
  if (!uuid.test(owner)) throw new ApiError(403, 'FILL_SESSION_ACCOUNT_MISMATCH');
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(owner)))].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export function validateFillGrant(value: unknown, now: number): FillGrant {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError(400, 'FILL_SESSION_BOUND_GRANT_REQUIRED');
  const grant = value as Record<string, unknown>;
  const required = ['protocol', 'grantId', 'userIdHash', 'applicationId', 'fieldIds', 'issuedAt', 'expiresAt', 'nonce'];
  if (Object.keys(grant).some(key => ![...required, 'schoolId', 'departmentId'].includes(key))
    || required.some(key => key !== 'fieldIds' && typeof grant[key] !== 'string')
    || grant.protocol !== FILL_GRANT_PROTOCOL || !boundId.test(String(grant.grantId)) || !boundId.test(String(grant.nonce))
    || !/^[a-f0-9]{64}$/.test(String(grant.userIdHash)) || !uuid.test(String(grant.applicationId))
    || !Array.isArray(grant.fieldIds) || grant.fieldIds.length < 1 || grant.fieldIds.length > 10
    || grant.fieldIds.some(id => typeof id !== 'string' || !fieldIds.has(id)) || new Set(grant.fieldIds).size !== grant.fieldIds.length
    || ['schoolId', 'departmentId'].some(key => key in grant && (typeof grant[key] !== 'string' || !boundId.test(grant[key] as string)))) {
    throw new ApiError(400, 'FILL_SESSION_INVALID_GRANT');
  }
  const issued = Date.parse(String(grant.issuedAt)), expires = Date.parse(String(grant.expiresAt));
  if (!Number.isFinite(issued) || !Number.isFinite(expires)
    || new Date(issued).toISOString() !== grant.issuedAt || new Date(expires).toISOString() !== grant.expiresAt
    || issued > now + 30_000 || expires <= issued || expires - issued > FILL_GRANT_TTL_MS || expires > now + FILL_GRANT_TTL_MS) {
    throw new ApiError(400, 'FILL_SESSION_INVALID_GRANT');
  }
  if (expires <= now) throw new ApiError(410, 'FILL_SESSION_EXPIRED');
  // Canonical property order makes persistence and comparisons independent of
  // caller JSON key order. Field order remains part of the immutable grant.
  return {
    protocol: FILL_GRANT_PROTOCOL, grantId: grant.grantId as string, userIdHash: grant.userIdHash as string,
    applicationId: grant.applicationId as string,
    ...(grant.schoolId === undefined ? {} : { schoolId: grant.schoolId as string }),
    ...(grant.departmentId === undefined ? {} : { departmentId: grant.departmentId as string }),
    fieldIds: [...grant.fieldIds] as string[], issuedAt: grant.issuedAt as string, expiresAt: grant.expiresAt as string, nonce: grant.nonce as string
  };
}

export async function validateOwnedFillGrant(owner: string, value: unknown, now: number) {
  const grant = validateFillGrant(value, now);
  if (grant.userIdHash !== await fillOwnerHash(owner)) throw new ApiError(403, 'FILL_SESSION_ACCOUNT_MISMATCH');
  return grant;
}
