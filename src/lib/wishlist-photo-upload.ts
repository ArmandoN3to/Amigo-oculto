import "server-only";
import sharp from "sharp";
import { AppError } from "./errors";
import { WISHLIST_PHOTO_MAX_BYTES, WISHLIST_PHOTO_TOO_LARGE } from "./wishlist";

export async function readWishlistPhoto(file: FormDataEntryValue): Promise<Buffer> {
  const invalidPhoto = "Escolha uma foto válida em JPG, PNG ou WebP.";
  if (!(file instanceof File) || !file.size) throw new AppError(invalidPhoto);
  if (file.size > WISHLIST_PHOTO_MAX_BYTES) throw new AppError(WISHLIST_PHOTO_TOO_LARGE);

  let content: Buffer;
  try {
    const image = sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 40_000_000 });
    const { format } = await image.metadata();
    if (format !== "jpeg" && format !== "png" && format !== "webp") throw new AppError(invalidPhoto);
    content = await image.autoOrient()
      .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw new AppError(invalidPhoto);
  }
  if (content.length > WISHLIST_PHOTO_MAX_BYTES) throw new AppError(WISHLIST_PHOTO_TOO_LARGE);
  return content;
}
