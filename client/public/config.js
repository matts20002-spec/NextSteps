// Runtime override for the API base URL. Vite copies this file as-is into
// the build output root, alongside index.html, so it can be edited
// directly on the deployed static content (e.g. in the S3 bucket or
// CloudFront origin) to change the backend URL without a rebuild.
//
// Left empty by default -- do not commit a real value here. When empty,
// client/src/api/config.js falls through to the build-time VITE_API_URL,
// then to the relative '/api' path.
window.APP_CONFIG = {
  API_URL: '',
};
