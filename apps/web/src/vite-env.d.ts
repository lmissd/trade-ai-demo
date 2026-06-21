/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CUSTOMER_MODE?: string;
  readonly VITE_CUSTOMER_AI_PROVIDER?: string;
  readonly VITE_CUSTOMER_AI_MODEL?: string;
  readonly VITE_CUSTOMER_AI_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
