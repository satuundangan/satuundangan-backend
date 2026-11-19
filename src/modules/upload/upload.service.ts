import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
const sharp = require('sharp');

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private readonly s3Client: S3Client | null = null;
  private readonly bucketName: string;
  private readonly publicUrl: string;
  private readonly isLocalMode: boolean;
  private readonly localUploadDir: string;

  constructor(private readonly configService: ConfigService) {
    const accountId = this.configService.get<string>('R2_ACCOUNT_ID');
    this.bucketName = this.configService.get<string>('R2_BUCKET_NAME') ?? '';
    this.publicUrl = this.configService.get<string>('R2_PUBLIC_URL') ?? '';

    if (accountId && this.bucketName && this.publicUrl) {
      this.isLocalMode = false;
      this.s3Client = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: this.configService.getOrThrow<string>('R2_ACCESS_KEY_ID'),
          secretAccessKey: this.configService.getOrThrow<string>('R2_SECRET_ACCESS_KEY'),
        },
      });
      this.logger.log('UploadService: using Cloudflare R2');
    } else {
      this.isLocalMode = true;
      this.localUploadDir = path.join(process.cwd(), 'uploads');
      if (!fs.existsSync(this.localUploadDir)) {
        fs.mkdirSync(this.localUploadDir, { recursive: true });
      }
      this.logger.warn('UploadService: R2 not configured — using local file storage at ./uploads');
    }
  }

  private async processImage(file: Express.Multer.File): Promise<{
    buffer: Buffer;
    thumbBuffer: Buffer | null;
    mimetype: string;
    extension: string;
    isImage: boolean;
  }> {
    const isImage =
      file.mimetype?.startsWith('image/') &&
      !file.mimetype.includes('svg') &&
      !file.mimetype.includes('gif');

    if (!isImage) {
      const ext = path.extname(file.originalname);
      return {
        buffer: file.buffer,
        thumbBuffer: null,
        mimetype: file.mimetype,
        extension: ext,
        isImage: false,
      };
    }

    try {
      const [fullBuffer, thumbBuffer] = await Promise.all([
        sharp(file.buffer)
          .rotate()
          .resize(1920, 1920, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .webp({ quality: 80, effort: 4 })
          .toBuffer(),
        sharp(file.buffer)
          .rotate()
          .resize(400, 400, {
            fit: 'cover',
          })
          .webp({ quality: 75, effort: 4 })
          .toBuffer(),
      ]);

      const originalSize = file.size || file.buffer?.length || 0;
      const savedBytes = originalSize - fullBuffer.length;
      const pct = originalSize > 0 ? Math.round((savedBytes / originalSize) * 100) : 0;
      this.logger.log(
        `Optimized image ${file.originalname}: full ${originalSize} -> ${fullBuffer.length} bytes (${pct > 0 ? `-${pct}%` : '+0%'}), thumb: ${thumbBuffer.length} bytes`,
      );

      return {
        buffer: fullBuffer,
        thumbBuffer,
        mimetype: 'image/webp',
        extension: '.webp',
        isImage: true,
      };
    } catch (err) {
      this.logger.warn(
        `Failed to optimize image ${file.originalname}, falling back to original: ${err instanceof Error ? err.message : String(err)}`,
      );
      const ext = path.extname(file.originalname);
      return {
        buffer: file.buffer,
        thumbBuffer: null,
        mimetype: file.mimetype,
        extension: ext,
        isImage: false,
      };
    }
  }

  async uploadFile(file: Express.Multer.File): Promise<{
    fileUrl: string;
    thumbnailUrl: string | null;
    message: string;
  }> {
    if (!file) {
      this.logger.warn('Upload rejected: no file provided');
      throw new InternalServerErrorException('No file provided for upload.');
    }

    const processed = await this.processImage(file);
    const timestamp = Date.now();
    const parsedPath = path.parse(file.originalname);
    const sanitizedBase = parsedPath.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileKey = `${timestamp}-${sanitizedBase}${processed.extension}`;
    const thumbKey = processed.isImage
      ? `${timestamp}-${sanitizedBase}-thumb${processed.extension}`
      : null;

    if (this.isLocalMode) {
      const filePath = path.join(this.localUploadDir, fileKey);
      fs.writeFileSync(filePath, processed.buffer);

      const port = this.configService.get<string>('PORT') ?? '3000';
      let thumbnailUrl: string | null = null;

      if (processed.isImage && processed.thumbBuffer && thumbKey) {
        const thumbPath = path.join(this.localUploadDir, thumbKey);
        fs.writeFileSync(thumbPath, processed.thumbBuffer);
        thumbnailUrl = `http://localhost:${port}/uploads/${thumbKey}`;
      }

      this.logger.log(
        `Local upload saved key=${fileKey} size=${processed.buffer.length} mimetype=${processed.mimetype}`,
      );
      return {
        fileUrl: `http://localhost:${port}/uploads/${fileKey}`,
        thumbnailUrl,
        message: 'Upload successful (local) ✅',
      };
    }

    this.logger.log(
      `Uploading file to R2 key=${fileKey} size=${processed.buffer.length} mimetype=${processed.mimetype}`,
    );

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: fileKey,
        Body: processed.buffer,
        ContentType: processed.mimetype,
        CacheControl: 'public, max-age=31536000, immutable',
      });

      if (processed.isImage && processed.thumbBuffer && thumbKey) {
        const thumbCommand = new PutObjectCommand({
          Bucket: this.bucketName,
          Key: thumbKey,
          Body: processed.thumbBuffer,
          ContentType: processed.mimetype,
          CacheControl: 'public, max-age=31536000, immutable',
        });

        await Promise.all([
          this.s3Client!.send(command),
          this.s3Client!.send(thumbCommand),
        ]);
        this.logger.log(
          `Upload successful key=${fileKey} size=${processed.buffer.length} thumbKey=${thumbKey} size=${processed.thumbBuffer.length}`,
        );

        return {
          fileUrl: `${this.publicUrl}/${fileKey}`,
          thumbnailUrl: `${this.publicUrl}/${thumbKey}`,
          message: 'Upload successful ✅',
        };
      } else {
        await this.s3Client!.send(command);
        this.logger.log(`Upload successful key=${fileKey} size=${processed.buffer.length}`);

        return {
          fileUrl: `${this.publicUrl}/${fileKey}`,
          thumbnailUrl: null,
          message: 'Upload successful ✅',
        };
      }
    } catch (error) {
      this.logger.error(
        `Error uploading to R2 key=${fileKey} size=${processed.buffer.length}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException('Failed to upload file.');
    }
  }

  async deleteFile(fileUrl: string) {
    if (!fileUrl) return;

    if (this.isLocalMode) {
      const parts = fileUrl.split('/uploads/');
      if (parts[1]) {
        const fileName = decodeURIComponent(parts[1]);
        const filePath = path.join(this.localUploadDir, fileName);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          this.logger.log(`Local file deleted: ${fileName}`);
        }

        if (fileName.endsWith('.webp') && !fileName.endsWith('-thumb.webp')) {
          const thumbName = fileName.replace(/\.webp$/, '-thumb.webp');
          const thumbPath = path.join(this.localUploadDir, thumbName);
          if (fs.existsSync(thumbPath)) {
            fs.unlinkSync(thumbPath);
            this.logger.log(`Local thumbnail deleted: ${thumbName}`);
          }
        }
      }
      return { message: 'File deleted successfully' };
    }

    const fileKey = fileUrl.replace(`${this.publicUrl}/`, '');
    this.logger.log(`Deleting file from R2 key=${fileKey}`);

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: fileKey,
      });

      await this.s3Client!.send(command);
      this.logger.log(`Delete successful key=${fileKey}`);

      if (fileKey.endsWith('.webp') && !fileKey.endsWith('-thumb.webp')) {
        const thumbKey = fileKey.replace(/\.webp$/, '-thumb.webp');
        try {
          const thumbCommand = new DeleteObjectCommand({
            Bucket: this.bucketName,
            Key: thumbKey,
          });
          await this.s3Client!.send(thumbCommand);
          this.logger.log(`Delete thumbnail successful key=${thumbKey}`);
        } catch (thumbError) {
          this.logger.warn(
            `Failed to delete thumbnail from R2 key=${thumbKey}: ${thumbError instanceof Error ? thumbError.message : String(thumbError)}`,
          );
        }
      }

      return { message: 'File deleted successfully' };
    } catch (error) {
      this.logger.error(
        `Error deleting from R2 key=${fileKey}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException('Failed to delete file.');
    }
  }
}
