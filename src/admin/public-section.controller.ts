import { Controller, Get } from '@nestjs/common';
import { AdminService } from './admin.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Public Sections')
@Controller('sections')
export class PublicSectionController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  @ApiOperation({ summary: 'Get all master sections' })
  listSections() {
    return this.adminService.listSections();
  }
}
