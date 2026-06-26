import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  Logger,
  UseGuards,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AdminGuard } from './guards/admin.guard';
import { AdminLogsService } from '../admin-logs/admin-logs.service';
import { AuthAuditService } from './audit/auth-audit.service';
import * as express from 'express';
import { Req } from '@nestjs/common';

@Controller('admin')
export class AdminAuthController {
  private readonly logger = new Logger(AdminAuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly adminLogsService: AdminLogsService,
  ) {}

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() adminLoginDto: AdminLoginDto,
    @Req() req: express.Request,
  ) {
    const redactedEmail = AuthAuditService.redactEmail(adminLoginDto.email);
    this.logger.log(`Admin login attempt for email: ${redactedEmail}`);

    const ipAddress = req.ip;
    const userAgent = req.headers?.['user-agent'];

    const user = await this.authService.validateAdmin(
      adminLoginDto.email,
      adminLoginDto.password,
      ipAddress,
      userAgent,
    );

    if (!user) {
      this.logger.warn(
        `Failed admin login attempt for email: ${redactedEmail}`,
      );

      await this.adminLogsService.createLog(
        undefined,
        'ADMIN_LOGIN_FAILED',
        undefined,
        { email: redactedEmail },
        req,
      );

      throw new UnauthorizedException('Invalid admin credentials');
    }

    this.logger.log(`Successful admin login for email: ${redactedEmail}`);

    await this.adminLogsService.createLog(
      user.id,
      'ADMIN_LOGIN_SUCCESS',
      user.id,
      { email: redactedEmail },
      req,
    );

    return this.authService.login(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        is_admin: user.is_admin,
      },
      ipAddress,
      userAgent,
    );
  }

  /**
   * SW-BE-006: Force-logout a specific user by revoking all their refresh tokens.
   * Preferred over the break-glass DB approach documented in the runbook because
   * the action is recorded in admin_logs.
   *
   * POST /admin/users/:id/revoke-tokens
   */
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('users/:id/revoke-tokens')
  @HttpCode(HttpStatus.OK)
  async revokeUserTokens(
    @Param('id', ParseIntPipe) targetUserId: number,
    @Req() req: express.Request & { user: { id: number } },
  ): Promise<{ message: string; revokedUserId: number }> {
    const ipAddress = req.ip;
    const userAgent = req.headers?.['user-agent'];

    await this.authService.logout(targetUserId, ipAddress, userAgent);

    await this.adminLogsService.createLog(
      req.user.id,
      'ADMIN_FORCE_LOGOUT',
      targetUserId,
      { targetUserId },
      req,
    );

    this.logger.warn(
      `Admin ${req.user.id} force-revoked all sessions for user ${targetUserId}`,
    );

    return { message: 'All sessions revoked', revokedUserId: targetUserId };
  }
}
