import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TemplateDesign } from '../src/template-design/template-design.entity';
import { Invitation } from '../src/invitation/invitation.entity';
import { Guest } from '../src/dashboard-user/guest/guest.entity';
import { Repository } from 'typeorm';

describe('Invitation Access & Decoding (E2E)', () => {
  let app: INestApplication;
  let templateRepo: Repository<TemplateDesign>;
  let invitationRepo: Repository<Invitation>;
  let guestRepo: Repository<Guest>;

  let jwtToken: string;
  let templateId: number;
  let invitationId: number;
  let invitationSlug: string;
  let guestId: number;
  let guestSlug: string;

  const uniqueSuffix = Date.now();
  const userEmail = `qa.${uniqueSuffix}@example.com`;
  const userPassword = 'password123';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    templateRepo = moduleFixture.get(getRepositoryToken(TemplateDesign));
    invitationRepo = moduleFixture.get(getRepositoryToken(Invitation));
    guestRepo = moduleFixture.get(getRepositoryToken(Guest));

    // Setup: Create a Free Template
    const template = templateRepo.create({
      name: 'QA Free Template',
      slug: `qa-free-${uniqueSuffix}`,
      previewUrl: 'http://example.com/preview',
      thumbnailUrl: 'http://example.com/thumb.jpg',
      price: 0,
      isPublished: true,
      isPremium: false,
    });
    const savedTemplate = await templateRepo.save(template);
    templateId = savedTemplate.id;

    // Register & Login
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'QA User',
        email: userEmail,
        password: userPassword,
        confirmPassword: userPassword,
      })
      .expect(201);

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: userEmail, password: userPassword })
      .expect(201);

    jwtToken = loginRes.body.access_token;

    // Create Invitation
    const res = await request(app.getHttpServer())
      .post('/invitation')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({
        title: 'QA Wedding',
        slug: `qa-wedding-${uniqueSuffix}`,
        templateDesignId: templateId,
        coupleName: 'Q & A',
        groomName: 'Groom',
        brideName: 'Bride',
        isPublished: true,
        loveStory: [],
        musicChoice: 'default.mp3',
        bridePhotoUrl: 'http://example.com/bride.jpg',
        menu: { title: 'Menu Makanan', items: [] },
        galleryImages: [],
        giftDeliveryAddress: 'Garden',
        socialMedia: {},
        parents: { brideParents: 'A', groomParents: 'B' },
      })
      .expect(201);

    invitationId = res.body.id;
    invitationSlug = res.body.slug;

    // Add Guest
    const guestRes = await request(app.getHttpServer())
      .post('/guests')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({
        invitationId: invitationId,
        name: 'Budi Santoso',
      })
      .expect(201);

    guestId = guestRes.body.id;
    guestSlug = guestRes.body.slug;
  });

  afterAll(async () => {
    await app.close();
  });

  it('should get share link from backend', async () => {
    const res = await request(app.getHttpServer())
      .get(`/guests/${guestId}/share`)
      .set('Authorization', `Bearer ${jwtToken}`)
      .expect(200);

    expect(res.body.url).toContain(`/inv/${invitationSlug}/${guestSlug}`);
    // Check if encoded name is present if invitation has encryptedGuestName
    // (In this test it's false by default, but let's check what backend does)
  });

  it('should return invitation data via public slug endpoint', async () => {
    const res = await request(app.getHttpServer())
      .get(`/invitation/slug/${invitationSlug}`)
      .expect(200);

    expect(res.body.slug).toBe(invitationSlug);
    expect(res.body.title).toBe('QA Wedding');
  });

  it('should return invitation with guest data via the long guest endpoint', async () => {
    const res = await request(app.getHttpServer())
      .get(`/invitation/slug/${invitationSlug}/guest/${guestSlug}`)
      .expect(200);

    expect(res.body.invitation.slug).toBe(invitationSlug);
    expect(res.body.guest.slug).toBe(guestSlug);
    expect(res.body.guest.name).toBe('Budi Santoso');
  });
});
