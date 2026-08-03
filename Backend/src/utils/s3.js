// Helpers for storing and retrieving résumé files in S3.
//
// We never proxy file bytes through our own server for the download link --
// we generate a short-lived "presigned URL" that lets the browser talk to
// S3 directly. This is a common AWS pattern: it keeps large file transfers
// off your application server entirely.
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');

// No access key / secret key here on purpose -- in AWS this picks up
// credentials automatically from the ECS task's IAM role (the "default
// credential provider chain"). Locally, it falls back to your AWS CLI
// profile or LocalStack, depending on how you've configured the SDK.
const s3 = new S3Client({ region: process.env.AWS_REGION });

const BUCKET = process.env.S3_BUCKET_NAME;

/**
 * Generates a temporary S3 PUT URL the browser can upload a résumé to
 * directly, without the file ever passing through our own server (or
 * CloudFront's API origin, which has its own limits on proxied POST body
 * size). Returns the key the caller should hang onto and store on the
 * application record once the upload succeeds.
 *
 * When contentType is provided it's baked into the presigned command, so
 * the object is stored in S3 with that Content-Type (useful when it's
 * later downloaded) -- callers should still send the same Content-Type
 * header on the actual PUT so the stored metadata matches what the file
 * actually is.
 */
async function getResumeUploadUrl(userId, originalFilename, contentType, expiresInSeconds = 300) {
  const uniqueSuffix = crypto.randomUUID();
  const key = `resumes/${userId}/${uniqueSuffix}-${originalFilename}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ...(contentType ? { ContentType: contentType } : {}),
  });

  const url = await getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
  return { url, key };
}

/**
 * Generates a temporary download link for a résumé stored at `key`.
 * The link expires after `expiresInSeconds` so it can't be shared forever.
 */
async function getResumeDownloadUrl(key, expiresInSeconds = 300) {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
}

module.exports = { getResumeUploadUrl, getResumeDownloadUrl };
