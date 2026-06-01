import { Test, TestingModule } from '@nestjs/testing';
import { InvitationService } from './invitation.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Invitation } from './invitation.entity';
import { Guest } from '../dashboard-user/guest/guest.entity';
import { InvitationActivity } from '../dashboard/invitation-activity.entity';
import { TemplateDesign } from '../template-design/template-design.entity';
import { User } from '../user/user.entity';

describe('InvitationService', () => {
  let service: InvitationService;

  const mockRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
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
      ],
    }).compile();

    service = module.get<InvitationService>(InvitationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
