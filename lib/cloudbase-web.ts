'use client';

import cloudbase from '@cloudbase/js-sdk/app';
import { registerAuth } from '@cloudbase/js-sdk/auth';
import { registerDatabase } from '@cloudbase/js-sdk/database';
import { CLOUDBASE_ENV_ID, CLOUDBASE_PUBLISHABLE_KEY, CLOUDBASE_REGION } from './cloudbase-env';

registerAuth(cloudbase as any);
registerDatabase(cloudbase as any);

type CloudbaseApp = ReturnType<typeof cloudbase.init>;

let appPromise: Promise<CloudbaseApp> | null = null;

async function initCloudbaseApp() {
  if (!CLOUDBASE_PUBLISHABLE_KEY) {
    throw new Error('CloudBase 网页端登录配置缺失：未设置 Publishable Key。');
  }

  const app = cloudbase.init({
    env: CLOUDBASE_ENV_ID,
    region: CLOUDBASE_REGION,
    accessKey: CLOUDBASE_PUBLISHABLE_KEY,
    auth: {
      detectSessionInUrl: true
    }
  });

  const auth = app.auth({ persistence: 'local' });
  const loginState = await auth.getLoginState();

  if (!loginState) {
    try {
      await auth.anonymousAuthProvider().signIn();
    } catch (error) {
      console.error('[Seekoffer][cloudbase] anonymous bootstrap failed', error);
    }
  }

  return app;
}

export async function getCloudbaseApp() {
  if (typeof window === 'undefined') {
    throw new Error('CloudBase Web SDK 只能在浏览器端初始化。');
  }

  if (!appPromise) {
    appPromise = initCloudbaseApp();
  }

  return appPromise;
}
