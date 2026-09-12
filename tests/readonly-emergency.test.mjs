import { describe, expect, it } from 'vitest';
import { publicEmergencyRow } from '../scripts/build-readonly-emergency.mjs';
describe('reviewed emergency export boundary', () => {
  const row = { id:'n-1', is_private:false, admin_status:'published', admin_deleted_at:null, projectName:'<script>alert(1)</script>', requirements:'<img onerror=alert(1)>', sourceLink:'javascript:alert(1)', user_id:'private-sentinel', admin_review_note:'internal-sentinel', encrypted_password:'synthetic-hash-sentinel', schoolName:'北京大学' };
  it('removes internal fields and executable URLs while leaving text to textContent rendering', () => {
    const result=publicEmergencyRow(row);
    expect(result.sourceLink).toBe('');
    expect(result.projectName).toBe(row.projectName);
    expect(JSON.stringify(result)).not.toMatch(/sentinel|admin_review_note|encrypted_password/);
  });
  it.each([{is_private:true},{admin_status:'pending'},{admin_deleted_at:'2026-09-01'},{is_private:undefined}])('rejects nonpublic or unproven publication state %j', patch => {
    expect(publicEmergencyRow({...row,...patch})).toBeNull();
  });
  it('rejects path traversal IDs',()=>expect(()=>publicEmergencyRow({...row,id:'../orders'})).toThrow('INVALID_PUBLIC_ID'));
});
