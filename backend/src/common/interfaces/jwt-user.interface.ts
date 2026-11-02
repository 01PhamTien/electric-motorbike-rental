import { Role } from '../enums/role.enum';

export interface JwtUser {
  sub: number;
  email: string;
  role: Role;
  stationId: number | null;
}
