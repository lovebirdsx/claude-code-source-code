// Global compile-time macros (normally injected by Bun bundler)
declare const MACRO: {
  VERSION: string
  BUILD_TIME: string
  FEEDBACK_CHANNEL: string
  ISSUES_EXPLAINER: string
  NATIVE_PACKAGE_URL: string
  PACKAGE_URL: string
  VERSION_CHANGELOG: string
}

declare const Bun: {
  gc: () => void;
}

declare const getAntModelOverrideConfig: () => any;

// react-compiler.d.ts
declare module 'react/compiler-runtime' {
  /**
   * React Compiler 内部使用的缓存 Hook
   * @param size 需要分配的缓存槽位数量
   */
  export function c(size: number): any[];
}
