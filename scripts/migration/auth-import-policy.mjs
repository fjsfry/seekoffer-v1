// Pure checks shared by the private orchestrator; never return hashes in receipts.
export function verifyImportedUser(source,target,{allowTargetUpgrade=false}={}){
 if(target.external_id!==source.body.external_id||typeof target.id!=='string'||!target.id.startsWith('user_')||!target.password_enabled)throw Error('IMPORTED_IDENTITY_MISMATCH');
 const email=target.email_addresses?.find(e=>e.email_address.toLowerCase()===source.body.email_address[0].toLowerCase());
 if(!email)throw Error('IMPORTED_EMAIL_MISMATCH');
 const verified=email.verification?.status==='verified',expected=source.body.email_address_identification_status[0]==='verified';
 if(expected&&!verified||!expected&&verified&&!allowTargetUpgrade)throw Error('IMPORTED_EMAIL_STATE_MISMATCH');
 if(source.body.banned&&!target.banned)throw Error('IMPORTED_BAN_MISMATCH');
 return {clerkUserId:target.id,passwordUpdateForbidden:true};
}
