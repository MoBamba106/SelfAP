import { describe, expect, it } from 'vitest';
import { deterministicId, seeds } from '../shared/deterministic-id.js';

/**
 * These ids are the join between the in-memory curriculum the app builds and
 * the rows `scripts/seed.mjs` writes. If the function or the seed strings ever
 * change, every foreign key in a seeded database breaks — so the values are
 * pinned here rather than merely checked for shape.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/;

describe('deterministicId', () => {
  it('is stable across calls', () => {
    expect(deterministicId('course:ap-statistics')).toBe(
      deterministicId('course:ap-statistics'),
    );
  });

  it('produces a version-4-shaped uuid', () => {
    expect(deterministicId('course:ap-statistics')).toMatch(UUID);
  });

  it('gives different seeds different ids', () => {
    expect(deterministicId('a')).not.toBe(deterministicId('b'));
  });

  it('matches the values the app and seed script already depend on', () => {
    expect(deterministicId('course:ap-statistics')).toBe(
      '110d3450-1237-4344-ab71-67072c4a9ae6',
    );
    expect(deterministicId('ap-statistics:topic:1.2')).toBe(
      '7095fe3a-b9f0-46ef-a235-a98a73096553',
    );
    expect(deterministicId('ap-statistics:1.2:lesson')).toBe(
      'edf54562-5aa2-401b-a3d7-5cfba88e30b4',
    );
  });
});

describe('seeds', () => {
  it('builds the exact strings the curriculum loader uses', () => {
    expect(seeds.course('ap-statistics')).toBe('course:ap-statistics');
    expect(seeds.unit('ap-statistics', '1')).toBe('ap-statistics:unit:1');
    expect(seeds.topic('ap-statistics', '1.2')).toBe('ap-statistics:topic:1.2');
    expect(seeds.lesson('ap-statistics', '1.2')).toBe('ap-statistics:1.2:lesson');
    expect(seeds.question('ap-statistics', '1.2', 3)).toBe('ap-statistics:q:1.2:3');
    expect(seeds.video('ap-statistics', '1.2', 0)).toBe('ap-statistics:1.2:video:0');
  });

  it('keeps unit, topic and lesson ids distinct for the same code', () => {
    const ids = new Set([
      deterministicId(seeds.unit('c', '1')),
      deterministicId(seeds.topic('c', '1')),
      deterministicId(seeds.lesson('c', '1')),
    ]);
    expect(ids.size).toBe(3);
  });
});
