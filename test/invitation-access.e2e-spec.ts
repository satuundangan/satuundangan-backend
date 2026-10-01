import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

jest.mock('otplib', () => ({
  generateSecret: jest.fn(() => 'MOCKSECRET'),
  generateURI: jest.fn(() => 'otpauth://totp/mock'),
  verifySync: jest.fn(() => ({ valid: true })),
}));

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

  it('should get share link from backend with accessToken', async () => {
    const res = await request(app.getHttpServer())
      .get(`/guests/${guestId}/share`)
      .set('Authorization', `Bearer ${jwtToken}`)
      .expect(200);

    expect(res.body.url).toContain(`/inv/${invitationSlug}`);
    expect(res.body.waLink).toContain('wa.me');
  });

  it('should return invitation data via public slug endpoint when isGuestPublic is true', async () => {
    const res = await request(app.getHttpServer())
      .get(`/invitation/slug/${invitationSlug}`)
      .expect(200);

    expect(res.body.slug).toBe(invitationSlug);
    expect(res.body.title).toBe('QA Wedding');
  });

  it('should return invitation with guest data when isGuestPublic is true via guestSlug', async () => {
    const res = await request(app.getHttpServer())
      .get(`/invitation/slug/${invitationSlug}/guest/${guestSlug}`)
      .expect(200);

    expect(res.body.invitation.slug).toBe(invitationSlug);
    expect(res.body.guest.slug).toBe(guestSlug);
    expect(res.body.guest.name).toBe('Budi Santoso');
  });

  it('should block anonymous access with 403 Forbidden when isGuestPublic is false', async () => {
    // Set invitation to private
    await invitationRepo.update({ id: invitationId }, { isGuestPublic: false });

    const res = await request(app.getHttpServer())
      .get(`/invitation/slug/${invitationSlug}`)
      .expect(403);

    expect(res.body.message).toBe(
      'Undangan ini privat. Gunakan link undangan khusus dari pemilik.',
    );

    // Also verify via /invitations alias
    const aliasRes = await request(app.getHttpServer())
      .get(`/invitations/slug/${invitationSlug}`)
      .expect(403);

    expect(aliasRes.body.message).toBe(
      'Undangan ini privat. Gunakan link undangan khusus dari pemilik.',
    );
  });

  it('should reject access with 404 when isGuestPublic is false and accessed via raw name slug', async () => {
    await request(app.getHttpServer())
      .get(`/invitation/slug/${invitationSlug}/guest/${guestSlug}`)
      .expect(404);
  });

  it('should allow access with 200 when isGuestPublic is false and accessed via accessToken', async () => {
    // Fetch guest to get their generated accessToken
    const guest = await guestRepo.findOne({ where: { id: guestId } });
    expect(guest?.accessToken).toBeDefined();

    const res = await request(app.getHttpServer())
      .get(`/invitation/slug/${invitationSlug}/guest/${guest?.accessToken}`)
      .expect(200);

    expect(res.body.invitation.slug).toBe(invitationSlug);
    expect(res.body.guest.name).toBe('Budi Santoso');
    expect(res.body.guest.accessToken).toBe(guest?.accessToken);

    // Also verify via /invitations alias
    const aliasRes = await request(app.getHttpServer())
      .get(`/invitations/slug/${invitationSlug}/guest/${guest?.accessToken}`)
      .expect(200);

    expect(aliasRes.body.invitation.slug).toBe(invitationSlug);
    expect(aliasRes.body.guest.name).toBe('Budi Santoso');
  });

  it('should check in guest via check-in-token using private accessToken', async () => {
    const guest = await guestRepo.findOne({ where: { id: guestId } });

    const res = await request(app.getHttpServer())
      .post('/guests/check-in-token')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({ token: guest?.accessToken })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.alreadyCheckedIn).toBe(false);
    expect(res.body.guest.name).toBe('Budi Santoso');

    // Second check-in should be idempotent and return alreadyCheckedIn: true
    const secondRes = await request(app.getHttpServer())
      .post('/guests/check-in-token')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({ token: guest?.accessToken })
      .expect(201);

    expect(secondRes.body.success).toBe(true);
    expect(secondRes.body.alreadyCheckedIn).toBe(true);
  });
});
