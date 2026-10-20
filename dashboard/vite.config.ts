import { defineConfig } from 'vite';
export default defineConfig({ base: './', envDir: process.env.HARNESS_DASHBOARD_ENV_DIR ?? '/__harness_dashboard_no_env__', build: { sourcemap: false, manifest: false } });
