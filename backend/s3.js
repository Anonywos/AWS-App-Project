require("dotenv").config();
const { S3Client } = require("@aws-sdk/client-s3");

const s3 = new S3Client({
  region: process.env.S3_REGION || "sa-east-1",
  endpoint: process.env.S3_ENDPOINT || undefined,
  forcePathStyle: true, // necessário para LocalStack
});

module.exports = { s3 };
