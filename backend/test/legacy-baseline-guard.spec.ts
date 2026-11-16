import assert = require('node:assert/strict');
import test = require('node:test');
import { inspectLegacyBaseline } from '../src/database/legacy-baseline-guard';

test('empty database remains on the normal migration path', () => {
  assert.equal(inspectLegacyBaseline({
    applicationTableCount: 0,
    migrationHistoryRows: 0,
    entityDriftCount: 0,
  }), 'EMPTY_DATABASE');
});

test('refuses a database with existing migration history', () => {
  assert.throws(() => inspectLegacyBaseline({
    applicationTableCount: 12,
    migrationHistoryRows: 3,
    entityDriftCount: 0,
  }), /Existing migration history/);
});

test('refuses a schema that differs from entity metadata', () => {
  assert.throws(() => inspectLegacyBaseline({
    applicationTableCount: 12,
    migrationHistoryRows: 0,
    entityDriftCount: 2,
  }), /Schema differs/);
});

test('entity metadata match is diagnostic only, never adoption approval', () => {
  assert.equal(inspectLegacyBaseline({
    applicationTableCount: 12,
    migrationHistoryRows: 0,
    entityDriftCount: 0,
  }), 'ENTITY_METADATA_MATCH_ONLY');
});

test('rejects invalid inspection counts', () => {
  assert.throws(() => inspectLegacyBaseline({
    applicationTableCount: -1,
    migrationHistoryRows: 0,
    entityDriftCount: 0,
  }), /Invalid application table count/);
});
