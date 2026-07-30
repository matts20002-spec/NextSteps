// One-time, DEV-ONLY script that generates the app's four illustrations via
// the OpenAI Images API and saves them into src/assets/illustrations/.
//
// This is NOT part of the running app or the Docker build -- it's a build
// step a developer runs once (or re-runs to regenerate an image), and the
// resulting files get committed to the repo like any other static asset.
// Nobody needs an OpenAI API key to build or deploy the app itself; the
// Illustration component (src/components/Illustration.jsx) falls back to a
// plain icon for any image that doesn't exist yet.
//
// Usage:
//   OPENAI_API_KEY=sk-... node scripts/generate-illustrations.js
//
// Uses Node's built-in fetch (Node 18+) -- no extra dependency needed for
// a script this small. Written as ESM since client/package.json sets
// "type": "module".
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, '..', 'src', 'assets', 'illustrations');

// Same style prefix on every prompt so the four images read as one set.
const STYLE_PREFIX =
  'Flat vector illustration, professional corporate style, blue and teal color palette (#1B4965, #5FA8A0), ' +
  'clean geometric shapes, minimal detail, no text or letters in the image, plenty of negative space, ' +
  'subtle and trustworthy tone';

const ILLUSTRATIONS = [
  {
    filename: 'hero-job-browse.png',
    prompt: `${STYLE_PREFIX}, a diverse group of professionals reviewing documents at a modern desk, subtle sense of opportunity and career growth`,
  },
  {
    filename: 'empty-admin-jobs.png',
    prompt: `${STYLE_PREFIX}, an empty open folder or inbox, calm and neutral, inviting first action`,
  },
  {
    filename: 'empty-student-applications.png',
    prompt: `${STYLE_PREFIX}, a single document or paper airplane mid-flight toward a target, sense of anticipation`,
  },
  {
    filename: 'auth-gateway.png',
    prompt: `${STYLE_PREFIX}, a simple door or gateway opening onto a bright path, welcoming and secure feeling`,
  },
];

// gpt-image-1 is preferred (better instruction following); set
// OPENAI_IMAGE_MODEL=dall-e-3 to use that instead if gpt-image-1 isn't
// available on your account.
const MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';

async function generateImage({ filename, prompt }) {
  const isGptImage = MODEL.startsWith('gpt-image');

  const body = {
    model: MODEL,
    prompt,
    size: '1024x1024',
    n: 1,
  };
  // gpt-image-1 always returns base64 and rejects the response_format
  // param; dall-e-3 needs it explicitly to return base64 instead of a URL.
  if (!isGptImage) {
    body.response_format = 'b64_json';
  }

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error(`No image data returned for "${filename}"`);
  }

  const outputPath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(outputPath, Buffer.from(b64, 'base64'));
  console.log(`Saved ${path.relative(process.cwd(), outputPath)}`);
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is not set. Export it temporarily and re-run this script, e.g.:');
    console.error('  OPENAI_API_KEY=sk-... node scripts/generate-illustrations.js');
    process.exitCode = 1;
    return;
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  for (const illustration of ILLUSTRATIONS) {
    console.log(`Generating ${illustration.filename}...`);
    await generateImage(illustration);
  }

  console.log('Done. Commit the generated files in src/assets/illustrations/.');
}

main().catch((err) => {
  console.error('Failed to generate illustrations:', err.message);
  process.exitCode = 1;
});
