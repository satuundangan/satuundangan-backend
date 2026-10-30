import {
  Body,
  Controller,
  Post,
  Get,
  Req,
  UseGuards,
  Res,
  Query,
  Delete,
  Param,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { Response } from 'express';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { User } from '../user/user.entity';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AdminGuard } from './guards/admin.guard';
import { UserService } from '../user/user.service';
import { AdminSecurityService } from './admin-security.service';
import { TurnstileGuard } from '../common/turnstile/turnstile.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
    private configService: ConfigService,
    private readonly userService: UserService,
    private readonly adminSecurity: AdminSecurityService,
  ) {}

  private readonly logger = new Logger(AuthController.name);

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current user profile' })
  async getProfile(@CurrentUser() user: User) {
    return this.userService.findById(user.id);
  }

  @Post('register')
  @UseGuards(TurnstileGuard)
  @ApiOperation({ summary: 'Register user baru' })
  @ApiBody({ type: RegisterDto })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @UseGuards(TurnstileGuard)
  @ApiOperation({ summary: 'Login user' })
  @ApiBody({ type: LoginDto })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('forgot-password')
  @UseGuards(TurnstileGuard)
  @ApiOperation({ summary: 'Request reset password token' })
  @ApiBody({ type: ForgotPasswordDto })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password using token' })
  @ApiBody({ type: ResetPasswordDto })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Get('verify-email')
  @ApiOperation({ summary: 'Verify email using token' })
  async verifyEmail(@Query('token') token: string, @Res() res: Response) {
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';

    try {
      await this.authService.verifyEmail(token);
      return res.redirect(
        `${frontendUrl}/settings?email_verified=success`,
      );
    } catch {
      return res.redirect(
        `${frontendUrl}/settings?email_verified=failed`,
      );
    }
  }

  @Post('resend-verification')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Resend email verification link' })
  resendVerification(@CurrentUser() user: User) {
    return this.authService.resendEmailVerification(user.id);
  }

  @Post('admin/login')
  @ApiOperation({ summary: 'Admin login (sesi tercatat; TOTP belum diwajibkan saat login)' })
  adminLogin(
    @Body() body: { email: string; password: string; totpCode?: string },
    @Req() req: { headers: Record<string, any>; ip?: string },
  ) {
    const ip = String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim() || null;
    const userAgent = String(req.headers['user-agent'] || '') || null;
    return this.authService.adminLogin(body.email, body.password, body.totpCode, { ip, userAgent });
  }

  @Get('admin/security')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Status TOTP, login terakhir, dan sesi aktif admin' })
  adminSecurityStatus(@CurrentUser() user: User & { sid?: string }) {
    return this.adminSecurity.status(user.id, user.sid);
  }

  @Get('admin/totp/setup')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Generate TOTP secret + QR code untuk admin' })
  setupTotp(@CurrentUser() user: User) {
    return this.authService.setupTotp(user.id);
  }

  @Post('admin/totp/activate')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Aktivasi TOTP setelah scan QR; mengembalikan recovery code sekali tampil' })
  activateTotp(@CurrentUser() user: User, @Body() body: { code: string }) {
    return this.authService.activateTotp(user.id, body.code);
  }

  @Post('admin/totp/disable')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Nonaktifkan TOTP dengan kode atau recovery code' })
  disableTotp(@CurrentUser() user: User, @Body() body: { code?: string; recoveryCode?: string }) {
    return this.adminSecurity.disable(user.id, body);
  }

  @Post('admin/totp/recovery-codes')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Buat ulang recovery code (kode lama tidak berlaku)' })
  regenerateRecoveryCodes(@CurrentUser() user: User, @Body() body: { code?: string; recoveryCode?: string }) {
    return this.adminSecurity.regenerateRecoveryCodes(user.id, body);
  }

  @Delete('admin/sessions/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Cabut satu sesi admin milik sendiri' })
  revokeSession(@CurrentUser() user: User, @Param('id') id: string) {
    return this.adminSecurity.revokeSession(user.id, id);
  }

  @Post('admin/sessions/revoke-others')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Cabut semua sesi admin lain milik sendiri' })
  revokeOtherSessions(@CurrentUser() user: User & { sid?: string }) {
    return this.adminSecurity.revokeOtherSessions(user.id, user.sid);
  }

  @Get('test-log')
  testLog() {
    console.log('--- INI ADALAH LOG DARI CONSOLE.LOG ---');
    this.logger.log('--- INI ADALAH LOG DARI NESTJS LOGGER ---');
    this.logger.error('--- INI ADALAH LOG ERROR ---');
    return { message: 'Log test endpoint has been called!' };
  }

  @Get('google')
  @ApiOperation({ summary: 'Login dengan Google' })
  @UseGuards(AuthGuard('google'))
  async googleAuth(@Req() req) {}

  @Get('google/redirect')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Req() req, @Res() res: Response) {
    const user = req.user as User;

    //console.log('HIT googleAuthRedirect route');
    //console.log('req.user:', req.user);

    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    if (!user) {
      const errorUrl = this.configService.get<string>('FRONTEND_URL');
      return res.redirect(`${errorUrl}/?error=login_failed`);
    }

    const token = this.jwtService.sign({ sub: user.id, email: user.email });

    return res.redirect(`${frontendUrl}/auth/callback?token=${token}`);
  }
}
