import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TemplateDesign } from '../src/template-design/template-design.entity';
import { Invitation } from '../src/invitation/invitation.entity';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { PaymentService } from '../src/payment/payment.service';

describe('Full User Journey (E2E)', () => {
  let app: INestApplication;
  let templateRepo: Repository<TemplateDesign>;
  let invitationRepo: Repository<Invitation>;
  let configService: ConfigService;

  // Variables to carry over between tests
  let jwtToken: string;
  let userId: number;
  let templateId: number;
  let invitationId: number;
  let invitationSlug: string;
  let orderId: string;
  let guestSlug: string;
  let serverKey: string;

  const uniqueSuffix = Date.now();
  const userEmail = `fullflow.${uniqueSuffix}@example.com`;
  const userPassword = 'password123';

  // Mock Midtrans Snap
  const mockSnap = {
    createTransaction: jest.fn().mockImplementation((params) => {
      return Promise.resolve({
        token: 'mock-snap-token-' + Date.now(),
        redirect_url:
          'https://app.sandbox.midtrans.com/snap/v2/vtweb/' +
          params.transaction_details.order_id,
      });
    }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Inject Mocks
    const paymentService = moduleFixture.get(PaymentService);
    (paymentService as any).snap = mockSnap;

    await app.init();

    templateRepo = moduleFixture.get(getRepositoryToken(TemplateDesign));
    invitationRepo = moduleFixture.get(getRepositoryToken(Invitation));
    configService = moduleFixture.get(ConfigService);
    serverKey = configService.get('SERVER_KEY') || 'mock-server-key';

    // 1. Setup: Create a Premium Template
    const template = templateRepo.create({
      name: 'Journey Premium Template',
      slug: `journey-prem-${uniqueSuffix}`,
      previewUrl: 'http://example.com/preview',
      thumbnailUrl: 'http://example.com/thumb.jpg',
      price: 100000, // Not free
      isPublished: true,
    });
    const savedTemplate = await templateRepo.save(template);
    templateId = savedTemplate.id;
  });

  afterAll(async () => {
    await app.close();
  });

  // --- STEP 1: AUTHENTICATION ---
  it('Step 1: User Register & Login', async () => {
    // Register
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Journey User',
        email: userEmail,
        password: userPassword,
        confirmPassword: userPassword,
      })
      .expect(201);

    // Login
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: userEmail, password: userPassword })
      .expect(201);

    jwtToken = loginRes.body.access_token;
    expect(jwtToken).toBeDefined();
  });

  // --- STEP 2: CREATE INVITATION ---
  it('Step 2: Create Invitation', async () => {
    const createDto = {
      title: 'My Journey Wedding',
      slug: `journey-wedding-${uniqueSuffix}`,
      templateDesignId: templateId,
      coupleName: 'Adam & Eve',
      groomName: 'Adam',
      brideName: 'Eve',
      quoteSource: 'bebas',
      quoteText: 'Beginning of a journey',
      loveStory: [],
      musicChoice: 'custom.mp3',
      isCustomMusic: true, // Allowed because template is premium
      bridePhotoUrl: 'http://img.com/bride.jpg',
      akadLocation: {
        mapUrl: 'http://maps.google.com',
        description: 'Mosque',
        dateTime: new Date().toISOString(),
      },
      resepsiLocation: {
        mapUrl: 'http://maps.google.com',
        description: 'Hall',
        dateTime: new Date().toISOString(),
      },
      mergeEvents: false,
      encryptedGuestName: false,
      menu: { title: 'Buffet', items: ['Steak'] },
      galleryImages: [],
      giftDeliveryAddress: 'Eden Garden',
      socialMedia: {},
      parents: { brideParents: 'Mr A', groomParents: 'Mr B' },
      enableGuestMessage: true,
    };

    const res = await request(app.getHttpServer())
      .post('/invitation')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send(createDto)
      .expect(201);

    invitationId = res.body.id;
    invitationSlug = res.body.slug;

    // Verify initial state: Not Active
    const inv = await invitationRepo.findOne({ where: { id: invitationId } });
    expect(inv).not.toBeNull();
    expect(inv!.isPublished).toBe(false);
  });

  // --- STEP 3: PAYMENT & ACTIVATION ---
  it('Step 3: Checkout & Payment Webhook', async () => {
    // A. Checkout (Get Token)
    const checkoutRes = await request(app.getHttpServer())
      .post('/payment/create')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({ invitation_id: invitationId })
      .expect(201);

    orderId = checkoutRes.body.order_id;
    expect(checkoutRes.body.token).toBeDefined();

    // B. Simulate Webhook (Midtrans Notification)
    const grossAmount = '100000.00';
    const statusCode = '200';
    const input = orderId + statusCode + grossAmount + serverKey;
    const signatureKey = crypto
      .createHash('sha512')
      .update(input)
      .digest('hex');

    const notificationPayload = {
      order_id: orderId,
      transaction_status: 'settlement',
      payment_type: 'bank_transfer',
      gross_amount: grossAmount,
      fraud_status: 'accept',
      status_code: statusCode,
      signature_key: signatureKey,
      settlement_time: new Date().toISOString(),
    };

    await request(app.getHttpServer())
      .post('/payment/notification')
      .send(notificationPayload)
      .expect(201);

    // Verify Activation
    const inv = await invitationRepo.findOne({ where: { id: invitationId } });
    expect(inv!.isPublished).toBe(true);
  });

  // --- STEP 4: UPDATE INVITATION ---
  it('Step 4: Update Invitation Details', async () => {
    const updateDto = {
      quoteText: 'Updated Quote: Journey Continues',
    };

    await request(app.getHttpServer())
      .patch(`/invitation/${invitationId}`)
      .set('Authorization', `Bearer ${jwtToken}`)
      .send(updateDto)
      .expect(200);

    const inv = await invitationRepo.findOne({ where: { id: invitationId } });
    expect(inv!.quoteText).toBe('Updated Quote: Journey Continues');
  });

  // --- STEP 5: ADD GUEST (User Dashboard) ---
  it('Step 5: Add a Guest', async () => {
    const guestDto = {
      invitationId: invitationId,
      name: 'Special Guest Budi',
      type: 'VIP',
    };

    const res = await request(app.getHttpServer())
      .post('/guests')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send(guestDto)
      .expect(201);

    expect(res.body.slug).toBeDefined();
    guestSlug = res.body.slug;
  });

  // --- STEP 6: PUBLIC VIEW & MESSAGE (Guest Side) ---
  it('Step 6: Guest Views Invitation & Sends Message', async () => {
    // A. Guest Views (Hit Endpoint)
    await request(app.getHttpServer())
      .get(`/invitation/slug/${invitationSlug}/guest/${guestSlug}`)
      .expect(200);

    // B. Guest Sends Message
    const msgDto = {
      invitationId: invitationId,
      guestName: 'Special Guest Budi',
      message: 'Congrats on the wedding!',
      rsvpStatus: 'hadir',
      totalGuests: 2,
      guestSlug: guestSlug, // Linking message to the specific guest
    };

    await request(app.getHttpServer())
      .post('/guest-messages')
      .send(msgDto)
      .expect(201);
  });

  // --- STEP 7: OWNER CHECKS MESSAGES ---
  it('Step 7: Owner Checks Received Messages', async () => {
    const res = await request(app.getHttpServer())
      .get(`/guest-messages/invitation/${invitationId}`)
      .expect(200);

    const messages = res.body.data;
    expect(messages.length).toBeGreaterThan(0);
    expect(messages[0].message).toBe('Congrats on the wedding!');
    expect(messages[0].guestName).toBe('Special Guest Budi');
  });
});
