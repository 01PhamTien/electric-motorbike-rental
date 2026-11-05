import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './audit-log.entity';

@Injectable()
export class AuditService {
  constructor(@InjectRepository(AuditLog) private readonly repo: Repository<AuditLog>) {}
  async record(actorId: number | null, action: string, targetType: string, targetId: number | null, details?: unknown) {
    return this.repo.save(this.repo.create({ actorId, action, targetType, targetId,
      details: details === undefined ? null : JSON.stringify(details) }));
  }
  list(limit = 100) { return this.repo.find({ order: { createdAt: 'DESC' }, take: Math.min(Math.max(limit, 1), 200) }); }

  async listShifts(filters: { from?: string; to?: string; staffId?: number; stationId?: number; limit?: number }) {
    const query = this.repo.createQueryBuilder('log')
      .leftJoinAndSelect('log.actor', 'actor')
      .leftJoinAndSelect('actor.station', 'station')
      .where('log.targetType = :targetType', { targetType: 'SHIFT' })
      .orderBy('log.createdAt', 'DESC')
      .addOrderBy('log.id', 'DESC')
      .take(Math.min(Math.max(filters.limit || 100, 1), 200));

    if (filters.from) query.andWhere('log.createdAt >= :from', { from: new Date(filters.from + 'T00:00:00.000Z') });
    if (filters.to) query.andWhere('log.createdAt < :to', { to: new Date(new Date(filters.to + 'T00:00:00.000Z').getTime() + 86_400_000) });
    if (filters.staffId) query.andWhere('log.actorId = :staffId', { staffId: filters.staffId });
    if (filters.stationId) query.andWhere('actor.stationId = :stationId', { stationId: filters.stationId });
    return query.getMany();
  }

  async getMyShift(actorId: number) {
    const latest = await this.repo.findOne({
      where: { actorId, targetType: 'SHIFT' },
      order: { createdAt: 'DESC', id: 'DESC' },
    });
    return { active: latest?.action === 'SHIFT_STARTED', latest };
  }

  async recordShift(actorId: number, action: 'SHIFT_STARTED' | 'SHIFT_ENDED', details: unknown) {
    const state = await this.getMyShift(actorId);
    if (action === 'SHIFT_STARTED' && state.active) {
      throw new BadRequestException('Bạn đang có ca làm việc chưa kết thúc.');
    }
    if (action === 'SHIFT_ENDED' && !state.active) {
      throw new BadRequestException('Bạn chưa bắt đầu ca làm việc hoặc ca đã kết thúc.');
    }
    const saved = await this.record(actorId, action, 'SHIFT', null, details);
    return { active: action === 'SHIFT_STARTED', latest: saved };
  }
}
