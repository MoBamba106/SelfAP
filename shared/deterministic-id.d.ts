/** Type surface for the shared id module. See `deterministic-id.js`. */

/** Stable, Postgres-uuid-shaped id derived from a string seed. */
export declare function deterministicId(seed: string): string;

/** Every id seed the curriculum uses, so the app and seed script cannot drift. */
export declare const seeds: {
  course: (slug: string) => string;
  unit: (slug: string, unitCode: string) => string;
  topic: (slug: string, topicCode: string) => string;
  lesson: (slug: string, topicCode: string) => string;
  question: (slug: string, topicCode: string, index: number) => string;
  video: (slug: string, topicCode: string, index: number) => string;
};
