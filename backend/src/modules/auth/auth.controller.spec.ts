import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { AuthAuditService } from './audit/auth-audit.service';
import { AuthAuditEvent } from './audit/auth-audit.events';
import { CreateUserDto } from '../users/dto/create-user.dto';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: Partial<AuthService>;
  let usersService: Partial<UsersService>;
  let authAudit: Partial<AuthAuditService>;

  beforeEach(async () => {
    authService = {
      login: jest.fn(),
      refreshTokens: jest.fn(),
      walletLogin: jest.fn(),
      logout: jest.fn(),
    };

    usersService = {
      create: jest.fn(),
    };

    authAudit = {
      record: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authService,
        },
        {
          provide: UsersService,
          useValue: usersService,
        },
        {
          provide: AuthAuditService,
          useValue: authAudit,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('should create a user and log REGISTER_SUCCESS', async () => {
      const createUserDto: CreateUserDto = {
        email: 'test@example.com',
        password: 'password',
        firstName: 'Test',
        lastName: 'User',
      };

      const mockUser = {
        id: 1,
        email: 'test@example.com',
        password: 'hashedpassword',
        firstName: 'Test',
        lastName: 'User',
        created_at: new Date(),
        updated_at: new Date(),
      } as any;

      const mockRequest = {
        ip: '127.0.0.1',
        headers: { 'user-agent': 'jest-agent' },
      } as any;

      (usersService.create as jest.Mock).mockResolvedValue(mockUser);

      const result = await controller.register(createUserDto, mockRequest);

      expect(result).toEqual(mockUser);
      expect(usersService.create).toHaveBeenCalledWith(createUserDto);
      expect(authAudit.record).toHaveBeenCalledWith(AuthAuditEvent.REGISTER_SUCCESS, {
        userId: mockUser.id,
        email: AuthAuditService.redactEmail(mockUser.email),
        ipAddress: mockRequest.ip,
        userAgent: mockRequest.headers['user-agent'],
      });
    });
  });
});
