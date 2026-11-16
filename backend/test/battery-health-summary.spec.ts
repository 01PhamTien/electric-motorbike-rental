import 'reflect-metadata';
import assert = require('node:assert/strict');
import test = require('node:test');
import { BatteryHealthService } from '../src/modules/batteries/battery-health.service';
import { Role } from '../src/common/enums/role.enum';
function serviceFor(rows: any[]) {
  const calls: any[] = [];
  const qb: any = {
    leftJoinAndSelect: (...args: any[]) => { calls.push(['join', ...args]); return qb; },
    andWhere: (...args: any[]) => { calls.push(['where', ...args]); return qb; },
    orderBy: (...args: any[]) => { calls.push(['orderBy', ...args]); return qb; },
    addOrderBy: (...args: any[]) => { calls.push(['addOrderBy', ...args]); return qb; },
    getMany: async () => rows,
  };
  const dataSource: any = { getRepository: () => ({ createQueryBuilder: () => qb }) };
  return { service: new BatteryHealthService(dataSource, { record: async () => undefined } as any), calls };
}
test('unmeasured battery health is classified as UNKNOWN, not healthy', async () => {
  const { service } = serviceFor([
    { id: 1, status: 'FULL', healthPercent: null, cycleCount: 0 },
    { id: 2, status: 'FULL', healthPercent: 92, cycleCount: 12 },
    { id: 3, status: 'FULL', healthPercent: 60, cycleCount: 30 },
    { id: 4, status: 'RETIRED', healthPercent: null, cycleCount: 0 },
  ]);
  const result = await service.summary({ sub: 1, role: Role.ADMIN, stationId: null } as any);
  assert.equal(result.total, 4); assert.equal(result.unknown, 1); assert.equal(result.healthy, 1);
  assert.equal(result.critical, 1); assert.equal(result.retired, 1);
  assert.equal(result.batteries[0].healthLevel, 'UNKNOWN');
});
test('unassigned staff receives an empty health summary', async () => {
  const { service, calls } = serviceFor([]);
  const result = await service.summary({ sub: 5, role: Role.STAFF, stationId: null } as any);
  assert.equal(result.total, 0); assert.equal(result.unknown, 0); assert.equal(calls.length, 0);
});