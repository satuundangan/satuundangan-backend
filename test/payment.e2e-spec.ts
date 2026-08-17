import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TemplateDesign } from '../src/template-design/template-design.entity';
import { Repository } from 'typeorm';
import { PaymentService } from '../src/payment/payment.service';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { Invitation } from '../src/invitation/invitation.entity';

describe('Payment E2E', () => {
  let app: INestApplication;
  let templateRepo: Repository<TemplateDesign>;
  let invitationRepo: Repository<Invitation>;
  let paymentService: PaymentService;
  let configService: ConfigService;

  let jwtToken: string;
  let invitationId: number;
  let templateId: number;
  let orderId: string;
  let serverKey: string;

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
    await app.init();

    templateRepo = moduleFixture.get(getRepositoryToken(TemplateDesign));
    invitationRepo = moduleFixture.get(getRepositoryToken(Invitation));
    paymentService = moduleFixture.get(PaymentService);
    configService = moduleFixture.get(ConfigService);

    // Get Server Key for signature generation
    serverKey = configService.get('SERVER_KEY') || 'mock-server-key';

    // Monkey-patch the private snap instance
    (paymentService as any).snap = mockSnap;

    // 1. Create a paid template
    const template = templateRepo.create({
      name: 'E2E Paid Template',
      slug: `e2e-paid-${Date.now()}`,
      previewUrl: 'http://example.com/preview',
      thumbnailUrl: 'http://example.com/thumb.jpg',
      price: 50000, // Not free
      isPublished: true,
    });
    const savedTemplate = await templateRepo.save(template);
    templateId = savedTemplate.id;

    // 2. Register & Login
    const email = `test.payment.${Date.now()}@example.com`;
    const password = 'password123';

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Payment Tester',
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
  });

  afterAll(async () => {
    // Cleanup if necessary, e.g., delete created entities
    // For now, we rely on test DB isolation or manual cleanup if using shared DB
    await app.close();
  });

  it('should create an invitation', async () => {
    const createDto = {
      title: 'My Wedding',
      slug: `wedding-${Date.now()}`,
      templateDesignId: templateId,
      coupleName: 'Romeo & Juliet',
      groomName: 'Romeo',
      brideName: 'Juliet',
      quoteSource: 'bebas',
      quoteText: 'Love is in the air',
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
      parents: { brideParents: 'Mr & Mrs A', groomParents: 'Mr & Mrs B' },
      enableGuestMessage: true,
    };

    const res = await request(app.getHttpServer())
      .post('/invitation')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send(createDto)
      .expect(201);

    invitationId = res.body.id;
    expect(invitationId).toBeDefined();

    // Verify it is not active yet
    const inv = await invitationRepo.findOne({ where: { id: invitationId } });
    expect(inv).not.toBeNull();
    expect(inv!.isPublished).toBe(false);
  });

  it('should create a payment transaction (Checkout)', async () => {
    const res = await request(app.getHttpServer())
      .post('/payment/create')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({ invitation_id: invitationId })
      .expect(201);

    expect(res.body.token).toBeDefined();
    expect(res.body.redirect_url).toBeDefined();
    expect(res.body.order_id).toBeDefined();
    expect(res.body.is_free).toBe(false);

    orderId = res.body.order_id;

    // Check if mock was called
    expect(mockSnap.createTransaction).toHaveBeenCalled();
  });

  it('should handle Midtrans Webhook (Success)', async () => {
    const grossAmount = '89000.00';
    const statusCode = '200';

    // Create Signature: SHA512(order_id + status_code + gross_amount + ServerKey)
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

    const res = await request(app.getHttpServer())
      .post('/payment/notification')
      .send(notificationPayload)
      .expect(201);

    // Expect some confirmation
    expect(res.body.message).toBe('Notification received');
    expect(res.body.result.updatedStatus).toBe('success');

    // Verify invitation is now active
    const inv = await invitationRepo.findOne({ where: { id: invitationId } });
    expect(inv).not.toBeNull();
    expect(inv!.isPublished).toBe(true);
  });
});
