import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PrismaService } from './prisma.service';

test('PrismaService lifecycle hooks connect and disconnect client', async () => {
  const service = new PrismaService();
  let connected = false;
  let disconnected = false;

  service.$connect = async () => {
    connected = true;
  };
  service.$disconnect = async () => {
    disconnected = true;
  };

  await service.onModuleInit();
  await service.onModuleDestroy();

  assert.equal(connected, true);
  assert.equal(disconnected, true);
});
