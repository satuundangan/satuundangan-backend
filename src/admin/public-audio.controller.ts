import { Controller, Get } from '@nestjs/common';
import { AdminService } from './admin.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Public Audio')
@Controller('audio')
export class PublicAudioController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  @ApiOperation({ summary: 'Get all master audio tracks' })
  listAudio() {
    return this.adminService.listAudio();
  }
}
