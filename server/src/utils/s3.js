// Helpers for storing and retrieving résumé files in S3.
//
// We never proxy file bytes through our own server for the download link --
// we generate a short-lived "presigned URL" that lets the browser talk to
// S3 directly. This is a common AWS pattern worth teaching: it keeps large
// file transfers off your application server entirely.
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
 * Uploads a résumé buffer to S3 under a unique key and returns that key.
 * The key (not the file itself) is what we store in the `applications` table.
 */
async function uploadResume(userId, originalFilename, buffer, mimeType) {
  const uniqueSuffix = crypto.randomUUID();
  const key = `resumes/${userId}/${uniqueSuffix}-${originalFilename}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    })
  );

  return key;
}

/**
 * Generates a temporary download link for a résumé stored at `key`.
 * The link expires after `expiresInSeconds` so it can't be shared forever.
 */
async function getResumeDownloadUrl(key, expiresInSeconds = 300) {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
}

module.exports = { uploadResume, getResumeDownloadUrl };
