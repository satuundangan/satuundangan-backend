import { Test, TestingModule } from '@nestjs/testing';
import { SupportTicketController } from './support-ticket.controller';
import { SupportTicketService } from './support-ticket.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../user/user.entity';

describe('SupportTicketController', () => {
  let controller: SupportTicketController;
  let mockService: any;

  beforeEach(async () => {
    mockService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      getMetrics: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SupportTicketController],
      providers: [
        {
          provide: SupportTicketService,
          useValue: mockService,
        },
        {
          provide: getRepositoryToken(User),
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<SupportTicketController>(SupportTicketController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should create ticket via POST /support-tickets', async () => {
    const dto = { subject: 'Issue', customerName: 'Ani' };
    mockService.create.mockResolvedValue({ id: 1, ...dto });

    const result = await controller.createTicket(dto as any);
    expect(result.success).toBe(true);
    expect(result.data.id).toBe(1);
    expect(mockService.create).toHaveBeenCalledWith(dto);
  });

  it('should get metrics via GET /admin/support-tickets/metrics', async () => {
    const metrics = { backlog: { open: 1 } };
    mockService.getMetrics.mockResolvedValue(metrics);

    const result = await controller.getMetrics();
    expect(result.success).toBe(true);
    expect(result.data).toEqual(metrics);
  });

  it('should get all tickets via GET /admin/support-tickets', async () => {
    mockService.findAll.mockResolvedValue({ data: [], total: 0 });

    const result = await controller.findAll({ status: 'open' });
    expect(result.success).toBe(true);
    expect(mockService.findAll).toHaveBeenCalledWith({ status: 'open' });
  });

  it('should get ticket detail via GET /admin/support-tickets/:id', async () => {
    mockService.findOne.mockResolvedValue({ id: 1, subject: 'Issue' });

    const result = await controller.findOne(1);
    expect(result.success).toBe(true);
    expect(result.data.id).toBe(1);
  });

  it('should update ticket via PATCH /admin/support-tickets/:id', async () => {
    mockService.update.mockResolvedValue({ id: 1, status: 'resolved' });

    const result = await controller.update(1, { status: 'resolved' });
    expect(result.success).toBe(true);
    expect(result.data.status).toBe('resolved');
  });
});
