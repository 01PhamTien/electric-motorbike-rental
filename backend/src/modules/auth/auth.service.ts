import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Role } from '../../common/enums/role.enum';
import { UsersService } from '../users/users.service';
import { LoginDto, RegisterDto } from './dto';

@Injectable()
export class AuthService {
  constructor(private readonly usersService: UsersService, private readonly jwtService: JwtService) {}

  async register(dto: RegisterDto) {
    const existing = await this.usersService.findByEmailWithPassword(dto.email);
    if (existing) throw new ConflictException('Email đã tồn tại');
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.usersService.create({
      fullName: dto.fullName,
      email: dto.email.toLowerCase(),
      phone: dto.phone || null,
      passwordHash,
      role: Role.CUSTOMER,
    });
    return this.issueToken(user.id, user.email, user.role, user.stationId);
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmailWithPassword(dto.email);
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }
    return this.issueToken(user.id, user.email, user.role, user.stationId);
  }

  private issueToken(sub: number, email: string, role: Role, stationId: number | null) {
    return {
      accessToken: this.jwtService.sign({ sub, email, role, stationId }),
      user: { id: sub, email, role, stationId },
    };
  }
}
