declare module 'seekoffer-build-surface' {
  export const buildSurfaceDocument: Readonly<{
    className: string | undefined;
    suppressHydrationWarning: boolean;
  }>;

  export function BuildSurface(
    props: Readonly<{ children: import('react').ReactNode }>
  ): import('react').ReactNode;
}
