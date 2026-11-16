export interface LegacyBaselineInspection {
  applicationTableCount: number;
  migrationHistoryRows: number;
  entityDriftCount: number;
}

export type LegacyBaselineInspectionResult = 'EMPTY_DATABASE' | 'ENTITY_METADATA_MATCH_ONLY';

/**
 * Fail-closed checks for the read-only legacy baseline preflight.
 * An entity metadata match is never authorization to adopt a database.
 */
export function inspectLegacyBaseline(input: LegacyBaselineInspection): LegacyBaselineInspectionResult {
  if (!Number.isSafeInteger(input.applicationTableCount) || input.applicationTableCount < 0) {
    throw new Error('Invalid application table count returned by SQL Server.');
  }
  if (!Number.isSafeInteger(input.migrationHistoryRows) || input.migrationHistoryRows < 0) {
    throw new Error('Invalid migration history count returned by SQL Server.');
  }
  if (!Number.isSafeInteger(input.entityDriftCount) || input.entityDriftCount < 0) {
    throw new Error('Invalid entity schema drift count returned by TypeORM.');
  }

  if (input.applicationTableCount === 0) return 'EMPTY_DATABASE';
  if (input.migrationHistoryRows > 0) {
    throw new Error('Existing migration history was found. Refusing legacy baseline inspection; do not rewrite or supplement recorded migration history.');
  }
  if (input.entityDriftCount > 0) {
    throw new Error('Schema differs from TypeORM entity metadata. No changes were made.');
  }

  return 'ENTITY_METADATA_MATCH_ONLY';
}
