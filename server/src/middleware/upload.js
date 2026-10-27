const multer = require('multer');

const MAX_FILES = 4;
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (!file || !file.originalname) {
    return cb(new Error('Invalid file upload.'));
  }

  cb(null, true);
};

const upload = multer({
  storage,
  limits: {
    files: MAX_FILES,
    fileSize: MAX_FILE_SIZE,
    fieldSize: 1 * 1024 * 1024,
  },
  fileFilter,
});

module.exports = { upload, MAX_FILES, MAX_FILE_SIZE };
