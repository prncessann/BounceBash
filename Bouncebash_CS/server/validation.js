const { z } = require('zod');

function passwordSchema(minimumLength) {
  return z.string().min(minimumLength).max(72)
    .refine(password => Buffer.byteLength(password, 'utf8') <= 72, 'Password must be 72 UTF-8 bytes or fewer.');
}

module.exports = { passwordSchema };
