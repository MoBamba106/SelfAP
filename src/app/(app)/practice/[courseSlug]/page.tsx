import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth/session';
import { getCourse, type PracticeQuestion } from '@/content';
import { getTopicProgressMap, getTopicStrengths } from '@/lib/data/repository';
import { courseTint } from '@/lib/utils/format';
import { PracticeSession } from '@/components/practice/practice-session';
import { Button } from '@/components/ui/primitives';

type Mode = 'mixed' | 'weak' | 'timed' | 'fresh';

const MODE_COPY: Record<Mode, { label: string; note: string; perQuestionSeconds: number | null }> = {
  mixed: {
    label: 'Mixed set',
    note: 'A spread across the course, weighted towards the units you are working on.',
    perQuestionSeconds: null,
  },
  weak: {
    label: 'Weak areas',
    note: 'Only topics where your accuracy is below 70%.',
    perQuestionSeconds: null,
  },
  timed: {
    label: 'Timed set',
    note: 'One minute per question, no going back — closest to exam pace.',
    perQuestionSeconds: 60,
  },
  fresh: {
    label: 'Unseen questions',
    note: 'Only questions you have never attempted.',
    perQuestionSeconds: null,
  },
};

function seededShuffle<T>(items: T[], seed: number): T[] {
  const out = [...items];
  let s = seed >>> 0;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export async function generateMetadata({ params }: { params: Promise<{ courseSlug: string }> }) {
  const { courseSlug } = await params;
  const course = getCourse(courseSlug);
  if (!course) notFound();
  return { title: `${course.code} practice` };
}

export default async function PracticeCoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ courseSlug: string }>;
  searchParams: Promise<{ mode?: string; unit?: string }>;
}) {
  const user = await requireUser();
  const { courseSlug } = await params;
  const sp = await searchParams;
  const course = getCourse(courseSlug);
  if (!course) notFound();

  const rawMode = (sp.mode ?? 'mixed') as Mode;
  const mode: Mode = rawMode in MODE_COPY ? rawMode : 'mixed';
  const unitCode = sp.unit;
  const unit = course.units.find((u) => u.code === unitCode);

  const [topicProgress, strengths] = await Promise.all([
    getTopicProgressMap(user.id, [course.id]),
    getTopicStrengths(user.id, course),
  ]);
  const weakCodes = new Set(strengths.weak.map(({ topic }) => topic.code));
  const attemptedIds = new Set(
    [...topicProgress.values()].filter((p) => p.practiceTotal > 0).map((p) => p.topicId),
  );

  const pool: PracticeQuestion[] = course.topics
    .filter((topic) => {
      if (unit && topic.unitId !== unit.id) return false;
      if (mode === 'weak' && !weakCodes.has(topic.code)) return false;
      if (mode === 'fresh' && attemptedIds.has(topic.id)) return false;
      return true;
    })
    .flatMap((topic) => topic.questions);

  /* A stable-per-day order: the same student asking for the same mode twice on
   * the same day gets the same set, so a refreshed page is not a new quiz. */
  const today = new Date();
  const daySeed =
    today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate() + mode.length * 7;

  const mixed = seededShuffle(
    mode === 'mixed'
      ? [...pool].sort(
          (a, b) =>
            /* keep questions from the same unit roughly together, then mix */
            (a.topicCode < b.topicCode ? -1 : 1) * 1,
        )
      : pool,
    daySeed,
  );
  const selected = mixed.slice(0, mode === 'timed' ? 12 : 10);

  const meta = MODE_COPY[mode];

  return (
    <div className="mx-auto max-w-3xl space-y-5" style={courseTint(course.accent)}>
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1.5 text-xs text-inkfaint">
          <li>
            <Link href="/practice" className="hover:text-accent">
              Practice
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-inksoft">
            {course.code}
          </li>
        </ol>
      </nav>

      <header>
        <div className="flex flex-wrap gap-1.5">
          {(['mixed', 'weak', 'timed', 'fresh'] as Mode[]).map((m) => (
            <Link
              key={m}
              href={`/practice/${course.slug}?mode=${m}${unit ? `&unit=${unit.code}` : ''}`}
              className={
                m === mode
                  ? 'btn btn-sm btn-primary'
                  : 'btn btn-sm btn-quiet'
              }
              aria-current={m === mode ? 'page' : undefined}
            >
              {MODE_COPY[m].label}
            </Link>
          ))}
        </div>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink">
          {course.code} · {meta.label.toLowerCase()}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-inksoft">{meta.note}</p>
        <p className="mt-2 text-xs text-inkfaint">
          {selected.length} question{selected.length === 1 ? '' : 's'}
          {unit ? ` from Unit ${unit.code}` : ''}
          {meta.perQuestionSeconds ? ` · ${meta.perQuestionSeconds}s each` : ''}
        </p>
      </header>

      {selected.length ? (
        <PracticeSession
          courseCode={course.code}
          courseSlug={course.slug}
          mode={mode}
          questions={selected}
          perQuestionSeconds={meta.perQuestionSeconds}
        />
      ) : (
        <div className="well px-5 py-6 text-center">
          <p className="font-display text-lg font-semibold text-ink">Nothing to practise here yet</p>
          <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-inksoft">
            {mode === 'weak'
              ? 'No topic is below 70% accuracy — that is a good sign. Try a mixed set to keep the older material warm.'
              : 'Every question in this scope has already been attempted. Try a mixed set or another unit.'}
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Button href={`/practice/${course.slug}?mode=mixed`} variant="primary">
              Mixed set
            </Button>
            <Button href={`/courses/${course.slug}`}>Back to course</Button>
          </div>
        </div>
      )}
    </div>
  );
}
