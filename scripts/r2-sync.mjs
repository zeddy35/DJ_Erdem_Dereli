// scripts/r2-sync.mjs
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fg from "fast-glob";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mime from "mime";
import "dotenv/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, "..");

// Yereldeki kaynak klasör (senin projendeki)
const LOCAL_DIR = path.join(ROOT, "public", "images", "gallery");

// .env’den değerleri al
const {
  CF_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET,
  DRY_RUN, // opsiyonel: "1" yaparsan sadece listeler
} = process.env;

if (!CF_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
  console.error("Eksik .env! Gerekli: CF_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET");
  process.exit(1);
}

// S3 uyumlu R2 istemcisi
const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true, // R2 için iyi olur
});

// LOCAL_DIR altındaki tüm dosyaları topla
const files = await fg("**/*.*", { cwd: LOCAL_DIR, onlyFiles: true });

if (!files.length) {
  console.log("Yüklenecek dosya yok:", LOCAL_DIR);
  process.exit(0);
}

console.log(`Yüklenecek dosya sayısı: ${files.length}`);

for (const rel of files) {
  const abs = path.join(LOCAL_DIR, rel);
  const Body = fs.createReadStream(abs);

  // R2 key yapısı: images/gallery/<slug>/<dosya>
  const Key = `images/gallery/${rel.replace(/\\/g, "/")}`;

  const ContentType = mime.getType(abs) || "application/octet-stream";
  const CacheControl = "public, max-age=31536000, immutable"; // 1 yıl cache

  if (DRY_RUN) {
    console.log("[DRY] atlanıyor:", Key);
    continue;
  }

  await s3.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key,
      Body,
      ContentType,
      CacheControl,
    })
  );

  console.log("✓ Yüklendi:", Key);
}

console.log("Bitti!");
