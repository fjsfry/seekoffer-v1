import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  canMigrateLegacyApplicationItems,
  canMigrateLegacyManualProjectItems,
  getWorkspaceStorageKeys,
  getWorkspaceStorageOwner
} from '@/lib/cloudbase-data';

const projectRoot = resolve(import.meta.dirname, '..');

describe('workspace storage ownership', () => {
  it('partitions application and manual-project caches by formal account user id', () => {
    const firstAccount = {
      loggedIn: true,
      authProvider: 'password' as const,
      userId: 'member-a'
    };
    const secondAccount = {
      loggedIn: true,
      authProvider: 'otp' as const,
      userId: 'member-b'
    };

    expect(getWorkspaceStorageOwner(firstAccount)).toEqual({
      kind: 'member',
      userId: 'member-a'
    });
    expect(getWorkspaceStorageKeys(firstAccount)).toEqual({
      owner: { kind: 'member', userId: 'member-a' },
      applications: 'seekoffer-my-application-table:member-a',
      manualProjects: 'seekoffer-manual-projects:member-a'
    });
    expect(getWorkspaceStorageKeys(secondAccount)).toEqual({
      owner: { kind: 'member', userId: 'member-b' },
      applications: 'seekoffer-my-application-table:member-b',
      manualProjects: 'seekoffer-manual-projects:member-b'
    });
    expect(getWorkspaceStorageKeys(firstAccount).applications).not.toBe(
      getWorkspaceStorageKeys(secondAccount).applications
    );
  });

  it('keeps anonymous and signed-out storage outside formal-account partitions', () => {
    expect(
      getWorkspaceStorageKeys({
        loggedIn: true,
        authProvider: 'anonymous',
        userId: 'anonymous-session-id'
      })
    ).toEqual({
      owner: { kind: 'anonymous' },
      applications: 'seekoffer-my-application-table:anonymous',
      manualProjects: 'seekoffer-manual-projects:anonymous'
    });
    expect(getWorkspaceStorageKeys(null)).toEqual({
      owner: { kind: 'local' },
      applications: 'seekoffer-my-application-table:local',
      manualProjects: 'seekoffer-manual-projects:local'
    });
  });

  it('migrates a legacy application cache only when every record belongs to the account', () => {
    const ownedItems = [
      { userProjectId: 'application-a', projectId: 'project-a', userId: 'member-a' },
      { userProjectId: 'application-b', projectId: 'project-b', userId: ' member-a ' }
    ];

    expect(canMigrateLegacyApplicationItems(ownedItems, 'member-a')).toBe(true);
    expect(
      canMigrateLegacyApplicationItems(
        [...ownedItems, { userProjectId: 'application-c', projectId: 'project-c', userId: 'member-b' }],
        'member-a'
      )
    ).toBe(false);
    expect(
      canMigrateLegacyApplicationItems(
        [{ userProjectId: 'application-c', projectId: 'project-c' }],
        'member-a'
      )
    ).toBe(false);
    expect(canMigrateLegacyApplicationItems([], 'member-a')).toBe(false);
    expect(canMigrateLegacyApplicationItems(ownedItems, '')).toBe(false);
  });

  it('migrates legacy manual projects only when owned applications reference every project', () => {
    const ownedApplications = [
      { projectId: 'manual-a', userId: 'member-a' },
      { projectId: 'manual-b', userId: 'member-a' }
    ];

    expect(
      canMigrateLegacyManualProjectItems(
        [{ id: 'manual-a' }, { id: 'manual-b' }],
        ownedApplications,
        'member-a'
      )
    ).toBe(true);
    expect(
      canMigrateLegacyManualProjectItems(
        [{ id: 'manual-a' }, { id: 'not-owned' }],
        ownedApplications,
        'member-a'
      )
    ).toBe(false);
    expect(
      canMigrateLegacyManualProjectItems(
        [{ id: 'manual-a' }],
        [{ projectId: 'manual-a', userId: 'member-b' }],
        'member-a'
      )
    ).toBe(false);
  });

  it('validates the payload owner and record owner again when reading and writing scoped caches', async () => {
    const source = await readFile(resolve(projectRoot, 'lib/cloudbase-data.ts'), 'utf8');

    expect(source).toContain('version: WORKSPACE_STORAGE_VERSION');
    expect(source).toContain('owner,');
    expect(source).toContain(
      'if (scopedPayload && !workspaceStorageOwnersMatch(scopedPayload.owner, context.owner))'
    );
    expect(
      source.match(
        /if \(scopedPayload && !workspaceStorageOwnersMatch\(scopedPayload\.owner, context\.owner\)\)/g
      )
    ).toHaveLength(2);
    expect(source).toContain('.filter((item) => item.userId === expectedUserId)');
    expect(source).toContain(
      'persistStoragePayload(context.applications, context.owner, ownedRecords, updatedAt)'
    );
  });
});
