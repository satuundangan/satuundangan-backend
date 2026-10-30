import { Test, TestingModule } from '@nestjs/testing';
import { LeadController } from './lead.controller';
import { LeadService } from './lead.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../user/user.entity';

describe('LeadController', () => {
  let controller: LeadController;
  let mockLeadService: any;

  beforeEach(async () => {
    mockLeadService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LeadController],
      providers: [
        {
          provide: LeadService,
          useValue: mockLeadService,
        },
        {
          provide: getRepositoryToken(User),
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<LeadController>(LeadController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should create lead via POST /leads', async () => {
    const dto = { name: 'Lead 1', whatsapp: '0811' };
    mockLeadService.create.mockResolvedValue({ id: 1, ...dto });

    const result = await controller.createLead(dto as any);
    expect(result.success).toBe(true);
    expect(result.data.id).toBe(1);
    expect(mockLeadService.create).toHaveBeenCalledWith(dto);
  });

  it('should get all leads via GET /admin/leads', async () => {
    mockLeadService.findAll.mockResolvedValue({
      data: [{ id: 1 }],
      total: 1,
      page: 1,
      limit: 20,
    });

    const result = await controller.findAll({ stage: 'new' });
    expect(result.success).toBe(true);
    expect(result.total).toBe(1);
    expect(mockLeadService.findAll).toHaveBeenCalledWith({ stage: 'new' });
  });

  it('should get lead by id via GET /admin/leads/:id', async () => {
    mockLeadService.findOne.mockResolvedValue({ id: 1, name: 'Lead 1' });
    const result = await controller.findOne(1);
    expect(result.success).toBe(true);
    expect(result.data.id).toBe(1);
  });

  it('should update lead via PATCH /admin/leads/:id', async () => {
    mockLeadService.update.mockResolvedValue({ id: 1, stage: 'won' });
    const result = await controller.update(1, { stage: 'won' });
    expect(result.success).toBe(true);
    expect(result.data.stage).toBe('won');
  });

  it('should remove lead via DELETE /admin/leads/:id', async () => {
    mockLeadService.remove.mockResolvedValue({ success: true, message: 'Deleted' });
    const result = await controller.remove(1);
    expect(result.success).toBe(true);
  });
});
