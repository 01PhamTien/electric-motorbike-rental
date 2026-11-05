import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Notification } from './notification.entity';

@Injectable()
export class NotificationsService {
  constructor(@InjectRepository(Notification) private readonly repo: Repository<Notification>) {}

  async create(userId: number, type: string, title: string, message: string, relatedBookingId?: number) {
    return this.repo.save(this.repo.create({ userId, type, title, message, relatedBookingId: relatedBookingId ?? null, readAt: null }));
  }

  listMine(userId: number) {
    return this.repo.find({ where: { userId }, order: { createdAt: 'DESC' }, take: 100 });
  }

  unreadCount(userId: number) {
    return this.repo.count({ where: { userId, readAt: IsNull() } });
  }

  async markRead(userId: number, id: number) {
    const item = await this.repo.findOne({ where: { id, userId } });
    if (!item) throw new NotFoundException('Không tìm thấy thông báo');
    if (!item.readAt) { item.readAt = new Date(); await this.repo.save(item); }
    return item;
  }

  async markAllRead(userId: number) {
    await this.repo.createQueryBuilder().update(Notification).set({ readAt: new Date() })
      .where('userId = :userId AND readAt IS NULL', { userId }).execute();
    return { success: true };
  }
}
