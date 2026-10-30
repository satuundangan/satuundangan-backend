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
    getGuestDrilldown: jest.fn(),
    adminGetMessages: jest.fn(),
    moderateMessage: jest.fn(),
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

  describe('getGuestDrilldown', () => {
    it('returns drilldown data for invitation', async () => {
      const user = { id: 1, email: 'user@example.com', isAdmin: false };
      const drilldownData = { totalGuests: 10, sentCount: 5 };
      mockGuestMessagesService.getGuestDrilldown.mockResolvedValue(drilldownData);

      const result = await controller.getGuestDrilldown(user, 123);
      expect(mockGuestMessagesService.getGuestDrilldown).toHaveBeenCalledWith(123, user);
      expect(result).toEqual({ success: true, data: drilldownData });
    });
  });

  describe('adminGetMessages', () => {
    it('returns admin messages list', async () => {
      const listData = { data: [], total: 0, page: 1, limit: 20 };
      mockGuestMessagesService.adminGetMessages.mockResolvedValue(listData);

      const result = await controller.adminGetMessages({ status: 'flagged_spam' });
      expect(mockGuestMessagesService.adminGetMessages).toHaveBeenCalledWith({ status: 'flagged_spam' });
      expect(result.success).toBe(true);
      expect(result.total).toBe(0);
    });
  });

  describe('moderateMessage', () => {
    it('moderates a message and returns success', async () => {
      const user = { id: 1, email: 'admin@example.com', isAdmin: true };
      const updatedMsg = { id: 10, status: 'hidden' };
      mockGuestMessagesService.moderateMessage.mockResolvedValue(updatedMsg);

      const result = await controller.moderateMessage(user, 10, { status: 'hidden' });
      expect(mockGuestMessagesService.moderateMessage).toHaveBeenCalledWith(10, 'hidden', user);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(updatedMsg);
    });
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
