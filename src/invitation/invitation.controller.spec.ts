import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { InvitationController } from './invitation.controller';
import { InvitationService } from './invitation.service';

describe('InvitationController', () => {
  let controller: InvitationController;

  const mockInvitationService = {
    getLiveScreenFeed: jest.fn(),
  };

  const createMockResponse = () => {
    const res: any = {};
    res.setHeader = jest.fn().mockReturnValue(res);
    res.status = jest.fn().mockReturnValue(res);
    return res;
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InvitationController],
      providers: [
        { provide: InvitationService, useValue: mockInvitationService },
      ],
    }).compile();

    controller = module.get<InvitationController>(InvitationController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getLiveScreenFeed', () => {
    it('should call getLiveScreenFeed with preview=false when preview query is omitted or not "true"', async () => {
      mockInvitationService.getLiveScreenFeed.mockResolvedValue({
        invitation: { slug: 'test' },
      });

      const res = await controller.getLiveScreenFeed('test');
      expect(mockInvitationService.getLiveScreenFeed).toHaveBeenCalledWith(
        'test',
        { preview: false, ifNoneMatch: undefined },
      );
      expect(res).toEqual({ invitation: { slug: 'test' } });
    });

    it('should call getLiveScreenFeed with preview=true when preview query is "true"', async () => {
      mockInvitationService.getLiveScreenFeed.mockResolvedValue({
        invitation: { slug: 'test' },
      });

      const res = await controller.getLiveScreenFeed('test', 'true');
      expect(mockInvitationService.getLiveScreenFeed).toHaveBeenCalledWith(
        'test',
        { preview: true, ifNoneMatch: undefined },
      );
      expect(res).toEqual({ invitation: { slug: 'test' } });
    });

    it('should set HTTP 304 and return undefined when notModified is true (SAT-73)', async () => {
      mockInvitationService.getLiveScreenFeed.mockResolvedValue({
        notModified: true,
        etag: 'W/"30-100-200-300"',
      });

      const mockRes = createMockResponse();
      const res = await controller.getLiveScreenFeed(
        'test',
        'false',
        'W/"30-100-200-300"',
        mockRes,
      );

      expect(mockInvitationService.getLiveScreenFeed).toHaveBeenCalledWith(
        'test',
        { preview: false, ifNoneMatch: 'W/"30-100-200-300"' },
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'ETag',
        'W/"30-100-200-300"',
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        'private, no-cache',
      );
      expect(mockRes.status).toHaveBeenCalledWith(HttpStatus.NOT_MODIFIED);
      expect(res).toBeUndefined();
    });

    it('should set ETag header and return full result when content is modified (SAT-73)', async () => {
      const mockResult = {
        etag: 'W/"30-100-200-300"',
        invitation: { slug: 'test' },
        recentCheckIns: [],
        recentWishes: [],
        stats: { totalGuests: 10, totalCheckedIn: 5, totalWishes: 2 },
      };
      mockInvitationService.getLiveScreenFeed.mockResolvedValue(mockResult);

      const mockRes = createMockResponse();
      const res = await controller.getLiveScreenFeed(
        'test',
        'false',
        'W/"old-etag"',
        mockRes,
      );

      expect(mockInvitationService.getLiveScreenFeed).toHaveBeenCalledWith(
        'test',
        { preview: false, ifNoneMatch: 'W/"old-etag"' },
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'ETag',
        'W/"30-100-200-300"',
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        'private, no-cache',
      );
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(res).toEqual(mockResult);
    });
  });
});
