/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional absolute API URL; defaults to /api, which the dev server proxies. */
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
