/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_IMAGE_SERVICE_URL?: string;
  readonly VITE_IMAGE_SERVICE_TYPE?: string;
  readonly VITE_ENABLE_IMAGE_SERVICE?: string;
  readonly VITE_UMAMI_SCRIPT_URL?: string;
  readonly VITE_UMAMI_WEBSITE_ID?: string;
  readonly VITE_UMAMI_DOMAINS?: string;
  readonly VITE_UMAMI_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
