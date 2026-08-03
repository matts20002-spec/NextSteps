// Renders one of the app's four generated illustrations, or a lucide-react
// icon placeholder if it hasn't been generated yet.
//
// Illustrations are produced by a one-time, dev-only script
// (client/scripts/generate-illustrations.js) that calls the OpenAI Images
// API and writes files into src/assets/illustrations/. That script is NOT
// part of the running app, so this component has to work whether or not
// those files exist -- import.meta.glob lets Vite discover whatever's
// actually in the folder at build time instead of statically importing a
// file that might not exist.
const generatedImages = import.meta.glob('../assets/illustrations/*.{png,webp,jpg,jpeg}', {
  eager: true,
  import: 'default',
});

function findImage(name) {
  const match = Object.keys(generatedImages).find((path) => path.includes(name));
  return match ? generatedImages[match] : null;
}

/**
 * @param {string} name - filename (without extension) to look for in
 *   src/assets/illustrations/, e.g. "hero-job-browse"
 * @param {string} alt - accessible description
 * @param {React.ComponentType} fallbackIcon - lucide-react icon component
 *   shown when the real illustration hasn't been generated yet
 * @param {string} className - extra class, e.g. for sizing per-context
 */
export default function Illustration({ name, alt, fallbackIcon: FallbackIcon, className = '' }) {
  const src = findImage(name);

  if (src) {
    return <img src={src} alt={alt} className={`illustration ${className}`} />;
  }

  return (
    <div className={`illustration-placeholder ${className}`} role="img" aria-label={alt}>
      <FallbackIcon size={56} strokeWidth={1.5} />
    </div>
  );
}
