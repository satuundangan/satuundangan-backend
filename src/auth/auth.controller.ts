import {
  Body,
  Controller,
  Post,
  Get,
  Req,
  UseGuards,
  Res,
  Query,
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

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
    private configService: ConfigService,
    private readonly userService: UserService,
  ) {}

  private readonly logger = new Logger(AuthController.name);

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current user profile' })
  async getProfile(@CurrentUser() user: User) {
    return this.userService.findById(user.id);
  }

  @Post('register')
  @ApiOperation({ summary: 'Register user baru' })
  @ApiBody({ type: RegisterDto })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @ApiOperation({ summary: 'Login user' })
  @ApiBody({ type: LoginDto })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('forgot-password')
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
  @ApiOperation({ summary: 'Admin login dengan TOTP' })
  adminLogin(@Body() body: { email: string; password: string; totpCode?: string }) {
    return this.authService.adminLogin(body.email, body.password, body.totpCode);
  }

  @Get('admin/totp/setup')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Generate TOTP secret + QR code untuk admin' })
  setupTotp(@CurrentUser() user: User) {
    return this.authService.setupTotp(user.id);
  }

  @Post('admin/totp/activate')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Aktivasi TOTP setelah scan QR' })
  activateTotp(@CurrentUser() user: User, @Body() body: { code: string }) {
    return this.authService.activateTotp(user.id, body.code);
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
