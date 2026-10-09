'use client';

const DEFAULT_CLERK_ISSUER = 'https://clerk.seekoffer.com.cn';
// Clerk publishable keys are designed to be present in browser code. Keeping a
// safe production fallback prevents a missing Worker var from breaking login.
const DEFAULT_CLERK_PUBLISHABLE_KEY = 'pk_live_Y2xlcmsuc2Vla29mZmVyLmNvbS5jbiQ';

export type ClerkUser = {
  id: string;
  primaryEmailAddressId?: string | null;
  emailAddresses?: Array<{ id: string; emailAddress?: string | null }>;
  phoneNumbers?: Array<{ phoneNumber?: string | null }>;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  publicMetadata?: Record<string, unknown>;
};

type ClerkVerification = {
  status?: string;
};

type ClerkSignIn = {
  status?: string;
  createdSessionId?: string | null;
  firstFactorVerification?: ClerkVerification;
  secondFactorVerification?: ClerkVerification;
  create(input: Record<string, unknown>): Promise<ClerkSignIn>;
  prepareFirstFactor(input: Record<string, unknown>): Promise<ClerkSignIn>;
  attemptFirstFactor(input: Record<string, unknown>): Promise<ClerkSignIn>;
  resetFactorVerification?(): Promise<ClerkSignIn>;
};

type ClerkSignUp = {
  status?: string;
  createdSessionId?: string | null;
  verifications?: { emailAddress?: ClerkVerification };
  create(input: Record<string, unknown>): Promise<ClerkSignUp>;
  prepareEmailAddressVerification(input: Record<string, unknown>): Promise<ClerkSignUp>;
  attemptEmailAddressVerification(input: Record<string, unknown>): Promise<ClerkSignUp>;
};

export type ClerkSession = {
  id?: string;
  user?: ClerkUser;
  getToken(options?: Record<string, unknown>): Promise<string | null>;
};

export type ClerkInstance = {
  user: ClerkUser | null;
  session: ClerkSession | null;
  client: { signIn: ClerkSignIn; signUp: ClerkSignUp };
  load(): Promise<void>;
  setActive(input: { session: string }): Promise<void>;
  signOut(): Promise<void>;
  addListener?(callback: (payload: { session: ClerkSession | null; user: ClerkUser | null }) => void): () => void;
};

declare global {
  interface Window {
    Clerk?: ClerkInstance;
  }
}

export function clerkIssuer() {
  return (process.env.NEXT_PUBLIC_CLERK_ISSUER || DEFAULT_CLERK_ISSUER).replace(/\/$/, '');
}

export function clerkPublishableKey() {
  return process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || DEFAULT_CLERK_PUBLISHABLE_KEY;
}

let clerkPromise: Promise<ClerkInstance> | null = null;

function loadClerkScript() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('认证服务只能在浏览器中初始化。'));
  }

  if (window.Clerk) {
    return Promise.resolve(window.Clerk);
  }

  return new Promise<ClerkInstance>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-seekoffer-clerk]');
    const script = existing || document.createElement('script');
    const finish = () => {
      if (window.Clerk) resolve(window.Clerk);
      else reject(new Error('认证脚本加载完成，但 Clerk 未初始化。'));
    };

    script.addEventListener('load', finish, { once: true });
    script.addEventListener('error', () => reject(new Error('认证服务加载失败，请检查网络后重试。')), { once: true });
    if (!existing) {
      script.src = `${clerkIssuer()}/npm/@clerk/clerk-js@6.31.0/dist/clerk.browser.js`;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.dataset.seekofferClerk = 'true';
      script.setAttribute('data-clerk-publishable-key', clerkPublishableKey());
      document.head.appendChild(script);
    }
  });
}

export async function getClerk() {
  if (!clerkPromise) {
    clerkPromise = loadClerkScript()
      .then(async (clerk) => {
        await clerk.load();
        return clerk;
      })
      .catch((error) => {
        clerkPromise = null;
        throw error;
      });
  }

  return clerkPromise;
}

export async function getClerkToken() {
  const clerk = await getClerk();
  return clerk.session?.getToken() || null;
}

export function clerkErrorMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : '';
  if (/identifier|password|email|verification|code|credential|account|sign.?in|sign.?up/i.test(message)) {
    return '邮箱、密码或验证码不正确，请检查后重试。';
  }
  return message && /[\u3400-\u9fff]/.test(message) ? message : fallback;
}
