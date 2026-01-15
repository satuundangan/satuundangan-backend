import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  ParseFilePipe,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile(
      // Use ParseFilePipe for built-in validation
      new ParseFilePipe({
        // You can add validators here for file type, size, etc.
        validators: [
          // Example: Limit file size to 10MB
          // new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }),
          // Example: Only allow image files
          // new FileTypeValidator({
          //   fileType: new RegExp('image/|application/pdf'),
          // }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    // Call the updated method name from the service
    return this.uploadService.uploadFile(file);
  }
}
