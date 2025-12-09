require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { PrismaClient } = require('@prisma/client');
const { hashPassword, verifyPassword, createAccessToken, decodeToken } = require('./auth');
const { s3 } = require('../s3');
const { 
    PutObjectCommand, 
    GetObjectCommand, 
    ListObjectsV2Command, 
    DeleteObjectCommand,
    HeadObjectCommand,
} = require('@aws-sdk/client-s3');
const multer = require('multer');
const path = require('path');
const { randomUUID } = require('crypto');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
if (process.env.FFMPEG_PATH) {
  ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
}
if (process.env.FFPROBE_PATH) {
  ffmpeg.setFfprobePath(process.env.FFPROBE_PATH);
}
const fs = require('fs');
const os = require('os');
const { promisify } = require('util');
const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 8000;
const FRONT_ORIGIN = process.env.FRONT_ORIGIN || 'http://localhost:3000';
const COOKIE_SECURE = (process.env.COOKIE_SECURE || 'false').toLowerCase() === 'true';
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // até 50MB por arquivo
  },
});


app.use(cors({ origin: FRONT_ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser());

function setAuthCookie(res, token) {
    res.cookie('access_token', token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: COOKIE_SECURE,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/',
    });
}

function clearAuthCookie(res) {
    res.clearCookie('access_token', { path: '/' });
}

async function getCurrentUser(req) {
    const token = req.cookies?.access_token;
    const sub = token ? decodeToken(token) : null;
    if (!sub) return null;
    return await prisma.user.findFirst({ where: { OR: [{ email: sub }, { username: sub }] } });
}

async function ffprobeVideoInfo(inputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) return reject(err);
      const videoStream = metadata.streams.find((s) => s.codec_type === 'video');
      if (!videoStream) return reject(new Error('Nenhum stream de vídeo encontrado'));
      resolve({
        width: videoStream.width,
        height: videoStream.height,
      });
    });
  });
}

async function transcodeVariant(inputPath, outputPath, targetHeight) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoCodec('libx264')
      .size(`?x${targetHeight}`) // mantém proporção, força altura
      .outputOptions(['-preset veryfast', '-crf 23'])
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', reject)
      .run();
  });
}

async function extractVideoThumbnail(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .screenshots({
        count: 1,
        timemarks: ['1'], // 1 segundo
        filename: require('path').basename(outputPath),
        folder: require('path').dirname(outputPath),
      })
      .on('end', resolve)
      .on('error', reject);
  });
}


app.get('/health', (_, res) => res.json({ ok: true }));

app.post('/media/upload', upload.single('file'), async (req, res) => {
  const authUser = await getCurrentUser(req);
  if (!authUser) return res.status(401).json({ detail: 'Não autenticado' });

  try {
    if (!req.file) {
      return res.status(400).json({ detail: 'Campo "file" é obrigatório' });
    }

    const Bucket = process.env.S3_BUCKET;
    const file = req.file;
    const mimeType = file.mimetype;
    const originalName = file.originalname;
    const size = file.size;

    const rawName = (req.body.name || '').trim();
    const name = rawName || originalName;

    const descriptionRaw = (req.body.description || '').trim();
    const description = descriptionRaw || null;

    const rawTags = req.body.tags || '';
    const tags = rawTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    let mediaType = 'other';
    if (mimeType.startsWith('image/')) mediaType = 'image';
    else if (mimeType.startsWith('audio/')) mediaType = 'audio';
    else if (mimeType.startsWith('video/')) mediaType = 'video';

    const ext = path.extname(originalName).toLowerCase();
    const timestamp = Date.now();
    const id = randomUUID();
    const createdAt = new Date();

    // 🔹 variáveis que vamos preencher nos blocos
    let originalKey;
    let thumbKey = null;
    let variant360pKey = null;
    let variant720pKey = null;
    let variant1080pKey = null;

    let responsePayload = {
      ok: true,
      bucket: Bucket,
      id,
      mediaType,
      mimeType,
      size,
      name,
      description,
      tags,
      created_at: createdAt.toISOString(),
    };

    // ---------------- IMAGE ----------------
    if (mediaType === 'image') {
      originalKey = `public/images/${id}-${timestamp}-original${ext || ''}`;
      thumbKey = `public/images/${id}-${timestamp}-thumb.jpg`;

      // original
      await s3.send(
        new PutObjectCommand({
          Bucket,
          Key: originalKey,
          Body: file.buffer,
          ContentType: mimeType,
          Metadata: {
            id,
            name,
            description: description || '',
            tags: tags.join(','),
            mediatype: mediaType,
            created_at: createdAt.toISOString(),
            variant: 'original',
          },
        })
      );

      // thumb
      const thumbBuffer = await sharp(file.buffer)
        .resize({ width: 400 })
        .jpeg({ quality: 70 })
        .toBuffer();

      await s3.send(
        new PutObjectCommand({
          Bucket,
          Key: thumbKey,
          Body: thumbBuffer,
          ContentType: 'image/jpeg',
          Metadata: {
            id,
            name,
            description: description || '',
            tags: tags.join(','),
            mediatype: mediaType,
            created_at: createdAt.toISOString(),
            variant: 'thumbnail',
            original_key: originalKey,
          },
        })
      );

      const thumbnail_url_inline = `data:image/jpeg;base64,${thumbBuffer.toString('base64')}`;

      responsePayload = {
        ...responsePayload,
        file_url: originalKey,
        file_type: mimeType,
        thumbnail_key: thumbKey,
        thumbnail_url: thumbnail_url_inline,
      };
    }
    // ---------------- VIDEO ----------------
    else if (mediaType === 'video') {
      const tmpDir = os.tmpdir();
      const tmpInputPath = path.join(tmpDir, `${id}-input${ext || '.mp4'}`);

      originalKey = `public/videos/${id}-${timestamp}-original${ext || '.mp4'}`;

      // sobe original
      await s3.send(
        new PutObjectCommand({
          Bucket,
          Key: originalKey,
          Body: file.buffer,
          ContentType: mimeType,
          Metadata: {
            id,
            name,
            description: description || '',
            tags: tags.join(','),
            mediatype: mediaType,
            created_at: createdAt.toISOString(),
            variant: 'original',
          },
        })
      );

      await writeFile(tmpInputPath, file.buffer);

      let thumbnail_url_inline = null;
      const qualityKeys = {};

      try {
        const info = await ffprobeVideoInfo(tmpInputPath);
        const srcHeight = info.height || 0;

        const variants = [];
        if (srcHeight >= 360) variants.push(360);
        if (srcHeight >= 720) variants.push(720);
        if (srcHeight >= 1080) variants.push(1080);

        // thumbnail do vídeo
        const thumbTmpPath = path.join(tmpDir, `${id}-thumb.jpg`);
        await extractVideoThumbnail(tmpInputPath, thumbTmpPath);
        const thumbBuffer = await fs.promises.readFile(thumbTmpPath);

        thumbKey = `public/videos/${id}-${timestamp}-thumb.jpg`;

        await s3.send(
          new PutObjectCommand({
            Bucket,
            Key: thumbKey,
            Body: thumbBuffer,
            ContentType: 'image/jpeg',
            Metadata: {
              id,
              name,
              description: description || '',
              tags: tags.join(','),
              mediatype: mediaType,
              created_at: createdAt.toISOString(),
              variant: 'thumbnail',
              original_key: originalKey,
            },
          })
        );

        thumbnail_url_inline = `data:image/jpeg;base64,${thumbBuffer.toString('base64')}`;
        await unlink(thumbTmpPath).catch(() => {});

        // variantes de qualidade
        for (const h of variants) {
          const outTmpPath = path.join(tmpDir, `${id}-${h}p.mp4`);
          await transcodeVariant(tmpInputPath, outTmpPath, h);
          const variantBuffer = await fs.promises.readFile(outTmpPath);

          const variantKey = `public/videos/${id}-${timestamp}-${h}p.mp4`;

          await s3.send(
            new PutObjectCommand({
              Bucket,
              Key: variantKey,
              Body: variantBuffer,
              ContentType: 'video/mp4',
              Metadata: {
                id,
                name,
                description: description || '',
                tags: tags.join(','),
                mediatype: mediaType,
                created_at: createdAt.toISOString(),
                variant: `${h}p`,
                original_key: originalKey,
              },
            })
          );

          qualityKeys[`${h}p`] = variantKey;

          if (h === 360) variant360pKey = variantKey;
          if (h === 720) variant720pKey = variantKey;
          if (h === 1080) variant1080pKey = variantKey;

          await unlink(outTmpPath).catch(() => {});
        }

        responsePayload = {
          ...responsePayload,
          file_url: originalKey,
          file_type: mimeType,
          thumbnail_key: thumbKey,
          thumbnail_url: thumbnail_url_inline,
          video_variants: {
            original: originalKey,
            ...qualityKeys,
          },
        };
      } catch (videoErr) {
        console.error('Erro ao processar vídeo:', videoErr);
        // aqui você pode manter só original + thumb ou nem isso
      } finally {
        await unlink(tmpInputPath).catch(() => {});
      }
    } else {
      // outros tipos (áudio, etc) – por enquanto só sobe o original
      originalKey = `public/others/${id}-${timestamp}${ext || ''}`;
      await s3.send(
        new PutObjectCommand({
          Bucket,
          Key: originalKey,
          Body: file.buffer,
          ContentType: mimeType,
          Metadata: {
            id,
            name,
            description: description || '',
            tags: tags.join(','),
            mediatype: mediaType,
            created_at: createdAt.toISOString(),
            variant: 'original',
          },
        })
      );

      responsePayload = {
        ...responsePayload,
        file_url: originalKey,
        file_type: mimeType,
        thumbnail_key: null,
        thumbnail_url: null,
      };
    }

    // 🔹 Salva metadados no Prisma
    const media = await prisma.media.create({
      data: {
        id,
        userId: authUser.id,
        bucket: Bucket,
        originalKey,
        thumbKey,
        mediaType,
        mimeType,
        name,
        description,
        tags,
        has360p: !!variant360pKey,
        has720p: !!variant720pKey,
        has1080p: !!variant1080pKey,
        variant360pKey,
        variant720pKey,
        variant1080pKey,
        createdAt,
      },
    });

    return res.json({
      ok: true,
      media,
      ...responsePayload,
    });
  } catch (err) {
    console.error('Erro no upload de mídia:', err);
    return res.status(500).json({
      detail: 'Erro ao fazer upload',
      error: err.message,
    });
  }
});


app.get('/media/object', async (_req, res) => {
    try {
        const Bucket = process.env.S3_BUCKET;
        const Key = req.query.key;
        if (!Key) {
            return res.status(400).json({ detail: 'Parâmetro "key" é obrigatório' });
        }
        const response = await s3.send(new GetObjectCommand({ Bucket, Key }));
        const meta = response.Metadata || {};

        const tags = meta.tags
            ? meta.tags.split(',').map((t) => t.trim()).filter(Boolean)
            : [];
        
        const id = meta.id || key;
        const mediaType = meta.mediatype || 'other';
        const mimeType = response.ContentType || 'application/octet-stream';
        const name = meta.name || key;
        const created_at = meta.created_at || null;
        const description = meta.description || null;

        const chunks = [];
        for await (const chunk of resp.Body) {
        chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);
        const base64 = buffer.toString('base64');

        return res.json({
        ok: true,
        bucket: Bucket,
        key,
        id,
        name,
        description,
        tags,
        mediaType,
        created_at,
        mimeType,
        size: buffer.length,
        file: {
            encoding: 'base64',
            data: base64,
        },
        });
    } catch (err) {
        console.error('Erro ao recuperar mídia:', err);
        return res.status(500).json({
        detail: 'Erro ao recuperar mídia',
        error: err.message,
        });
    }
});

app.get('/media/list', async (req, res) => {
    try {
        const authUser = await getCurrentUser(req);
        if (!authUser) {
        return res.status(401).json({ detail: 'Não autenticado' });
        }

        const BucketEnv = process.env.S3_BUCKET;

        // 1) Busca todas as mídias do usuário logado
        const medias = await prisma.media.findMany({
        where: { userId: authUser.id },
        orderBy: { createdAt: 'desc' },
        });

        const uploads = [];

        // 2) Para cada mídia, tenta montar o objeto pro front
        for (const m of medias) {
        const Bucket = m.bucket || BucketEnv;

        let thumbnail_url = null;

        if (m.thumbKey) {
            try {
            const resp = await s3.send(
                new GetObjectCommand({
                Bucket,
                Key: m.thumbKey,
                })
            );

            const chunks = [];
            for await (const chunk of resp.Body) {
                chunks.push(chunk);
            }
            const buffer = Buffer.concat(chunks);
            const mime = resp.ContentType || 'image/jpeg';
            thumbnail_url = `data:${mime};base64,${buffer.toString('base64')}`;
            } catch (err) {
            console.error('[media/list] Erro ao buscar thumbnail no S3:', {
                mediaId: m.id,
                thumbKey: m.thumbKey,
                bucket: Bucket,
                error: err.message,
            });
            // se der erro, só segue sem thumbnail
            thumbnail_url = null;
            }
        }

        // file_type: o frontend usa pra saber se é image/video/audio
        let file_type = m.mimeType || 'application/octet-stream';
        if (!m.mimeType && m.mediaType) {
            if (m.mediaType === 'image') file_type = 'image/*';
            else if (m.mediaType === 'video') file_type = 'video/*';
            else if (m.mediaType === 'audio') file_type = 'audio/*';
        }

        uploads.push({
            id: m.id,
            name: m.name,
            file_url: m.originalKey,                           // chave do original
            file_type,
            thumbnail_url,                                     // pode ser null
            description: m.description,
            tags: Array.isArray(m.tags) ? m.tags : [],
            created_at: m.createdAt.toISOString(),
            bucket: Bucket,
            key: m.originalKey,
            mediaType: m.mediaType,
            has360p: m.has360p,
            has720p: m.has720p,
            has1080p: m.has1080p,
        });
        }

        return res.json({
        ok: true,
        uploads,
        });
    } catch (err) {
        console.error('Erro ao listar mídias:', err);
        return res.status(500).json({
        detail: 'Erro ao listar mídias',
        error: err.message,
        });
    }
});



app.get('/media/:id', async (req, res) => {
  try {
    const Bucket = process.env.S3_BUCKET;
    const mediaId = req.params.id;
    const Prefix = req.query.prefix || 'public/';

    if (!mediaId) {
      return res.status(400).json({ detail: 'Parâmetro "id" é obrigatório' });
    }

    // 1) Lista objetos sob o prefixo (public/)
    const listResp = await s3.send(
      new ListObjectsV2Command({
        Bucket,
        Prefix,
      })
    );

    const contents = listResp.Contents || [];

    let original = null;
    const variants = {}; // ex: { '360p': { key, mimeType, size }, ... }
    let baseMeta = null;

    // 2) Para cada objeto, checa metadata.id == :id
    for (const obj of contents) {
      const key = obj.Key;
      if (!key || key.endsWith('/')) continue;

      const head = await s3.send(
        new HeadObjectCommand({
          Bucket,
          Key: key,
        })
      );

      const meta = head.Metadata || {};
      const id = meta.id || null;

      if (id !== mediaId) {
        continue;
      }

      const variant = meta.variant || 'original';
      const mediaType = meta.mediatype || 'other';

      if (!baseMeta) {
        baseMeta = {
          id: mediaId,
          mediaType,
          name: meta.name || mediaId,
          description: meta.description || null,
          tags: meta.tags
            ? meta.tags
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean)
            : [],
          created_at: meta.created_at || new Date().toISOString(),
        };
      }

      const info = {
        key,
        mimeType: head.ContentType || 'application/octet-stream',
        size: head.ContentLength ?? obj.Size ?? 0,
      };

      if (variant === 'original') {
        original = { ...info, mediaType };
      } else if (variant !== 'thumbnail') {
        // variantes de vídeo: 360p, 720p, 1080p etc.
        variants[variant] = info;
      }
      // thumbnail é ignorada aqui propositalmente
    }

    if (!original || !baseMeta) {
      return res.status(404).json({ detail: 'Mídia original não encontrada' });
    }

    const { id, mediaType, name, description, tags, created_at } = baseMeta;

    // 3) Se for imagem, baixa o original e devolve data_url (pra exibir no modal)
    let original_data_url = null;
    if (mediaType === 'image') {
      const respOrig = await s3.send(
        new GetObjectCommand({
          Bucket,
          Key: original.key,
        })
      );

      const chunks = [];
      for await (const chunk of respOrig.Body) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      const mime = respOrig.ContentType || original.mimeType || 'image/*';
      original_data_url = `data:${mime};base64,${buffer.toString('base64')}`;
    }

    // Para vídeo/áudio: não carregamos o conteúdo aqui, só infos.
    // Depois podemos criar um /media/file?key=... para servir stream.

    return res.json({
      ok: true,
      id,
      bucket: Bucket,
      mediaType,
      name,
      description,
      tags,
      created_at,
      original: {
        key: original.key,
        mimeType: original.mimeType,
        size: original.size,
        // só vem preenchido se for imagem
        data_url: original_data_url,
      },
      variants, // ex: { '360p': { key, mimeType, size }, ... } para vídeo
    });
  } catch (err) {
    console.error('Erro ao recuperar mídia por id:', err);
    return res.status(500).json({
      detail: 'Erro ao recuperar mídia por id',
      error: err.message,
    });
  }
});



app.delete('/media/:id', async (req, res) => {
  try {
    const authUser = await getCurrentUser(req);
    if (!authUser) {
      return res.status(401).json({ detail: 'Não autenticado' });
    }

    const BucketFallback = process.env.S3_BUCKET;
    const mediaId = req.params.id;

    if (!mediaId) {
      return res.status(400).json({ detail: 'Parâmetro "id" é obrigatório' });
    }

    // 1) Busca mídia no banco
    const media = await prisma.media.findUnique({
      where: { id: mediaId },
    });

    if (!media || media.userId !== authUser.id) {
      return res.status(404).json({ detail: 'Mídia não encontrada' });
    }

    const Bucket = media.bucket || BucketFallback;

    // 2) Monta lista de keys a deletar
    const keysToDelete = [
      media.originalKey,
      media.thumbKey,
      media.variant360pKey,
      media.variant720pKey,
      media.variant1080pKey,
    ].filter(Boolean); // remove null/undefined

    const deleted = [];
    const errors = [];

    for (const key of keysToDelete) {
      try {
        await s3.send(
          new DeleteObjectCommand({
            Bucket,
            Key: key,
          })
        );
        deleted.push(key);
      } catch (err) {
        console.error(`Erro ao deletar key ${key}:`, err);
        errors.push({ key, message: err.message });
      }
    }

    // 3) Remove registro do banco
    await prisma.media.delete({
      where: { id: mediaId },
    });

    return res.json({
      ok: errors.length === 0,
      id: mediaId,
      deleted,
      errors: errors.length ? errors : undefined,
    });
  } catch (err) {
    console.error('Erro ao deletar mídia por id:', err);
    return res.status(500).json({
      detail: 'Erro ao deletar mídia',
      error: err.message,
    });
  }
});


app.get('/media/video/:id', async (req, res) => {
  try {
    const authUser = await getCurrentUser(req);
    if (!authUser) {
      return res.status(401).json({ detail: 'Não autenticado' });
    }

    const BucketFallback = process.env.S3_BUCKET;
    const mediaId = req.params.id;

    if (!mediaId) {
      return res.status(400).json({ detail: 'Parâmetro "id" é obrigatório' });
    }

    // normaliza qualidade
    const qualityParam = (req.query.quality || 'original').toString().toLowerCase();
    let targetVariant;
    if (qualityParam === 'original') targetVariant = 'original';
    else if (qualityParam === '360' || qualityParam === '360p') targetVariant = '360p';
    else if (qualityParam === '720' || qualityParam === '720p') targetVariant = '720p';
    else if (qualityParam === '1080' || qualityParam === '1080p') targetVariant = '1080p';
    else {
      return res.status(400).json({
        detail: 'Qualidade inválida. Use original, 360p, 720p ou 1080p.',
      });
    }

    // 1) Busca media no banco
    const media = await prisma.media.findUnique({
      where: { id: mediaId },
    });

    if (!media || media.userId !== authUser.id || media.mediaType !== 'video') {
      return res.status(404).json({ detail: 'Vídeo não encontrado' });
    }

    const Bucket = media.bucket || BucketFallback;

    // 2) Decide qual key usar
    let key = null;

    if (targetVariant === 'original') {
      key = media.originalKey;
    } else if (targetVariant === '360p') {
      if (!media.variant360pKey) {
        return res.status(404).json({ detail: 'Qualidade 360p não disponível para este vídeo' });
      }
      key = media.variant360pKey;
    } else if (targetVariant === '720p') {
      if (!media.variant720pKey) {
        return res.status(404).json({ detail: 'Qualidade 720p não disponível para este vídeo' });
      }
      key = media.variant720pKey;
    } else if (targetVariant === '1080p') {
      if (!media.variant1080pKey) {
        return res.status(404).json({ detail: 'Qualidade 1080p não disponível para este vídeo' });
      }
      key = media.variant1080pKey;
    }

    if (!key) {
      return res.status(404).json({ detail: 'Arquivo de vídeo não encontrado para esta qualidade' });
    }

    // 3) Faz stream do S3 para o cliente
    const getResp = await s3.send(
      new GetObjectCommand({
        Bucket,
        Key: key,
      })
    );

    const mimeType = getResp.ContentType || media.mimeType || 'video/mp4';
    const size = getResp.ContentLength;

    res.setHeader('Content-Type', mimeType);
    if (size != null) {
      res.setHeader('Content-Length', String(size));
    }
    // se quiser, pode colocar:
    // res.setHeader('Accept-Ranges', 'bytes');

    const bodyStream = getResp.Body;

    if (bodyStream && typeof bodyStream.pipe === 'function') {
      bodyStream.pipe(res);
    } else {
      // fallback: lê tudo e envia
      const chunks = [];
      for await (const chunk of bodyStream) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      res.end(buffer);
    }
  } catch (err) {
    console.error('Erro ao servir vídeo por id/qualidade:', err);
    return res.status(500).json({
      detail: 'Erro ao servir vídeo',
      error: err.message,
    });
  }
});

app.post('/auth/register', async (req, res) => {
    try {
        const { full_name, username, email, password } = req.body;
        if (!full_name || !username || !email || !password) {
            return res.status(400).json({ detail: 'Campos obrigatórios ausentes' });
        }


        const exists = await prisma.user.findFirst({ where: { OR: [{ email }, { username }] } });
        if (exists) return res.status(409).json({ detail: 'Email ou username já existe' });


        const user = await prisma.user.create({
            data: {
                full_name,
                username,
                email,
                password_hash: hashPassword(password),
            },
        });


        const token = createAccessToken(user.email);
        setAuthCookie(res, token);


        const { password_hash, ...safe } = user;
        res.json(safe);
    } catch (err) {
        console.error(err);
        res.status(500).json({ detail: 'Erro interno' });
    }
});

app.post('/auth/login', async (req, res) => {
    try {
        const { email_or_username, password } = req.body;
        if (!email_or_username || !password) return res.status(400).json({ detail: 'Credenciais ausentes' });


        const user = await prisma.user.findFirst({ where: { OR: [{ email: email_or_username }, { username: email_or_username }] } });
        if (!user || !verifyPassword(password, user.password_hash)) return res.status(400).json({ detail: 'Credenciais inválidas' });


        const token = createAccessToken(user.email);
        setAuthCookie(res, token);


        const { password_hash, ...safe } = user;
        res.json(safe);
    } catch (err) {
        console.error(err);
        res.status(500).json({ detail: 'Erro interno' });
    }
});


app.post('/auth/logout', async (_req, res) => {
    clearAuthCookie(res);
    res.json({ ok: true });
});
app.get('/users/me', async (req, res) => {
    const user = await getCurrentUser(req);
    if (!user) return res.status(401).json({ detail: 'Não autenticado' });
    const { password_hash, ...safe } = user;
    res.json(safe);
});


app.put('/users/me', async (req, res) => {
    const authUser = await getCurrentUser(req);
    if (!authUser) return res.status(401).json({ detail: 'Não autenticado' });


    const { full_name, username, image_url, description, password } = req.body;


    try {
        if (username && username !== authUser.username) {
            const exists = await prisma.user.findUnique({ where: { username } });
            if (exists) return res.status(409).json({ detail: 'Username já em uso' });
        }


        const updated = await prisma.user.update({
            where: { id: authUser.id },
            data: {
            full_name: full_name ?? authUser.full_name,
            username: username ?? authUser.username,
            image_url: image_url === undefined ? authUser.image_url : image_url,
            description: description === undefined ? authUser.description : description,
            password_hash: password ? hashPassword(password) : authUser.password_hash,
            },
        });


        const { password_hash, ...safe } = updated;
        res.json(safe);
    } catch (err) {
        console.error(err);
        res.status(500).json({ detail: 'Erro ao atualizar' });
    }
});

app.listen(PORT, () => console.log(`API rodando em http://localhost:${PORT}`));