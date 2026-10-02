import { Payment } from '../payment/payment.entity';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { InvitationService } from './invitation.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Invitation } from './invitation.entity';
import { Guest } from '../dashboard-user/guest/guest.entity';
import { InvitationActivity } from '../dashboard/invitation-activity.entity';
import { TemplateDesign } from '../template-design/template-design.entity';
import { User } from '../user/user.entity';
import { AffiliateProfile } from '../affiliate/entities/affiliate-profile.entity';

describe('InvitationService', () => {
  let service: InvitationService;

  const mockRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvitationService,
        { provide: getRepositoryToken(Invitation), useValue: mockRepo },
        { provide: getRepositoryToken(Guest), useValue: mockRepo },
        { provide: getRepositoryToken(InvitationActivity), useValue: mockRepo },
        { provide: getRepositoryToken(TemplateDesign), useValue: mockRepo },
        { provide: getRepositoryToken(User), useValue: mockRepo },
        { provide: getRepositoryToken(AffiliateProfile), useValue: mockRepo },
        { provide: getRepositoryToken(Payment), useValue: mockRepo },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    service = module.get<InvitationService>(InvitationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
