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
import sharp from 'sharp';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly publicUrl: string;

  constructor(private readonly configService: ConfigService) {
    const accountId = this.configService.getOrThrow<string>('R2_ACCOUNT_ID');

    // Retrieve all necessary variables from the ConfigService using getOrThrow for safety
    this.bucketName = this.configService.getOrThrow<string>('R2_BUCKET_NAME');
    this.publicUrl = this.configService.getOrThrow<string>('R2_PUBLIC_URL');

    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: this.configService.getOrThrow<string>('R2_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.getOrThrow<string>(
          'R2_SECRET_ACCESS_KEY',
        ),
      },
    });
  }

  /**
   * Uploads a file to Cloudflare R2 and returns its public URL.
   * @param file The file to upload, compliant with Express.Multer.File.
   * @returns An object containing the public URL of the uploaded file and a success message.
   */
  async uploadFile(file: Express.Multer.File) {
    if (!file) {
      this.logger.warn('Upload rejected: no file provided');
      throw new InternalServerErrorException('No file provided for upload.');
    }

    let processedFile = file;

    // Check if the uploaded file is a convertable image (exclude SVG and GIF to be safe)
    if (
      file.mimetype.startsWith('image/') &&
      file.mimetype !== 'image/svg+xml' &&
      file.mimetype !== 'image/gif'
    ) {
      try {
        const originalName = file.originalname;
        const lastDotIndex = originalName.lastIndexOf('.');
        const baseName = lastDotIndex !== -1 ? originalName.substring(0, lastDotIndex) : originalName;

        const webpBuffer = await sharp(file.buffer)
          .webp({ quality: 85 })
          .toBuffer();

        // Create a shallow copy of the file object with WebP buffer and properties
        processedFile = {
          ...file,
          buffer: webpBuffer,
          size: webpBuffer.length,
          mimetype: 'image/webp',
          originalname: `${baseName}.webp`,
        };

        this.logger.log(
          `Converted image to WebP: originalName=${originalName} originalSize=${file.size} -> newSize=${processedFile.size} (${Math.round((1 - processedFile.size / file.size) * 100)}% reduction)`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to convert image to WebP, uploading original file: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    const fileKey = `${Date.now()}-${processedFile.originalname}`;
    this.logger.log(
      `Uploading file to R2 key=${fileKey} size=${processedFile.size} mimetype=${processedFile.mimetype}`,
    );

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: fileKey,
        Body: processedFile.buffer,
        ContentType: processedFile.mimetype,
      });

      await this.s3Client.send(command);
      this.logger.log(`Upload successful key=${fileKey} size=${processedFile.size}`);

      // ✅ Correctly construct the final URL using your public domain
      return {
        fileUrl: `${this.publicUrl}/${fileKey}`,
        message: 'Upload successful ✅',
      };
    } catch (error) {
      this.logger.error(
        `Error uploading to R2 key=${fileKey} size=${processedFile.size}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException('Failed to upload file.');
    }
  }

  /**
   * Deletes a file from Cloudflare R2.
   * @param fileUrl The public URL of the file to delete.
   */
  async deleteFile(fileUrl: string) {
    if (!fileUrl) return;

    // Extract the key from the URL
    // e.g., https://pub-xxx.r2.dev/123456-image.jpg -> 123456-image.jpg
    const fileKey = fileUrl.replace(`${this.publicUrl}/`, '');

    this.logger.log(`Deleting file from R2 key=${fileKey}`);

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: fileKey,
      });

      await this.s3Client.send(command);
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
