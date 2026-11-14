import { Test, TestingModule } from '@nestjs/testing';
import { InvitationController } from './invitation.controller';
import { InvitationService } from './invitation.service';

describe('InvitationController', () => {
  let controller: InvitationController;

  const mockInvitationService = {
    getLiveScreenFeed: jest.fn(),
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
        { preview: false },
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
        { preview: true },
      );
      expect(res).toEqual({ invitation: { slug: 'test' } });
    });
  });
});
