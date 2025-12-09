-- CreateTable
CREATE TABLE "Media" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    "bucket" TEXT NOT NULL,
    "originalKey" TEXT NOT NULL,
    "thumbKey" TEXT,
    "mediaType" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "tags" JSONB,
    "has360p" BOOLEAN NOT NULL DEFAULT false,
    "has720p" BOOLEAN NOT NULL DEFAULT false,
    "has1080p" BOOLEAN NOT NULL DEFAULT false,
    "variant360pKey" TEXT,
    "variant720pKey" TEXT,
    "variant1080pKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Media_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
