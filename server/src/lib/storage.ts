import { mkdirSync } from 'node:fs';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { v2 as cloudinary } from 'cloudinary';
import { env, isProd } from '../env.js';

// Product photo storage. Production uses Cloudinary; development without Cloudinary keys stores
// files in ./data/uploads and serves them at /uploads/* so the dashboard works offline.

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

const useCloudinary = Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
if (useCloudinary) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
} else if (isProd) {
  // eslint-disable-next-line no-console
  console.error('Cloudinary keys are required in production for product photos.');
  process.exit(1);
}

export const LOCAL_UPLOAD_DIR = resolve('data/uploads');
if (!useCloudinary) mkdirSync(LOCAL_UPLOAD_DIR, { recursive: true });

export type StoredImage = { url: string; publicId: string };

/** Checks the real file signature, not just the declared type, so renamed files are rejected. */
export function detectImageType(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  const riff = String.fromCharCode(...bytes.slice(0, 4));
  const webp = String.fromCharCode(...bytes.slice(8, 12));
  if (riff === 'RIFF' && webp === 'WEBP') return 'image/webp';
  return null;
}

export const isAllowedImageType = (type: string) => type in ALLOWED;

export async function storeProductImage(bytes: Uint8Array, type: string): Promise<StoredImage> {
  if (useCloudinary) {
    const result = await new Promise<{ secure_url: string; public_id: string }>((resolvePromise, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'lovenest/products',
          resource_type: 'image',
          // Normalise on upload: max 1600px, auto format and quality on delivery.
          transformation: [{ width: 1600, height: 1600, crop: 'limit' }],
        },
        (error, res) => (error || !res ? reject(error ?? new Error('Upload failed')) : resolvePromise(res)),
      );
      stream.end(Buffer.from(bytes));
    });
    // f_auto,q_auto: Cloudinary serves WebP/AVIF at a sensible quality to save mobile data.
    const url = result.secure_url.replace('/image/upload/', '/image/upload/f_auto,q_auto/');
    return { url, publicId: result.public_id };
  }

  await mkdir(LOCAL_UPLOAD_DIR, { recursive: true });
  const name = `${crypto.randomUUID()}.${ALLOWED[type]}`;
  await writeFile(join(LOCAL_UPLOAD_DIR, name), bytes);
  return { url: `${env.BETTER_AUTH_URL}/uploads/${name}`, publicId: `local:${name}` };
}

export async function deleteProductImage(publicId: string | null | undefined) {
  if (!publicId) return;
  try {
    if (publicId.startsWith('local:')) {
      await unlink(join(LOCAL_UPLOAD_DIR, publicId.slice('local:'.length)));
    } else if (useCloudinary) {
      await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
    }
  } catch {
    // A missing old photo must never block saving or deleting a product.
  }
}
