#!/usr/bin/env node
/**
 * Push the curriculum in `content/courses/*.json` into Postgres.
 *
 * Ids come from `shared/deterministic-id.js` — the exact module the app
 * imports — so a row written here and the in-memory curriculum the app
 * builds always agree. That agreement is what makes the foreign keys in
 * `topic_progress`, `practice_attempts` and `study_sessions` line up.
 *
 * Writes go through PostgREST with the service-role key, so values are sent
 * as JSON and Postgres does the type coercion. Nothing here builds SQL by
 * string concatenation, which would be wrong for the jsonb columns.
 *
 * Required environment:
 *   SUPABASE_URL              https://<project-ref>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY service-role key — server-side only, never shipped
 *
 * Usage:
 *   npm run seed                            # upsert every course file
 *   npm run seed -- --dry-run               # parse + derive ids, write nothing
 *   npm run seed -- ap-statistics ap-us-gov # only the matching files
 */

import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deterministicId, seeds } from '../shared/deterministic-id.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT_DIR = join(ROOT, 'content', 'courses');

const id = {
  course: (slug) => deterministicId(seeds.course(slug)),
  unit: (slug, code) => deterministicId(seeds.unit(slug, code)),
  topic: (slug, code) => deterministicId(seeds.topic(slug, code)),
  lesson: (slug, code) => deterministicId(seeds.lesson(slug, code)),
  question: (slug, code, i) => deterministicId(seeds.question(slug, code, i)),
  video: (slug, code, i) => deterministicId(seeds.video(slug, code, i)),
};

/* ------------------------------------------------------------------ *
 * curriculum JSON → table rows
 * ------------------------------------------------------------------ */

function buildRows(raw) {
  const slug = String(raw.slug);
  const cId = id.course(slug);
  const exam = raw.exam ?? {};

  const courses = [
    {
      id: cId,
      slug,
      code: String(raw.code),
      short_name: String(raw.shortName ?? raw.code),
      tagline: String(raw.tagline ?? ''),
      description: String(raw.description ?? ''),
      subject: String(raw.subject ?? 'other'),
      accent: String(raw.accent ?? 'stat'),
      exam_date: exam.date ?? null,
      exam_duration_minutes: exam.durationMinutes ?? null,
      exam_summary: String(exam.summary ?? ''),
      tools: raw.tools ?? [],
      published: true,
    },
  ];

  const units = [];
  const topics = [];
  const lessons = [];
  const lessonVideos = [];
  const questions = [];

  for (const [uIndex, unit] of (raw.units ?? []).entries()) {
    const unitCode = String(unit.code);
    const uId = id.unit(slug, unitCode);
    units.push({
      id: uId,
      course_id: cId,
      code: unitCode,
      title: String(unit.title),
      summary: String(unit.summary ?? ''),
      exam_weight: String(unit.examWeight ?? ''),
      position: uIndex,
      published: true,
    });

    for (const [tIndex, topic] of (unit.topics ?? []).entries()) {
      const topicCode = String(topic.code);
      if (!topicCode.startsWith(`${unitCode}.`)) {
        throw new Error(
          `${slug}: topic "${topicCode}" in unit ${unitCode} is not prefixed with its unit code. ` +
            `Author codes as "${unitCode}.n" — the loader refuses to guess.`,
        );
      }
      const tId = id.topic(slug, topicCode);

      topics.push({
        id: tId,
        unit_id: uId,
        course_id: cId,
        code: topicCode,
        title: String(topic.title),
        summary: String(topic.summary ?? ''),
        key_ideas: topic.keyIdeas ?? [],
        position: tIndex,
        published: true,
      });

      if (topic.lesson) {
        const lesson = topic.lesson;
        const lId = id.lesson(slug, topicCode);
        lessons.push({
          id: lId,
          topic_id: tId,
          course_id: cId,
          title: String(lesson.title ?? topic.title),
          summary: String(lesson.summary ?? topic.summary ?? ''),
          objectives: lesson.objectives ?? [],
          body: lesson.body ?? [],
          vocabulary: lesson.vocabulary ?? [],
          formulas: lesson.formulas ?? [],
          mistakes: lesson.mistakes ?? [],
          review: lesson.review ?? [],
          minutes: Number(lesson.minutes ?? 10),
          published: true,
          position: tIndex,
        });

        for (const [vIndex, video] of (lesson.videos ?? []).entries()) {
          const provider = String(video.provider ?? 'youtube');
          lessonVideos.push({
            id: id.video(slug, topicCode, vIndex),
            lesson_id: lId,
            course_id: cId,
            provider,
            video_id: String(video.videoId ?? ''),
            title: String(video.title ?? 'Video lesson'),
            duration_seconds: Number(video.durationSeconds ?? 0),
            thumbnail_url: String(video.thumbnailUrl ?? ''),
            external_url: String(video.externalUrl ?? ''),
            /* Only providers that publish an embeddable player are embedded;
             * everything else is linked out and labelled as external. */
            embeddable: provider === 'youtube' || provider === 'vimeo',
            attribution: String(video.attribution ?? ''),
            position: vIndex,
            published: true,
          });
        }
      }

      for (const [qIndex, question] of (topic.questions ?? []).entries()) {
        if (question.answer === undefined) {
          throw new Error(`${slug} ${topicCode} question ${qIndex} has no answer key.`);
        }
        questions.push({
          id: id.question(slug, topicCode, qIndex),
          topic_id: tId,
          course_id: cId,
          kind: String(question.kind ?? 'mcq'),
          prompt: String(question.prompt ?? ''),
          choices: question.choices ?? [],
          answer: question.answer,
          explanation: String(question.explanation ?? ''),
          difficulty: Number(question.difficulty ?? 2),
          time_limit_seconds: Number(question.timeLimitSeconds ?? 0),
          /* Only SelfAP-written items are seeded. Official College Board
           * material is never reproduced — it is linked as external. */
          original: true,
          source_note: String(question.sourceNote ?? 'Original to SelfAP.'),
          position: qIndex,
          published: true,
        });
      }
    }
  }

  return { courses, units, topics, lessons, lessonVideos, questions };
}

/* ------------------------------------------------------------------ *
 * PostgREST upsert
 * ------------------------------------------------------------------ */

async function upsert(url, key, table, rows) {
  if (!rows.length) return 0;
  const BATCH = 100;
  let written = 0;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const response = await fetch(`${url}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(batch),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`${table}: ${response.status} ${body.slice(0, 800)}`);
    }
    written += batch.length;
  }
  return written;
}

/* ------------------------------------------------------------------ */

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const wanted = args.filter((a) => !a.startsWith('--'));

  const files = (await readdir(CONTENT_DIR))
    .filter((f) => f.endsWith('.json'))
    .filter((f) => !wanted.length || wanted.some((w) => f.includes(w)))
    .sort();

  if (!files.length) {
    console.error(`No matching course files in ${CONTENT_DIR}`);
    process.exit(1);
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!dryRun && (!url || !key)) {
    console.error(
      [
        'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.',
        '',
        'Both are on the project’s Settings → API page. The service-role key',
        'bypasses row-level security, so it belongs in CI or a terminal —',
        'never in NEXT_PUBLIC_* and never in the browser.',
        '',
        'Run with --dry-run to validate the content files without a project.',
      ].join('\n'),
    );
    process.exit(1);
  }

  const totals = { courses: 0, units: 0, topics: 0, lessons: 0, lessonVideos: 0, questions: 0 };

  for (const file of files) {
    const raw = JSON.parse(await readFile(join(CONTENT_DIR, file), 'utf8'));
    const rows = buildRows(raw);

    console.log(
      `${raw.slug.padEnd(42)} ${rows.units.length} units · ${rows.topics.length} topics · ` +
        `${rows.lessons.length} lessons · ${rows.lessonVideos.length} videos · ` +
        `${rows.questions.length} questions`,
    );

    for (const k of Object.keys(totals)) totals[k] += rows[k].length;

    if (!dryRun) {
      /* Parents before children — the foreign keys demand it. */
      await upsert(url, key, 'courses', rows.courses);
      await upsert(url, key, 'units', rows.units);
      await upsert(url, key, 'topics', rows.topics);
      await upsert(url, key, 'lessons', rows.lessons);
      await upsert(url, key, 'lesson_videos', rows.lessonVideos);
      await upsert(url, key, 'practice_questions', rows.questions);
      console.log('  → pushed');
    }
  }

  console.log(
    `\nTotals: ${totals.courses} courses, ${totals.units} units, ${totals.topics} topics, ` +
      `${totals.lessons} lessons, ${totals.lessonVideos} videos, ${totals.questions} questions`,
  );
  if (dryRun) console.log('--dry-run: parsed and ids derived; nothing was written.');
  else console.log('Done. Curriculum is published and readable by the app.');
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
