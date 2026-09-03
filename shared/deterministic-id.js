/**
 * Stable, Postgres-uuid-shaped ids derived from a string seed.
 *
 * This lives in plain JavaScript, outside `src/`, on purpose: the same
 * function has to produce byte-identical ids from the TypeScript app (which
 * builds the in-memory curriculum) and from `scripts/seed.mjs` (which writes
 * that curriculum to Postgres). If the two ever disagree, every foreign key
 * in the seeded database is wrong.
 *
 * Keep this file dependency-free and side-effect-free.
 */

/**
 * FNV-1a, run four times with a different offset each round to fill 16 bytes,
 * then formatted as a version-4-shaped uuid.
 *
 * @param {string} seed
 * @returns {string} uuid-shaped string
 */
export function deterministicId(seed) {
  const bytes = [];
  for (let round = 0; round < 4; round += 1) {
    let h = 0x811c9dc5 ^ round * 0x01000193;
    for (let i = 0; i < seed.length; i += 1) {
      h ^= seed.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    for (let k = 0; k < 4; k += 1) {
      bytes.push((h >>> (k * 8)) & 0xff);
    }
  }
  const hex = bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Every id seed the curriculum uses, in one place, so the app and the seed
 * script cannot drift apart. `topicCode` is the authored code, already
 * unit-prefixed ("1.2" inside unit 1) — do not prefix it again.
 */
export const seeds = {
  course: (slug) => `course:${slug}`,
  unit: (slug, unitCode) => `${slug}:unit:${unitCode}`,
  topic: (slug, topicCode) => `${slug}:topic:${topicCode}`,
  lesson: (slug, topicCode) => `${slug}:${topicCode}:lesson`,
  question: (slug, topicCode, index) => `${slug}:q:${topicCode}:${index}`,
  video: (slug, topicCode, index) => `${slug}:${topicCode}:video:${index}`,
};
