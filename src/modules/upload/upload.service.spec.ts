import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UploadService } from './upload.service';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';
const sharp = require('sharp');

describe('UploadService', () => {
  describe('Local Mode', () => {
    let service: UploadService;
    const createdFiles: string[] = [];

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          UploadService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'PORT') return '3000';
                return null; // Forces local mode
              }),
              getOrThrow: jest.fn(),
            },
          },
        ],
      }).compile();

      service = module.get<UploadService>(UploadService);
    });

    afterEach(async () => {
      // Clean up any test files created in local mode
      for (const fileUrl of createdFiles) {
        await service.deleteFile(fileUrl);
      }
      createdFiles.length = 0;
    });

    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should compress, generate thumbnail, and convert JPEG image to WebP', async () => {
      // Generate a 2000x2000 test JPEG buffer
      const largeJpegBuffer = await sharp({
        create: {
          width: 2000,
          height: 2000,
          channels: 3,
          background: { r: 255, g: 100, b: 50 },
        },
      })
        .jpeg()
        .toBuffer();

      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'test_photo.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        buffer: largeJpegBuffer,
        size: largeJpegBuffer.length,
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      const result = await service.uploadFile(mockFile);
      createdFiles.push(result.fileUrl);

      expect(result.fileUrl).toContain('.webp');
      expect(result.fileUrl).not.toContain('-thumb.webp');
      expect(result.thumbnailUrl).toContain('-thumb.webp');
      expect(result.message).toContain('Upload successful (local)');

      // Verify full image dimensions on disk
      const fullFileName = decodeURIComponent(result.fileUrl.split('/uploads/')[1]);
      const fullFilePath = path.join(process.cwd(), 'uploads', fullFileName);
      expect(fs.existsSync(fullFilePath)).toBe(true);

      const fullMeta = await sharp(fullFilePath).metadata();
      expect(fullMeta.format).toBe('webp');
      expect(fullMeta.width).toBeLessThanOrEqual(1920);
      expect(fullMeta.height).toBeLessThanOrEqual(1920);

      // Verify thumbnail dimensions on disk
      const thumbFileName = decodeURIComponent(result.thumbnailUrl!.split('/uploads/')[1]);
      const thumbFilePath = path.join(process.cwd(), 'uploads', thumbFileName);
      expect(fs.existsSync(thumbFilePath)).toBe(true);

      const thumbMeta = await sharp(thumbFilePath).metadata();
      expect(thumbMeta.format).toBe('webp');
      expect(thumbMeta.width).toBe(400);
      expect(thumbMeta.height).toBe(400);
    });

    it('should retain non-image files as-is with null thumbnailUrl', async () => {
      const textBuffer = Buffer.from('sample text content');
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'document.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        buffer: textBuffer,
        size: textBuffer.length,
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      const result = await service.uploadFile(mockFile);
      createdFiles.push(result.fileUrl);

      expect(result.fileUrl).toContain('document.pdf');
      expect(result.thumbnailUrl).toBeNull();
      expect(result.message).toContain('Upload successful (local)');
    });

    it('should delete both full file and thumbnail when deleting an image in local mode', async () => {
      const imgBuffer = await sharp({
        create: {
          width: 500,
          height: 500,
          channels: 3,
          background: { r: 10, g: 20, b: 30 },
        },
      })
        .jpeg()
        .toBuffer();

      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'to_delete.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        buffer: imgBuffer,
        size: imgBuffer.length,
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      const result = await service.uploadFile(mockFile);
      const fullFileName = decodeURIComponent(result.fileUrl.split('/uploads/')[1]);
      const thumbFileName = decodeURIComponent(result.thumbnailUrl!.split('/uploads/')[1]);
      const fullFilePath = path.join(process.cwd(), 'uploads', fullFileName);
      const thumbFilePath = path.join(process.cwd(), 'uploads', thumbFileName);

      expect(fs.existsSync(fullFilePath)).toBe(true);
      expect(fs.existsSync(thumbFilePath)).toBe(true);

      const deleteRes = await service.deleteFile(result.fileUrl);
      expect(deleteRes?.message).toBe('File deleted successfully');

      expect(fs.existsSync(fullFilePath)).toBe(false);
      expect(fs.existsSync(thumbFilePath)).toBe(false);
    });

    it('should handle corrupt image by falling back to original without thumbnail', async () => {
      const corruptBuffer = Buffer.from('corrupted binary data not an image');
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'corrupt.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        buffer: corruptBuffer,
        size: corruptBuffer.length,
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      const result = await service.uploadFile(mockFile);
      createdFiles.push(result.fileUrl);

      expect(result.fileUrl).toContain('corrupt.jpg');
      expect(result.thumbnailUrl).toBeNull();
    });

    it('should throw InternalServerErrorException when no file is provided', async () => {
      await expect(service.uploadFile(null as any)).rejects.toThrow();
    });

    it('should do nothing gracefully when deleteFile is called with empty string', async () => {
      const res = await service.deleteFile('');
      expect(res).toBeUndefined();
    });
  });

  describe('Cloudflare R2 Mode', () => {
    let service: UploadService;
    let s3SendSpy: jest.SpyInstance;

    beforeEach(async () => {
      s3SendSpy = jest
        .spyOn(S3Client.prototype, 'send')
        .mockImplementation(async () => ({} as any));

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          UploadService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                const config: Record<string, string> = {
                  R2_ACCOUNT_ID: 'test-account-id',
                  R2_BUCKET_NAME: 'test-bucket',
                  R2_PUBLIC_URL: 'https://cdn.satuundangan.com',
                };
                return config[key] ?? null;
              }),
              getOrThrow: jest.fn((key: string) => {
                const config: Record<string, string> = {
                  R2_ACCESS_KEY_ID: 'test-access-key',
                  R2_SECRET_ACCESS_KEY: 'test-secret-key',
                };
                return config[key];
              }),
            },
          },
        ],
      }).compile();

      service = module.get<UploadService>(UploadService);
    });

    afterEach(() => {
      s3SendSpy.mockRestore();
    });

    it('should upload full and thumbnail to R2 with CacheControl for images', async () => {
      const imgBuffer = await sharp({
        create: {
          width: 800,
          height: 600,
          channels: 3,
          background: { r: 50, g: 150, b: 250 },
        },
      })
        .png()
        .toBuffer();

      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'gallery.png',
        encoding: '7bit',
        mimetype: 'image/png',
        buffer: imgBuffer,
        size: imgBuffer.length,
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      const result = await service.uploadFile(mockFile);

      expect(result.fileUrl).toMatch(/^https:\/\/cdn\.satuundangan\.com\/\d+-gallery\.webp$/);
      expect(result.thumbnailUrl).toMatch(/^https:\/\/cdn\.satuundangan\.com\/\d+-gallery-thumb\.webp$/);
      expect(result.message).toBe('Upload successful ✅');

      // Verify that S3Client send was called twice (full + thumbnail)
      expect(s3SendSpy).toHaveBeenCalledTimes(2);

      const calls = s3SendSpy.mock.calls;
      const fullCall = calls.find((c) => (c[0] as PutObjectCommand).input.Key?.endsWith('.webp') && !(c[0] as PutObjectCommand).input.Key?.endsWith('-thumb.webp'));
      const thumbCall = calls.find((c) => (c[0] as PutObjectCommand).input.Key?.endsWith('-thumb.webp'));

      expect(fullCall).toBeDefined();
      expect((fullCall![0] as PutObjectCommand).input).toMatchObject({
        Bucket: 'test-bucket',
        ContentType: 'image/webp',
        CacheControl: 'public, max-age=31536000, immutable',
      });

      expect(thumbCall).toBeDefined();
      expect((thumbCall![0] as PutObjectCommand).input).toMatchObject({
        Bucket: 'test-bucket',
        ContentType: 'image/webp',
        CacheControl: 'public, max-age=31536000, immutable',
      });
    });

    it('should upload only main file to R2 with CacheControl for non-images', async () => {
      const textBuffer = Buffer.from('resume text content');
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'resume.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        buffer: textBuffer,
        size: textBuffer.length,
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      const result = await service.uploadFile(mockFile);

      expect(result.fileUrl).toMatch(/^https:\/\/cdn\.satuundangan\.com\/\d+-resume\.pdf$/);
      expect(result.thumbnailUrl).toBeNull();
      expect(result.message).toBe('Upload successful ✅');

      // Verify that S3Client send was called once
      expect(s3SendSpy).toHaveBeenCalledTimes(1);
      const call = s3SendSpy.mock.calls[0];
      expect((call[0] as PutObjectCommand).input).toMatchObject({
        Bucket: 'test-bucket',
        Key: expect.stringMatching(/\d+-resume\.pdf$/),
        ContentType: 'application/pdf',
        CacheControl: 'public, max-age=31536000, immutable',
      });
    });

    it('should delete both full file and thumbnail from R2 when deleting an image', async () => {
      const fileUrl = 'https://cdn.satuundangan.com/1700000000000-photo.webp';
      const result = await service.deleteFile(fileUrl);

      expect(result).toEqual({ message: 'File deleted successfully' });
      expect(s3SendSpy).toHaveBeenCalledTimes(2);

      const calls = s3SendSpy.mock.calls;
      const keys = calls.map((c) => (c[0] as DeleteObjectCommand).input.Key);
      expect(keys).toContain('1700000000000-photo.webp');
      expect(keys).toContain('1700000000000-photo-thumb.webp');
    });

    it('should delete only main file from R2 when deleting a non-image', async () => {
      const fileUrl = 'https://cdn.satuundangan.com/1700000000000-document.pdf';
      const result = await service.deleteFile(fileUrl);

      expect(result).toEqual({ message: 'File deleted successfully' });
      expect(s3SendSpy).toHaveBeenCalledTimes(1);

      const command = s3SendSpy.mock.calls[0][0] as DeleteObjectCommand;
      expect(command.input.Key).toBe('1700000000000-document.pdf');
    });

    it('should delete only the thumbnail when deleting a -thumb.webp file directly', async () => {
      const fileUrl = 'https://cdn.satuundangan.com/1700000000000-photo-thumb.webp';
      const result = await service.deleteFile(fileUrl);

      expect(result).toEqual({ message: 'File deleted successfully' });
      expect(s3SendSpy).toHaveBeenCalledTimes(1);

      const command = s3SendSpy.mock.calls[0][0] as DeleteObjectCommand;
      expect(command.input.Key).toBe('1700000000000-photo-thumb.webp');
    });
  });
});
