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
