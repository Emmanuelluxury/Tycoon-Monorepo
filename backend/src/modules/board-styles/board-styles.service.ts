import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BoardStyle } from './entities/board-style.entity';
import { CreateBoardStyleDto } from './dto/create-board-style.dto';
import { UpdateBoardStyleDto } from './dto/update-board-style.dto';
import { RedisService } from '../redis/redis.service';
import { LoggerService } from '../../common/logger/logger.service';

@Injectable()
export class BoardStylesService {
  constructor(
    @InjectRepository(BoardStyle)
    private readonly boardStyleRepository: Repository<BoardStyle>,
    private readonly redisService: RedisService,
    private readonly logger: LoggerService,
  ) {}

  async create(createBoardStyleDto: CreateBoardStyleDto): Promise<BoardStyle> {
    const startTime = Date.now();
    try {
      const style = this.boardStyleRepository.create(createBoardStyleDto);
      const saved = await this.boardStyleRepository.save(style);
      const duration = Date.now() - startTime;

      this.logger.logWithMeta('info', 'Board style created', {
        styleId: saved.id,
        isPremium: saved.is_premium,
        duration,
        context: 'BoardStylesService',
      });

      await this.invalidateCache();
      return saved;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `Failed to create board style: ${(error as Error).message}`,
        (error as Error).stack,
        'BoardStylesService.create'
      );
      throw error;
    }
  }

  async findAll(isPremium?: boolean): Promise<BoardStyle[]> {
    try {
      const qb = this.boardStyleRepository.createQueryBuilder('board_style');

      if (isPremium !== undefined) {
        qb.andWhere('board_style.is_premium = :isPremium', { isPremium });
      }

      qb.orderBy('board_style.created_at', 'DESC');
      const styles = await qb.getMany();

      this.logger.logWithMeta('debug', 'Board styles fetched', {
        count: styles.length,
        isPremiumFilter: isPremium,
        context: 'BoardStylesService',
      });

      return styles;
    } catch (error) {
      this.logger.error(
        `Failed to fetch board styles: ${(error as Error).message}`,
        (error as Error).stack,
        'BoardStylesService.findAll'
      );
      throw error;
    }
  }

  async findOne(id: number): Promise<BoardStyle> {
    try {
      const style = await this.boardStyleRepository.findOne({ where: { id } });
      if (!style) {
        this.logger.logWithMeta('warn', 'Board style not found', {
          styleId: id,
          context: 'BoardStylesService',
        });
        throw new NotFoundException(`Board style with ID ${id} not found`);
      }

      this.logger.logWithMeta('debug', 'Board style retrieved', {
        styleId: id,
        context: 'BoardStylesService',
      });
      return style;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        `Failed to fetch board style ${id}: ${(error as Error).message}`,
        (error as Error).stack,
        'BoardStylesService.findOne'
      );
      throw error;
    }
  }

  async update(
    id: number,
    updateBoardStyleDto: UpdateBoardStyleDto,
  ): Promise<BoardStyle> {
    const startTime = Date.now();
    try {
      const style = await this.findOne(id);
      const updatedStyle = this.boardStyleRepository.merge(
        style,
        updateBoardStyleDto,
      );
      const saved = await this.boardStyleRepository.save(updatedStyle);
      const duration = Date.now() - startTime;

      this.logger.logWithMeta('info', 'Board style updated', {
        styleId: id,
        duration,
        context: 'BoardStylesService',
      });

      await this.invalidateCache(id);
      return saved;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `Failed to update board style ${id}: ${(error as Error).message}`,
        (error as Error).stack,
        'BoardStylesService.update'
      );
      throw error;
    }
  }

  async remove(id: number): Promise<void> {
    const startTime = Date.now();
    try {
      const style = await this.findOne(id);
      await this.boardStyleRepository.remove(style);
      const duration = Date.now() - startTime;

      this.logger.logWithMeta('info', 'Board style deleted', {
        styleId: id,
        duration,
        context: 'BoardStylesService',
      });

      await this.invalidateCache(id);
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `Failed to delete board style ${id}: ${(error as Error).message}`,
        (error as Error).stack,
        'BoardStylesService.remove'
      );
      throw error;
    }
  }

  private async invalidateCache(id?: number) {
    try {
      await this.redisService.delByPattern('tycoon:board-styles:board-styles:*');
      if (id) {
        await this.redisService.delByPattern(
          `tycoon:board-styles:board-styles:${id}:*`,
        );
      }
      this.logger.logWithMeta('debug', 'Board styles cache invalidated', {
        styleId: id,
        context: 'BoardStylesService',
      });
    } catch (error) {
      this.logger.warn(
        `Failed to invalidate board styles cache: ${(error as Error).message}`,
        'BoardStylesService.invalidateCache'
      );
    }
  }
}
