const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cloudinary = require('cloudinary').v2;

const FALLBACK_DIR = path.resolve(__dirname, '../../uploads');

if (!fs.existsSync(FALLBACK_DIR)) {
  fs.mkdirSync(FALLBACK_DIR, { recursive: true });
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function isCloudinaryConfigured() {
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

function detectImageType(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 && buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a) {
    return 'image/png';
  }
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) {
    return 'image/webp';
  }
  return null;
}

async function uploadImage(buffer) {
  const mime = detectImageType(buffer);
  if (!mime) {
    const error = new Error('Unsupported image type. Use JPEG, PNG, or WebP only.');
    error.statusCode = 400;
    throw error;
  }

  const randomName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;

  if (isCloudinaryConfigured()) {
    const result = await cloudinary.uploader.upload(`data:${mime};base64,${buffer.toString('base64')}`, {
      public_id: randomName,
      folder: 'campusloop',
      resource_type: 'image',
    });

    return {
      url: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
    };
  }

  const extension = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
  const fileName = `${randomName}.${extension}`;
  const filePath = path.join(FALLBACK_DIR, fileName);

  await fs.promises.writeFile(filePath, buffer);

  return {
    url: `/uploads/${fileName}`,
    publicId: fileName,
    width: 0,
    height: 0,
  };
}

async function deleteImage(publicId) {
  if (!publicId) return;

  if (isCloudinaryConfigured()) {
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch {
      // ignore best-effort cleanup
    }
    return;
  }

  const filePath = path.join(FALLBACK_DIR, publicId);
  try {
    await fs.promises.unlink(filePath);
  } catch {
    // ignore if already missing
  }
}

module.exports = { detectImageType, uploadImage, deleteImage };
