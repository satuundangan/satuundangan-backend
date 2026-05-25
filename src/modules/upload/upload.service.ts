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

    const fileKey = `${Date.now()}-${file.originalname}`;
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

      await this.s3Client.send(command);
      this.logger.log(`Upload successful key=${fileKey} size=${file.size}`);

      // ✅ Correctly construct the final URL using your public domain
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
