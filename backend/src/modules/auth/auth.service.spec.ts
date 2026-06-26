import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { User } from '../users/entities/user.entity';
import { AuthAuditService } from './audit/auth-audit.service';
import { Role } from './enums/role.enum';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

jest.mock('bcrypt');

const makeDbUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 1,
    email: 'player@example.com',
    password: '$2b$10$hashedpassword',
    username: 'player1',
    role: Role.USER,
    is_admin: false,
    is_suspended: false,
    address: '0xabc',
    chain: 'BASE',
    ...overrides,
  }) as User;

describe('AuthService', () => {
  let service: AuthService;
  let usersService: Partial<UsersService>;
  let jwtService: Partial<JwtService>;
  let configService: Partial<ConfigService>;
  let auditService: { record: jest.Mock };
  let refreshTokenRepository: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
  };
  let userRepository: {
    findOne: jest.Mock;
  };

  beforeEach(async () => {
    usersService = {
      findByEmail: jest.fn(),
    };

    jwtService = {
      sign: jest.fn().mockReturnValue('mock-token'),
    };

    configService = {
      get: jest.fn().mockReturnValue(604800),
    };

    refreshTokenRepository = {
      create: jest.fn().mockImplementation((data: unknown) => data),
      save: jest
        .fn()
        .mockImplementation((data: Record<string, unknown>) =>
          Promise.resolve({ id: 'uuid', ...data }),
        ),
      findOne: jest.fn(),
      update: jest.fn(),
    };

    userRepository = {
      findOne: jest.fn(),
    };

    auditService = { record: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: usersService,
        },
        {
          provide: JwtService,
          useValue: jwtService,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: refreshTokenRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: userRepository,
        },
        {
          provide: AuthAuditService,
          useValue: auditService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateUser', () => {
    it('should return user without password if validation succeeds', async () => {
      const hashedPassword = 'hashedpassword';
      const user = {
        id: 1,
        email: 'test@example.com',
        password: hashedPassword,
        role: 'user',
        is_admin: false,
      };
      (usersService.findByEmail as jest.Mock).mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser('test@example.com', 'password');
      expect(result).toEqual({
        id: 1,
        email: 'test@example.com',
        role: 'user',
        is_admin: false,
      });
    });

    it('should return null if password does not match', async () => {
      const user = {
        id: 1,
        email: 'test@example.com',
        password: 'hashedpassword',
        role: 'user',
        is_admin: false,
      };
      (usersService.findByEmail as jest.Mock).mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.validateUser(
        'test@example.com',
        'wrongpassword',
      );
      expect(result).toBeNull();
    });

    it('should return null if user not found', async () => {
      (usersService.findByEmail as jest.Mock).mockResolvedValue(null);

      const result = await service.validateUser(
        'notfound@example.com',
        'password',
      );
      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('should return access and refresh tokens', async () => {
      const user = {
        id: 1,
        email: 'test@example.com',
        role: 'user',
        is_admin: false,
      };

      const result = await service.login(user);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(jwtService.sign).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // SW-BE-006: validateUser — suspended user (runbook §4.2)
  // -------------------------------------------------------------------------

  describe('validateUser — suspended user (SW-BE-006)', () => {
    it('returns null when user is suspended', async () => {
      (usersService.findByEmail as jest.Mock).mockResolvedValue(
        makeDbUser({ is_suspended: true }),
      );

      const result = await service.validateUser(
        'player@example.com',
        'password',
        '1.2.3.4',
        'jest',
      );

      expect(result).toBeNull();
    });

    it('does not call bcrypt.compare for suspended users', async () => {
      (bcrypt.compare as jest.Mock).mockClear();
      (usersService.findByEmail as jest.Mock).mockResolvedValue(
        makeDbUser({ is_suspended: true }),
      );

      await service.validateUser('player@example.com', 'password');

      expect(bcrypt.compare).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // SW-BE-006: validateAdmin
  // -------------------------------------------------------------------------

  describe('validateAdmin (SW-BE-006)', () => {
    it('returns user data when admin credentials are valid', async () => {
      const admin = makeDbUser({ role: Role.ADMIN, is_admin: true });
      (usersService.findByEmail as jest.Mock).mockResolvedValue(admin);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateAdmin(
        'admin@example.com',
        'adminpass',
      );

      expect(result).not.toBeNull();
      expect(result).not.toHaveProperty('password');
      expect(result?.is_admin).toBe(true);
    });

    it('returns null for a non-admin user', async () => {
      (usersService.findByEmail as jest.Mock).mockResolvedValue(
        makeDbUser({ role: Role.USER, is_admin: false }),
      );
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateAdmin('user@example.com', 'pass');

      expect(result).toBeNull();
    });

    it('returns null when password is wrong', async () => {
      (usersService.findByEmail as jest.Mock).mockResolvedValue(
        makeDbUser({ role: Role.ADMIN, is_admin: true }),
      );
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.validateAdmin('admin@example.com', 'wrong');

      expect(result).toBeNull();
    });

    it('returns null for suspended admin', async () => {
      (usersService.findByEmail as jest.Mock).mockResolvedValue(
        makeDbUser({ role: Role.ADMIN, is_admin: true, is_suspended: true }),
      );

      const result = await service.validateAdmin('admin@example.com', 'pass');

      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // SW-BE-006: refreshTokens — token lifecycle (runbook §4.1 / §4.4)
  // -------------------------------------------------------------------------

  describe('refreshTokens (SW-BE-006)', () => {
    const makeToken = (
      overrides: Partial<RefreshToken & { user: User }> = {},
    ) => {
      const raw = 'raw-token-string';
      const hash = crypto.createHash('sha256').update(raw).digest('hex');
      return {
        raw,
        entity: {
          id: 'uuid-1',
          tokenHash: hash,
          userId: 1,
          isRevoked: false,
          expiresAt: new Date(Date.now() + 60_000),
          user: makeDbUser(),
          ...overrides,
        } as RefreshToken & { user: User },
      };
    };

    it('returns new accessToken and refreshToken on valid rotation', async () => {
      const { raw, entity } = makeToken();
      refreshTokenRepository.findOne.mockResolvedValue(entity);
      refreshTokenRepository.save.mockImplementation((e: RefreshToken) =>
        Promise.resolve(e),
      );

      const result = await service.refreshTokens(raw);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('marks the consumed token as revoked during rotation', async () => {
      const { raw, entity } = makeToken();
      refreshTokenRepository.findOne.mockResolvedValue(entity);
      const savedEntities: RefreshToken[] = [];
      refreshTokenRepository.save.mockImplementation((e: RefreshToken) => {
        savedEntities.push({ ...e });
        return Promise.resolve(e);
      });

      await service.refreshTokens(raw);

      const revokedSave = savedEntities.find((e) => e.tokenHash === entity.tokenHash);
      expect(revokedSave?.isRevoked).toBe(true);
    });

    it('throws UnauthorizedException when token is not found', async () => {
      refreshTokenRepository.findOne.mockResolvedValue(null);

      await expect(service.refreshTokens('unknown')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException and revokes all user tokens on replay (runbook §4.1)', async () => {
      const { raw, entity } = makeToken({ isRevoked: true });
      refreshTokenRepository.findOne.mockResolvedValue(entity);

      await expect(service.refreshTokens(raw)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(refreshTokenRepository.update).toHaveBeenCalledWith(
        { userId: entity.userId },
        { isRevoked: true },
      );
    });

    it('throws UnauthorizedException for an expired token (runbook §4.4)', async () => {
      const { raw, entity } = makeToken({
        expiresAt: new Date(Date.now() - 1000),
      });
      refreshTokenRepository.findOne.mockResolvedValue(entity);

      await expect(service.refreshTokens(raw)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // -------------------------------------------------------------------------
  // SW-BE-006: logout — force-revoke all sessions (runbook §4.5)
  // -------------------------------------------------------------------------

  describe('logout (SW-BE-006)', () => {
    it('revokes all non-revoked tokens for the user', async () => {
      await service.logout(42, '1.2.3.4', 'jest');

      expect(refreshTokenRepository.update).toHaveBeenCalledWith(
        { userId: 42, isRevoked: false },
        { isRevoked: true },
      );
    });

    it('does not throw if the user has no active tokens', async () => {
      refreshTokenRepository.update.mockResolvedValue({ affected: 0 });

      await expect(service.logout(99)).resolves.not.toThrow();
    });
  });
});
