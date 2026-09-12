import { SOURCE_REFS } from './transform.mjs';
// Pure transformation: no SDK client, network, user creation or mail sending.
export function clerkIdentityPlan(projectRef, user) {
  if(!SOURCE_REFS.includes(projectRef))throw new Error('SOURCE_SCOPE_VIOLATION');
  if(!user.id||!user.email)throw new Error('IDENTITY_REQUIRES_MANUAL_REVIEW');
  if(user.mfaFactors?.length)throw new Error('MFA_PRODUCTION_COMPATIBILITY_REQUIRED');
  if(!/^\$2[aby]\$\d\d\$/.test(user.encrypted_password||''))throw new Error('PASSWORD_HASH_IMPORT_NOT_VALIDATED');
  return {
    externalId:projectRef+':'+user.id,
    emailAddress:[user.email],
    emailAddressIdentificationStatus:[user.email_confirmed_at?'verified':'reserved'],
    passwordDigest:user.encrypted_password,passwordHasher:'bcrypt',
    banned:Boolean(user.banned_until&&Date.parse(user.banned_until)>Date.now())
  };
}
