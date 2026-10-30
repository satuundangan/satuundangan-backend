import {
  Injectable,
  HttpException,
  HttpStatus,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user/user.entity';
import { MessageDto } from './dto/chat.dto';
import { AiCreditLog } from './ai-credit-log.entity';

export interface AdminAiLogsQuery {
  status?: string;
  userId?: number;
  page?: number;
  limit?: number;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private configService: ConfigService,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(AiCreditLog)
    private creditLogRepo: Repository<AiCreditLog>,
  ) {}

  async getCredits(userId: number): Promise<{ credits: number }> {
    const user = await this.userRepo.findOneOrFail({ where: { id: userId } });
    return { credits: user.aiCredits };
  }

  async recordCreditLog(dto: Partial<AiCreditLog>): Promise<AiCreditLog> {
    const log = this.creditLogRepo.create({
      userId: dto.userId!,
      action: dto.action || 'deduct',
      feature: dto.feature || 'nova_assistant',
      creditsChange: dto.creditsChange ?? 0,
      creditsBalance: dto.creditsBalance ?? 0,
      status: dto.status || 'success',
      model: dto.model || 'deepseek-v4-flash',
      promptTokens: dto.promptTokens || 0,
      completionTokens: dto.completionTokens || 0,
      totalTokens: dto.totalTokens || 0,
      estimatedCostIdr: dto.estimatedCostIdr || 0,
      errorMessage: dto.errorMessage || null,
    });
    return this.creditLogRepo.save(log);
  }

  async chat(
    userId: number,
    messages: MessageDto[],
    currentData: Record<string, any> = {},
  ) {
    const user = await this.userRepo.findOneOrFail({ where: { id: userId } });

    const isFirstMessage =
      messages.filter((m) => m.role === 'user').length === 1;

    let creditDeducted = 0;
    if (isFirstMessage) {
      if (user.aiCredits < 1) {
        throw new HttpException(
          'Kredit Nova habis. Silakan beli paket kredit untuk melanjutkan.',
          HttpStatus.PAYMENT_REQUIRED,
        );
      }
      user.aiCredits -= 1;
      creditDeducted = -1;
      await this.userRepo.save(user);
      this.logger.log(
        `AI credit deducted userId=${userId} remaining=${user.aiCredits}`,
      );
    }

    const apiKey = this.configService.get<string>('DEEPSEEK_API_KEY');
    if (!apiKey) {
      throw new BadRequestException('DeepSeek API key not configured');
    }

    const systemPrompt = this.buildSystemPrompt(currentData);

    let response: Response;
    try {
      response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'deepseek-v4-flash',
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages.map((m) => ({ role: m.role, content: m.content })),
          ],
          response_format: { type: 'json_object' },
          max_tokens: 600,
          stream: false,
        }),
      });
    } catch (err: any) {
      this.logger.error(`DeepSeek API network error: ${err?.message || err}`);
      await this.recordCreditLog({
        userId,
        action: 'deduct',
        feature: 'nova_assistant',
        creditsChange: creditDeducted,
        creditsBalance: user.aiCredits,
        status: 'failed',
        model: 'deepseek-v4-flash',
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        estimatedCostIdr: 0,
        errorMessage: String(err?.message || err),
      });

      return {
        updatedData: currentData,
        message: 'Nova sedang sibuk sebentar. Coba lagi ya! 🙏',
        creditsRemaining: user.aiCredits,
      };
    }

    if (!response.ok) {
      const err = await response.text();
      this.logger.error(`DeepSeek API error: ${err}`);
      await this.recordCreditLog({
        userId,
        action: 'deduct',
        feature: 'nova_assistant',
        creditsChange: creditDeducted,
        creditsBalance: user.aiCredits,
        status: 'failed',
        model: 'deepseek-v4-flash',
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        estimatedCostIdr: 0,
        errorMessage: err,
      });

      return {
        updatedData: currentData,
        message: 'Nova sedang sibuk sebentar. Coba lagi ya! 🙏',
        creditsRemaining: user.aiCredits,
      };
    }

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);

    const promptTokens = data.usage?.prompt_tokens || 0;
    const completionTokens = data.usage?.completion_tokens || 0;
    const totalTokens =
      data.usage?.total_tokens || promptTokens + completionTokens;
    // DeepSeek V3/V4 IDR pricing: promptTokens * 0.0022 + completionTokens * 0.0044
    const estimatedCostIdr =
      promptTokens * 0.0022 + completionTokens * 0.0044;

    await this.recordCreditLog({
      userId,
      action: 'deduct',
      feature: 'nova_assistant',
      creditsChange: creditDeducted,
      creditsBalance: user.aiCredits,
      status: 'success',
      model: 'deepseek-v4-flash',
      promptTokens,
      completionTokens,
      totalTokens,
      estimatedCostIdr,
      errorMessage: null,
    });

    return {
      ...result,
      creditsRemaining: user.aiCredits,
    };
  }

  async getAdminStats() {
    const logs = await this.creditLogRepo.find();

    let totalCreditsPurchased = 0;
    let totalCreditsUsed = 0;
    let totalEstimatedCostIdr = 0;
    let successfulRequests = 0;
    let failedRequests = 0;
    const activeUserSet = new Set<number>();

    for (const log of logs) {
      if (log.userId) {
        activeUserSet.add(log.userId);
      }
      if (log.action === 'topup' && log.status === 'success') {
        totalCreditsPurchased += Math.max(0, log.creditsChange);
      }
      if (log.action === 'deduct') {
        totalCreditsUsed += Math.abs(log.creditsChange);
      }
      totalEstimatedCostIdr += Number(log.estimatedCostIdr) || 0;
      if (log.status === 'success') {
        successfulRequests++;
      } else {
        failedRequests++;
      }
    }

    return {
      totalCreditsPurchased,
      totalCreditsUsed,
      totalEstimatedCostIdr: Math.round(totalEstimatedCostIdr * 100) / 100,
      totalRequests: logs.length,
      successfulRequests,
      failedRequests,
      activeUsersCount: activeUserSet.size,
    };
  }

  async getAdminLogs(query: AdminAiLogsQuery = {}) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));

    const qb = this.creditLogRepo.createQueryBuilder('log');

    if (query.status) {
      qb.andWhere('log.status = :status', { status: query.status });
    }

    if (query.userId) {
      qb.andWhere('log.userId = :userId', { userId: Number(query.userId) });
    }

    qb.orderBy('log.createdAt', 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  private buildSystemPrompt(currentData: Record<string, any>): string {
    return `Kamu adalah Nova, AI Wedding Invitation Assistant dari satuundangan.id.
Bantu user buat undangan pernikahan digital melalui chat yang hangat dan natural dalam Bahasa Indonesia.

DATA UNDANGAN SAAT INI:
${JSON.stringify(currentData)}

FIELD YANG PERLU DIKUMPULKAN (tanyakan satu per satu, urut dari atas):
- groomName: nama lengkap mempelai pria
- brideName: nama lengkap mempelai wanita
- groomParents: nama orang tua mempelai pria (contoh: "Bapak Ahmad & Ibu Sari")
- brideParents: nama orang tua mempelai wanita
- akadDateTime: tanggal & jam akad (format ISO 8601, contoh: "2024-06-10T09:00:00")
- akadLocation: nama & alamat tempat akad
- resepsiDateTime: tanggal & jam resepsi (kosong jika sama dengan akad)
- resepsiLocation: nama & alamat tempat resepsi
- loveStory: cerita singkat dari user, Nova kembangkan jadi narasi romantis 2-3 kalimat
- quoteText: quote atau ayat favorit (opsional, user boleh skip)

ATURAN:
1. Tanyakan satu hal per giliran, jangan semua sekaligus.
2. Mulai dengan menanyakan nama mempelai pria dan wanita.
3. Setelah groomName, brideName, akadDateTime, dan akadLocation sudah terisi → set isComplete: true.
4. Balas dengan hangat dan semangat, gunakan emoji secukupnya.
5. HANYA kembalikan raw JSON tanpa markdown:
   {"updatedData": {...data yang sudah diupdate}, "message": "balasan Nova", "isComplete": false}`;
  }
}
