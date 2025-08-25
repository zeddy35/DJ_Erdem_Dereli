import {
  S3Client,
  ListObjectsV2Command,
  CopyObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import path from "path";
import "dotenv/config";

const { CF_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
const DRY = process.argv.includes("--dry");

if (!CF_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
  console.error("Missing env: CF_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY");
  process.exit(1);
}

const IMG_EXT = new Set([".jpg",".jpeg",".png",".webp",".gif",".svg",".avif"]);
const VID_EXT = new Set([".mp4",".webm",".mov",".m4v"]);

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
  forcePathStyle: true,
});

let moved = 0, skipped = 0;

async function moveOne(key, newKey) {
  if (DRY) {
    console.log(`[DRY] ${key}  ->  ${newKey}`);
    return;
  }
  const CopySource = `${R2_BUCKET}/${encodeURI(key)}`; // slashes korunmalı
  await s3.send(new CopyObjectCommand({ Bucket: R2_BUCKET, Key: newKey, CopySource }));
  await s3.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
  console.log(`✓ moved: ${key}  ->  ${newKey}`);
  moved++;
}

async function run() {
  console.log("== scan bucket ==");
  let ContinuationToken;
  do {
    const resp = await s3.send(new ListObjectsV2Command({ Bucket: R2_BUCKET, ContinuationToken }));
    for (const obj of resp.Contents || []) {
      const key = obj.Key;
      if (!key) continue;

      // Zaten doğru prefix ise geç
      if (key.startsWith("images/") || key.startsWith("videos/")) { skipped++; continue; }

      const ext = path.extname(key).toLowerCase();
      if (IMG_EXT.has(ext)) {
        await moveOne(key, `images/${key}`);
      } else if (VID_EXT.has(ext)) {
        await moveOne(key, `videos/${key}`);
      } else {
        // klasör placeholder’ı ya da farklı tür – dokunma
        skipped++;
      }
    }
    ContinuationToken = resp.IsTruncated ? resp.NextContinuationToken : undefined;
  } while (ContinuationToken);

  console.log(DRY ? "DRY RUN done." : `done. moved=${moved}, skipped=${skipped}`);
}

run().catch(e => { console.error(e); process.exit(1); });
