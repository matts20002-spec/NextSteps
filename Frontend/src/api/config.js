// Single place that resolves the API base URL, so it never needs to be
// hardcoded or duplicated across components. Checked in order:
//
// 1. window.APP_CONFIG.API_URL (client/public/config.js) -- a runtime
//    override that can be edited directly on already-deployed static
//    content, no rebuild needed. Left empty by default.
// 2. VITE_API_URL -- baked in at build time (see client/Dockerfile and the
//    README). Used for production (S3 + CloudFront) when no runtime
//    override is set.
// 3. The relative '/api' path -- local dev (Vite dev server proxy) and
//    local Docker Compose (nginx reverse proxy), where there's no separate
//    public backend URL to point at.
export const API_BASE = window.APP_CONFIG?.API_URL || import.meta.env.VITE_API_URL || '/api';
