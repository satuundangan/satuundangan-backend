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

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private configService: ConfigService,
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  async getCredits(userId: number): Promise<{ credits: number }> {
    const user = await this.userRepo.findOneOrFail({ where: { id: userId } });
    return { credits: user.aiCredits };
  }

  async chat(
    userId: number,
    messages: MessageDto[],
    currentData: Record<string, any> = {},
  ) {
    const user = await this.userRepo.findOneOrFail({ where: { id: userId } });

    const isFirstMessage =
      messages.filter((m) => m.role === 'user').length === 1;

    if (isFirstMessage) {
      if (user.aiCredits < 1) {
        throw new HttpException(
          'Kredit Nova habis. Silakan beli paket kredit untuk melanjutkan.',
          HttpStatus.PAYMENT_REQUIRED,
        );
      }
      user.aiCredits -= 1;
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

    const response = await fetch('https://api.deepseek.com/chat/completions', {
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

    if (!response.ok) {
      const err = await response.text();
      this.logger.error(`DeepSeek API error: ${err}`);
      return {
        updatedData: currentData,
        message: 'Nova sedang sibuk sebentar. Coba lagi ya! 🙏',
        creditsRemaining: user.aiCredits,
      };
    }

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);

    return {
      ...result,
      creditsRemaining: user.aiCredits,
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
