import stats from '../../content/courses/ap-statistics.json';
import gov from '../../content/courses/ap-us-government-and-politics.json';
import lang from '../../content/courses/ap-english-language-and-composition.json';
import lit from '../../content/courses/ap-english-literature-and-composition.json';
import psych from '../../content/courses/ap-psychology.json';

/* ------------------------------------------------------------------ *
 * Curriculum content is authored as JSON in /content and loaded here
 * once. The same files are read by scripts/seed.mjs to push the
 * curriculum into Postgres, so there is a single source of truth:
 *
 *   add a course  →  drop a JSON file in /content/courses
 *   add a unit    →  append to `units`
 *   add a topic   →  append to `topics`, optionally with `lesson`
 *
 * Nothing in the app is hard-coded to a particular AP subject.
 * ------------------------------------------------------------------ */

export type BlockKind = 'example' | 'warning' | 'mistake' | 'note';

export type ContentBlock =
  | { type: 'p'; text: string }
  | { type: 'h'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'callout'; kind: BlockKind; label: string; text: string }
  | { type: 'formula'; label: string; expression: string }
  | { type: 'table'; head: string[]; rows: string[][] };

export interface LessonVideo {
  id: string;
  lessonId: string;
  provider: 'youtube' | 'vimeo' | 'khan' | 'selfap' | 'external';
  videoId: string;
  title: string;
  durationSeconds: number;
  attribution: string;
  externalUrl: string;
  embeddable: boolean;
  thumbnailUrl: string;
  position: number;
}

export interface Lesson {
  id: string;
  topicId: string;
  courseId: string;
  title: string;
  summary: string;
  objectives: string[];
  body: ContentBlock[];
  vocabulary: { term: string; definition: string }[];
  formulas: { label: string; expression: string }[];
  mistakes: string[];
  review: string[];
  minutes: number;
  /** True when the topic ships an outline rather than a fully written lesson. */
  draft: boolean;
  position: number;
}

export type QuestionKind = 'mcq' | 'short-answer' | 'frq' | 'self-check';

export interface PracticeQuestion {
  id: string;
  topicId: string;
  courseId: string;
  /** Owning topic code, e.g. "1.4" — keeps practice UIs free of extra lookups. */
  topicCode: string;
  kind: QuestionKind;
  prompt: string;
  choices: string[];
  answer: unknown;
  explanation: string;
  difficulty: number;
  timeLimitSeconds: number;
  original: boolean;
  position: number;
}

export interface Topic {
  id: string;
  unitId: string;
  courseId: string;
  code: string;
  title: string;
  summary: string;
  keyIdeas: string[];
  position: number;
  lesson: Lesson | null;
  questions: PracticeQuestion[];
}

export interface Unit {
  id: string;
  courseId: string;
  code: string;
  title: string;
  summary: string;
  examWeight: string;
  position: number;
  topics: Topic[];
}

export interface ExamSection {
  name: string;
  count: string;
  time: string;
  weight: string;
}

export interface ExamFrq {
  label: string;
  title: string;
  kind?: string;
  minutes?: number;
  prompt?: string;
  rubric?: string[];
}

export interface ReferenceGroup {
  group: string;
  entries: { term: string; expression: string }[];
}

export interface SuggestedWork {
  title: string;
  author: string;
  form: string;
  why: string;
}

export interface Course {
  id: string;
  slug: string;
  code: string;
  shortName: string;
  tagline: string;
  description: string;
  subject: string;
  accent: string;
  exam: {
    date: string | null;
    provisional: boolean;
    durationMinutes: number | null;
    summary: string;
    sections: ExamSection[];
    frqs: ExamFrq[];
  };
  tools: string[];
  reference: ReferenceGroup[];
  suggestedWorks: SuggestedWork[] | null;
  worksNote: string;
  externalResources: { label: string; url: string; kind: string }[];
  units: Unit[];
  /** Flattened topic list, in curriculum order. */
  topics: Topic[];
  topicCount: number;
  lessonCount: number;
}

/* Ids come from a shared plain-JS module so the app and `scripts/seed.mjs`
 * cannot drift: the same seed must yield the same uuid in both, or every
 * foreign key in the seeded database is wrong. */
export { deterministicId, seeds as idSeeds } from '../../shared/deterministic-id.js';
import { deterministicId, seeds as idSeeds } from '../../shared/deterministic-id.js';

type RawTopic = {
  code: string;
  title: string;
  summary: string;
  keyIdeas?: string[];
  lesson?: Record<string, unknown>;
  questions?: Record<string, unknown>[];
};

function buildLesson(courseSlug: string, topic: Topic, raw: RawTopic | null): Lesson | null {
  const authored = raw?.lesson as Record<string, unknown> | undefined;

  // Topics without an authored lesson still get a usable page: their key
  // ideas become objectives and the summary becomes the body. The lesson is
  // flagged as a draft so the UI says so honestly instead of pretending.
  const body: ContentBlock[] = authored
    ? ((authored.body as ContentBlock[]) ?? [])
    : [
        { type: 'p', text: topic.summary },
        { type: 'h', text: 'What to be able to do' },
        { type: 'ul', items: topic.keyIdeas.length ? topic.keyIdeas : [topic.summary] },
      ];

  if (!authored && body.length) {
    body.push({
      type: 'callout',
      kind: 'note',
      label: 'Outline',
      text:
        'This topic ships as a structured outline: the objectives and key ideas are complete, and practice questions are available. A full written lesson is on the way — the reference sheet and the linked official resources cover this material in the meantime.',
    });
  }

  const rawVideos = ((authored?.videos as Record<string, unknown>[]) ?? []).map((v, index) => {
    const videoId = String(v.videoId ?? '');
    const provider = String(v.provider ?? 'youtube') as LessonVideo['provider'];
    return {
      id: deterministicId(idSeeds.video(courseSlug, topic.code, index)),
      lessonId: deterministicId(idSeeds.lesson(courseSlug, topic.code)),
      provider,
      videoId,
      title: String(v.title ?? 'Video lesson'),
      durationSeconds: Number(v.durationSeconds ?? 0),
      attribution: String(
        v.attribution ?? 'Third-party educational video. Embedded where the publisher permits it.',
      ),
      externalUrl: String(v.externalUrl ?? ''),
      // Only providers that publish an embeddable player are embedded.
      embeddable: provider === 'youtube' || provider === 'vimeo',
      thumbnailUrl:
        provider === 'youtube' && videoId
          ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
          : String(v.thumbnailUrl ?? ''),
      position: index,
    } satisfies LessonVideo;
  });

  return {
    id: deterministicId(idSeeds.lesson(courseSlug, topic.code)),
    topicId: topic.id,
    courseId: topic.courseId,
    title: String(authored?.title ?? topic.title),
    summary: topic.summary,
    objectives:
      (authored?.objectives as string[]) ??
      topic.keyIdeas.slice(0, 4).map((k) => `Be able to explain: ${k.replace(/\.$/, '').toLowerCase()}`),
    body,
    vocabulary: (authored?.vocabulary as Lesson['vocabulary']) ?? [],
    formulas: (authored?.formulas as Lesson['formulas']) ?? [],
    mistakes: (authored?.mistakes as string[]) ?? [],
    review: (authored?.review as string[]) ?? [],
    minutes: Number(authored?.minutes ?? Math.max(6, Math.ceil(topic.keyIdeas.length * 3))),
    draft: !authored,
    position: 0,
    videos: rawVideos,
  } as Lesson & { videos: LessonVideo[] };
}

// Lessons carry their videos alongside them so a lesson page is one lookup.
export type LessonWithVideos = Lesson & { videos: LessonVideo[] };

function buildCourse(raw: Record<string, unknown>): Course {
  const slug = String(raw.slug);
  const courseId = deterministicId(idSeeds.course(slug));
  const exam = (raw.exam as Course['exam']) ?? {
    date: null,
    provisional: true,
    durationMinutes: null,
    summary: '',
    sections: [],
    frqs: [],
  };
  const works = raw.works as { note?: string; suggested?: SuggestedWork[] } | undefined;

  const units: Unit[] = ((raw.units as Record<string, unknown>[]) ?? []).map((u, uIndex) => {
    const unitCode = String(u.code);
    const unitId = deterministicId(idSeeds.unit(slug, unitCode));
    const topics: Topic[] = ((u.topics as RawTopic[]) ?? []).map((t, tIndex) => {
      /* Authored topic codes are already unit-prefixed ("1.2" inside unit 1),
       * so they are used verbatim — prefixing again would yield "1.1.2". */
      const topicCode = String(t.code);
      const topicId = deterministicId(idSeeds.topic(slug, topicCode));
      const topic: Topic = {
        id: topicId,
        unitId,
        courseId,
        code: topicCode,
        title: t.title,
        summary: t.summary,
        keyIdeas: t.keyIdeas ?? [],
        position: tIndex,
        lesson: null,
        questions: [],
      };
      topic.lesson = buildLesson(slug, topic, t);
      topic.questions = ((t.questions as Record<string, unknown>[]) ?? []).map((q, qIndex) => ({
        id: deterministicId(idSeeds.question(slug, topicCode, qIndex)),
        topicId,
        courseId,
        topicCode: topic.code,
        kind: (q.kind as QuestionKind) ?? 'mcq',
        prompt: String(q.prompt ?? ''),
        choices: (q.choices as string[]) ?? [],
        answer: q.answer ?? (Array.isArray(q.choices) ? 0 : ''),
        explanation: String(q.explanation ?? ''),
        difficulty: Number(q.difficulty ?? 2),
        timeLimitSeconds: Number(q.timeLimitSeconds ?? 0),
        original: true,
        position: qIndex,
      }));
      return topic;
    });

    return {
      id: unitId,
      courseId,
      code: unitCode,
      title: String(u.title),
      summary: String(u.summary ?? ''),
      examWeight: String(u.examWeight ?? ''),
      position: uIndex,
      topics,
    };
  });

  const topics = units.flatMap((u) => u.topics);

  return {
    id: courseId,
    slug,
    code: String(raw.code),
    shortName: String(raw.shortName),
    tagline: String(raw.tagline ?? ''),
    description: String(raw.description ?? ''),
    subject: String(raw.subject ?? 'other'),
    accent: String(raw.accent ?? 'stat'),
    exam,
    tools: (raw.tools as string[]) ?? [],
    reference: (raw.reference as ReferenceGroup[]) ?? [],
    suggestedWorks: works?.suggested ?? null,
    worksNote: works?.note ?? '',
    externalResources: (raw.externalResources as Course['externalResources']) ?? [],
    units,
    topics,
    topicCount: topics.length,
    lessonCount: topics.filter((t) => t.lesson && !t.lesson.draft).length,
  };
}

const RAW: Record<string, unknown>[] = [stats, gov, lang, lit, psych];

export const COURSES: Course[] = RAW.map(buildCourse);

export const COURSE_BY_SLUG = new Map(COURSES.map((c) => [c.slug, c]));
export const COURSE_BY_ID = new Map(COURSES.map((c) => [c.id, c]));

export const ALL_TOPICS: Topic[] = COURSES.flatMap((c) => c.topics);
export const TOPIC_BY_ID = new Map(ALL_TOPICS.map((t) => [t.id, t]));

export const ALL_LESSONS: LessonWithVideos[] = ALL_TOPICS.flatMap((t) =>
  t.lesson ? [t.lesson as LessonWithVideos] : [],
);
export const LESSON_BY_ID = new Map(ALL_LESSONS.map((l) => [l.id, l]));

const ALL_QUESTIONS: PracticeQuestion[] = ALL_TOPICS.flatMap((t) => t.questions);
export const QUESTION_BY_ID = new Map(ALL_QUESTIONS.map((q) => [q.id, q]));

export const ALL_UNITS: Unit[] = COURSES.flatMap((c) => c.units);
export const UNIT_BY_ID = new Map(ALL_UNITS.map((u) => [u.id, u]));

/**
 * The human-readable key for a question.
 *
 * Authored keys are heterogeneous on purpose — an MCQ key is a choice index,
 * a short answer is a list of accepted terms, an FRQ is a rubric. Anything
 * that prints "the answer" must go through this rather than assuming a string.
 */
export function answerText(question: PracticeQuestion): string {
  const answer = question.answer;
  if (answer === null || answer === undefined) return '';
  if (question.kind === 'mcq') {
    const index = Number(answer);
    return question.choices[index] ?? `Choice ${index + 1}`;
  }
  if (typeof answer === 'string') return answer;
  if (typeof answer === 'number') return String(answer);
  if (Array.isArray(answer)) return answer.join('; ');
  const record = answer as Record<string, unknown>;
  if (typeof record.rubric === 'string') return record.rubric;
  if (Array.isArray(record.accepted)) return (record.accepted as string[]).join(' / ');
  if (typeof record.text === 'string') return record.text;
  return '';
}

/** Accepted substrings for a short-answer key; empty for other kinds. */
export function answerAccepted(question: PracticeQuestion): string[] {
  const answer = question.answer;
  if (Array.isArray(answer)) return answer.map(String);
  if (answer && typeof answer === 'object') {
    const record = answer as Record<string, unknown>;
    if (Array.isArray(record.accepted)) return (record.accepted as unknown[]).map(String);
  }
  return [];
}

/** The correct MCQ choice index, or null for any other question kind. */
export function answerIndex(question: PracticeQuestion): number | null {
  if (question.kind !== 'mcq') return null;
  const index = Number(question.answer);
  return Number.isFinite(index) ? index : null;
}

export function getCourse(slug: string): Course | undefined {
  return COURSE_BY_SLUG.get(slug);
}

export function getCourseById(id: string): Course | undefined {
  return COURSE_BY_ID.get(id);
}

export function getLesson(id: string): LessonWithVideos | undefined {
  return LESSON_BY_ID.get(id);
}

export function getTopic(id: string): Topic | undefined {
  return TOPIC_BY_ID.get(id);
}

export function getUnit(id: string): Unit | undefined {
  return UNIT_BY_ID.get(id);
}

/** Previous and next lessons across the whole course, for lesson navigation. */
export function lessonSiblings(
  course: Course,
  lessonId: string,
): { prev: LessonWithVideos | null; next: LessonWithVideos | null; index: number; total: number } {
  const lessons = course.topics
    .map((t) => t.lesson as LessonWithVideos | null)
    .filter((l): l is LessonWithVideos => Boolean(l));
  const index = lessons.findIndex((l) => l.id === lessonId);
  return {
    prev: index > 0 ? lessons[index - 1] : null,
    next: index >= 0 && index < lessons.length - 1 ? lessons[index + 1] : null,
    index,
    total: lessons.length,
  };
}
