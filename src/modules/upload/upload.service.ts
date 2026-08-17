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

  async uploadFile(file: Express.Multer.File) {
    if (!file) {
      this.logger.warn('Upload rejected: no file provided');
      throw new InternalServerErrorException('No file provided for upload.');
    }

    const fileKey = `${Date.now()}-${file.originalname}`;

    if (this.isLocalMode) {
      const filePath = path.join(this.localUploadDir, fileKey);
      fs.writeFileSync(filePath, file.buffer);
      this.logger.log(`Local upload saved key=${fileKey} size=${file.size}`);
      const port = this.configService.get<string>('PORT') ?? '3000';
      return {
        fileUrl: `http://localhost:${port}/uploads/${encodeURIComponent(fileKey)}`,
        message: 'Upload successful (local) ✅',
      };
    }

    this.logger.log(
      `Uploading file to R2 key=${fileKey} size=${file.size} mimetype=${file.mimetype}`,
    );

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: fileKey,
        Body: file.buffer,
        ContentType: file.mimetype,
      });

      await this.s3Client!.send(command);
      this.logger.log(`Upload successful key=${fileKey} size=${file.size}`);

      return {
        fileUrl: `${this.publicUrl}/${fileKey}`,
        message: 'Upload successful ✅',
      };
    } catch (error) {
      this.logger.error(
        `Error uploading to R2 key=${fileKey} size=${file.size}`,
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
