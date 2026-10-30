import { GuestMessagesController } from './guest-messages.controller';
import { GuestMessagesService } from './guest-messages.service';

describe('GuestMessagesController', () => {
  let controller: GuestMessagesController;
  const mockGuestMessagesService = {
    create: jest.fn(),
    findByInvitationId: jest.fn(),
    getAll: jest.fn(),
    verifyOwnerOrAdmin: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(() => {
    controller = new GuestMessagesController(
      mockGuestMessagesService as unknown as GuestMessagesService,
    );
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('deleteMessage', () => {
    it('should call delete on service and return success response', async () => {
      const user = { id: 1, email: 'user@example.com', isAdmin: false };
      mockGuestMessagesService.delete.mockResolvedValue(undefined);

      const result = await controller.deleteMessage(user, 123);

      expect(mockGuestMessagesService.delete).toHaveBeenCalledWith(123, user);
      expect(result).toEqual({
        success: true,
        message: 'Guest message deleted successfully',
      });
    });
  });
});
