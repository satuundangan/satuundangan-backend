import {
  Controller,
  Post,
  Delete,
  Body,
  UploadedFile,
  UseInterceptors,
  ParseFilePipe,
  MaxFileSizeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';

const UPLOAD_MAX_FILE_SIZE_BYTES =
  (Number(process.env.UPLOAD_MAX_FILE_SIZE_MB) || 25) * 1024 * 1024;

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: UPLOAD_MAX_FILE_SIZE_BYTES,
      },
    }),
  )
  async uploadFile(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: UPLOAD_MAX_FILE_SIZE_BYTES }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.uploadService.uploadFile(file);
  }

  @Delete()
  async deleteFile(@Body('fileUrl') fileUrl: string) {
    return this.uploadService.deleteFile(fileUrl);
  }
}
