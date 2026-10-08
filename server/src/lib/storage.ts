import { eq } from 'drizzle-orm';
import { v2 as cloudinary } from 'cloudinary';
import { db } from '../db/client.js';
import { image } from '../db/schema.js';
import { env } from '../env.js';

// Product photo storage.
//
// Default: photos live in the LoveNest database (Turso) and are served by this API at
// /images/:id. Cloudinary is not available in Zimbabwe, so this needs no extra account.
// The admin dashboard shrinks photos to about 1600px JPEG before upload, so each is ~200-400 KB.
//
// Optional: if Cloudinary keys are set, photos go to Cloudinary instead.

/** Largest photo accepted for upload. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
/** Largest photo stored in the database (the dashboard compresses well below this). */
export const MAX_DB_IMAGE_BYTES = 2 * 1024 * 1024;

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

const useCloudinary = Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
if (useCloudinary) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export const imageStorageMode = useCloudinary ? 'cloudinary' : 'database';

export type StoredImage = { url: string; publicId: string };

export class ImageTooLargeError extends Error {}

/** Checks the real file signature, not just the declared type, so renamed files are rejected. */
export function detectImageType(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  const riff = String.fromCharCode(...bytes.slice(0, 4));
  const webp = String.fromCharCode(...bytes.slice(8, 12));
  if (riff === 'RIFF' && webp === 'WEBP') return 'image/webp';
  return null;
}

export const isAllowedImageType = (type: string) => ALLOWED.has(type);

/**
 * Saves a product photo. Database photos get a relative URL (/images/<id>) so they work from
 * any address the API is reached at; the app and dashboard resolve it against the API URL.
 */
export async function storeProductImage(bytes: Uint8Array, type: string): Promise<StoredImage> {
  if (useCloudinary) {
    const result = await new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'lovenest/products', resource_type: 'image', transformation: [{ width: 1600, height: 1600, crop: 'limit' }] },
        (error, res) => (error || !res ? reject(error ?? new Error('Upload failed')) : resolve(res)),
      );
      stream.end(Buffer.from(bytes));
    });
    return { url: result.secure_url.replace('/image/upload/', '/image/upload/f_auto,q_auto/'), publicId: result.public_id };
  }

  if (bytes.byteLength > MAX_DB_IMAGE_BYTES) throw new ImageTooLargeError('This photo is larger than 2 MB. Use a smaller photo.');
  const [row] = await db
    .insert(image)
    .values({ contentType: type, size: bytes.byteLength, data: Buffer.from(bytes) })
    .returning({ id: image.id });
  return { url: `/images/${row!.id}`, publicId: `db:${row!.id}` };
}

export async function deleteProductImage(publicId: string | null | undefined) {
  if (!publicId) return;
  try {
    if (publicId.startsWith('db:')) {
      await db.delete(image).where(eq(image.id, publicId.slice(3)));
    } else if (useCloudinary) {
      await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
    }
  } catch {
    // A missing old photo must never block saving or deleting a product.
  }
}

export async function loadImage(id: string) {
  const [row] = await db.select().from(image).where(eq(image.id, id));
  return row ?? null;
}
