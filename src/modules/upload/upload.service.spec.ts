import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UploadService } from './upload.service';
const sharp = require('sharp');

describe('UploadService', () => {
  let service: UploadService;

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

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should compress and convert JPEG image to WebP', async () => {
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
    expect(result.fileUrl).toContain('.webp');
    expect(result.message).toContain('Upload successful');
  });

  it('should retain non-image files as-is', async () => {
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
    expect(result.fileUrl).toContain('document.pdf');
  });
});
