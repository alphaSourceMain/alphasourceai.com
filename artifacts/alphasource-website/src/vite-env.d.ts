/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LINKEDIN_PARTNER_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
