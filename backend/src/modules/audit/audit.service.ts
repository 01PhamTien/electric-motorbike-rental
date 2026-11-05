import { Injectable } from '@nestjs/common';
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
}
