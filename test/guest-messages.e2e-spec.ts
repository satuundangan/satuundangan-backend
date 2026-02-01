import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TemplateDesign } from '../src/template-design/template-design.entity';
import { Repository } from 'typeorm';
import { Invitation } from '../src/invitation/invitation.entity';

describe('GuestMessages E2E', () => {
  let app: INestApplication;
  let templateRepo: Repository<TemplateDesign>;
  let invitationRepo: Repository<Invitation>;

  let jwtToken: string;
  let invitationId: number;
  let templateId: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    templateRepo = moduleFixture.get(getRepositoryToken(TemplateDesign));
    invitationRepo = moduleFixture.get(getRepositoryToken(Invitation));

    // 1. Create a template
    const template = templateRepo.create({
      name: 'E2E Guest Message Template',
      slug: `e2e-gm-${Date.now()}`,
      previewUrl: 'http://example.com/preview',
      thumbnailUrl: 'http://example.com/thumb.jpg',
      price: 0,
      isActive: true,
    });
    const savedTemplate = await templateRepo.save(template);
    templateId = savedTemplate.id;

    // 2. Register & Login
    const email = `test.gm.${Date.now()}@example.com`;
    const password = 'password123';

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'GM Tester',
        email,
        password,
        confirmPassword: password,
      })
      .expect(201);

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(201);

    jwtToken = loginRes.body.access_token;

    // 3. Create an invitation
    const createDto = {
      title: 'GM Wedding',
      slug: `wedding-gm-${Date.now()}`,
      templateDesignId: templateId,
      coupleName: 'Alice & Bob',
      groomName: 'Alice',
      brideName: 'Bob',
      quoteSource: 'bebas',
      quoteText: 'GM Test',
      loveStory: [],
      musicChoice: 'default.mp3',
      isCustomMusic: false,
      bridePhotoUrl: 'http://img.com/bride.jpg',
      akadLocation: {
        mapUrl: 'http://maps.google.com',
        description: 'Mosque',
        dateTime: new Date().toISOString(),
      },
      resepsiLocation: {
        mapUrl: 'http://maps.google.com',
        description: 'Hotel',
        dateTime: new Date().toISOString(),
      },
      mergeEvents: false,
      encryptedGuestName: false,
      menu: { title: 'Buffet', items: ['Rice'] },
      galleryImages: [],
      giftDeliveryAddress: 'Home',
      socialMedia: {},
      parents: { brideParents: 'P1', groomParents: 'P2' },
      enableGuestMessage: true,
    };

    const invRes = await request(app.getHttpServer())
      .post('/invitation')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send(createDto)
      .expect(201);

    invitationId = invRes.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('should create a guest message', async () => {
    const messageDto = {
      invitationId: invitationId,
      guestName: 'John Doe',
      message: 'Happy Wedding!',
      rsvpStatus: 'hadir',
      totalGuests: 2,
    };

    const res = await request(app.getHttpServer())
      .post('/guest-messages')
      .send(messageDto)
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.guestName).toBe('John Doe');
    expect(res.body.data.message).toBe('Happy Wedding!');
  });

  it('should get guest messages for an invitation', async () => {
    const res = await request(app.getHttpServer())
      .get(`/guest-messages/invitation/${invitationId}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].guestName).toBe('John Doe');
  });

  it('should get all guest messages', async () => {
    const res = await request(app.getHttpServer())
      .get('/guest-messages')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
