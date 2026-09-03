import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, BookOpen, Clock, Timer } from 'lucide-react';
import { requireUser } from '@/lib/auth/session';
import { getCourseById, getLesson, getTopic, getUnit, lessonSiblings } from '@/content';
import { getLessonProgressMap, getTopicProgressMap } from '@/lib/data/repository';
import { courseTint } from '@/lib/utils/format';
import { LessonBody } from '@/components/lesson/lesson-body';
import { VideoPlayer } from '@/components/lesson/video-player';
import { LessonActions } from '@/components/lesson/lesson-actions';
import { LessonPractice } from '@/components/lesson/lesson-practice';
import { Badge, Button, Card, CardBody } from '@/components/ui/primitives';
import { ConfidenceRating } from '@/components/lesson/confidence-rating';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const { lessonId } = await params;
  const lesson = getLesson(lessonId);
  if (!lesson) notFound();
  return { title: lesson.title };
}

export default async function LessonPage({ params }: { params: Promise<{ lessonId: string }> }) {
  const user = await requireUser();
  const { lessonId } = await params;

  const lesson = getLesson(lessonId);
  if (!lesson) notFound();

  const course = getCourseById(lesson.courseId);
  const topic = getTopic(lesson.topicId);
  const unit = topic ? getUnit(topic.unitId) : undefined;
  if (!course || !topic || !unit) notFound();

  const [lessonProgress, topicProgress] = await Promise.all([
    getLessonProgressMap(user.id, [course.id]),
    getTopicProgressMap(user.id, [course.id]),
  ]);

  const progress = lessonProgress.get(lesson.id);
  const completed = Boolean(progress?.completedAt);
  const tp = topicProgress.get(topic.id);
  const siblings = lessonSiblings(course, lesson.id);
  const video = lesson.videos?.[0];

  return (
    <div className="mx-auto max-w-3xl">
      {/* ------------------------------------------------- breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-4">
        <ol className="flex flex-wrap items-center gap-1.5 text-xs text-inkfaint" style={courseTint(course.accent)}>
          <li>
            <Link href="/courses" className="hover:text-accent">
              Courses
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href={`/courses/${course.slug}`} className="hover:text-accent">
              {course.shortName}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link
              href={`/courses/${course.slug}/units/${unit.code}`}
              className="hover:text-accent"
            >
              Unit {unit.code}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-inksoft">
            Topic {topic.code}
          </li>
        </ol>
      </nav>

      {/* ----------------------------------------------------- header */}
      <header className="anim-rise mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="rounded-[4px] px-2 py-0.5 text-[11px] font-semibold"
            style={{ background: 'var(--tint-soft)', color: 'var(--tint)' }}
          >
            Topic {topic.code}
          </span>
          {lesson.draft ? (
            <Badge tone="warn">Outline — full lesson in progress</Badge>
          ) : (
            <Badge tone="accent">Full lesson</Badge>
          )}
          <span className="badge">
            <Clock size={11} aria-hidden="true" />
            {lesson.minutes} min
          </span>
          {completed ? <Badge tone="good" dot>Completed</Badge> : null}
        </div>

        <h1 className="mt-3 font-display text-[2rem] font-semibold leading-[1.15] tracking-tight text-ink sm:text-[2.4rem]">
          {lesson.title}
        </h1>
        {lesson.summary ? (
          <p className="mt-3 text-base leading-relaxed text-inksoft">{lesson.summary}</p>
        ) : null}
      </header>

      {/* -------------------------------------------------- objectives */}
      {lesson.objectives.length ? (
        <Card className="mb-6">
          <CardBody className="py-4">
            <p className="eyebrow mb-2">By the end you should be able to</p>
            <ul className="space-y-1.5">
              {lesson.objectives.map((objective, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed text-inksoft">
                  <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  {objective}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      {/* ------------------------------------------------------- video */}
      {video ? (
        <div className="mb-8">
          <VideoPlayer video={video} lessonId={lesson.id} resumeAt={progress?.videoPosition ?? 0} />
        </div>
      ) : null}

      {/* -------------------------------------------------------- body */}
      <article>
        <LessonBody lesson={lesson} />
      </article>

      {/* -------------------------------------------------- vocabulary */}
      {lesson.vocabulary.length ? (
        <section className="mt-10" aria-labelledby="vocab-heading">
          <div className="rule-label mb-4">
            <h2 id="vocab-heading" className="font-display text-xl font-semibold text-ink">
              Key vocabulary
            </h2>
          </div>
          <dl className="divide-y divide-linesoft border-y border-linesoft">
            {lesson.vocabulary.map((entry) => (
              <div key={entry.term} className="grid gap-1 py-3 sm:grid-cols-[13rem_1fr] sm:gap-4">
                <dt className="text-sm font-semibold text-ink">{entry.term}</dt>
                <dd className="text-sm leading-relaxed text-inksoft">{entry.definition}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {/* ---------------------------------------------------- formulas */}
      {lesson.formulas.length ? (
        <section className="mt-10" aria-labelledby="formulas-heading">
          <div className="rule-label mb-4">
            <h2 id="formulas-heading" className="font-display text-xl font-semibold text-ink">
              Formulas
            </h2>
          </div>
          <div className="space-y-3">
            {lesson.formulas.map((formula) => (
              <div key={formula.label} className="formula">
                <span className="formula-label">{formula.label}</span>
                <pre className="m-0 whitespace-pre-wrap font-mono">{formula.expression}</pre>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* ---------------------------------------------------- mistakes */}
      {lesson.mistakes.length ? (
        <section className="mt-10" aria-labelledby="mistakes-heading">
          <div className="rule-label mb-4">
            <h2 id="mistakes-heading" className="font-display text-xl font-semibold text-ink">
              Common mistakes
            </h2>
          </div>
          <ul className="space-y-2">
            {lesson.mistakes.map((mistake, i) => (
              <li
                key={i}
                className="rounded-[var(--radius-ctl)] border border-linesoft border-l-[3px] border-l-bad bg-paper-sunk px-4 py-3 text-sm leading-relaxed text-inksoft"
              >
                {mistake}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ------------------------------------------------------ review */}
      {lesson.review.length ? (
        <section className="mt-10" aria-labelledby="review-heading">
          <div className="rule-label mb-4">
            <h2 id="review-heading" className="font-display text-xl font-semibold text-ink">
              Quick review
            </h2>
          </div>
          <ol className="space-y-2.5">
            {lesson.review.map((item, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed text-inksoft">
                <span className="font-mono text-xs font-semibold text-inkghost">{i + 1}.</span>
                {item}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {/* ---------------------------------------------------- practice */}
      <LessonPractice
        questions={topic.questions}
        topicHref={`/courses/${course.slug}/topics/${topic.code}`}
      />

      {/* -------------------------------------------------- completion */}
      <LessonActions
        lessonId={lesson.id}
        alreadyComplete={completed}
        nextHref={siblings.next ? `/learn/${siblings.next.id}` : null}
      />

      <ConfidenceRating
        topicId={topic.id}
        initial={tp?.selfRating ?? null}
        status={tp?.mastery.status ?? 'not-started'}
        reasons={tp?.mastery.reasons ?? []}
      />

      {/* -------------------------------------------------- navigation */}
      <nav
        aria-label="Lesson navigation"
        className="mt-8 grid gap-3 border-t border-linesoft pt-6 sm:grid-cols-2"
      >
        {siblings.prev ? (
          <Link
            href={`/learn/${siblings.prev.id}`}
            className="card group flex items-center gap-3 px-4 py-3 no-underline"
          >
            <ArrowLeft size={16} className="shrink-0 text-inkghost" aria-hidden="true" />
            <span className="min-w-0">
              <span className="block text-[11px] font-semibold uppercase tracking-wide text-inkghost">
                Previous
              </span>
              <span className="block truncate text-sm font-medium text-ink group-hover:text-accent">
                {siblings.prev.title}
              </span>
            </span>
          </Link>
        ) : (
          <span />
        )}
        {siblings.next ? (
          <Link
            href={`/learn/${siblings.next.id}`}
            className="card group flex items-center justify-end gap-3 px-4 py-3 text-right no-underline"
          >
            <span className="min-w-0">
              <span className="block text-[11px] font-semibold uppercase tracking-wide text-inkghost">
                Next
              </span>
              <span className="block truncate text-sm font-medium text-ink group-hover:text-accent">
                {siblings.next.title}
              </span>
            </span>
            <ArrowRight size={16} className="shrink-0 text-inkghost" aria-hidden="true" />
          </Link>
        ) : null}
      </nav>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Button href={`/study?course=${course.slug}`} size="sm">
          <Timer size={13} aria-hidden="true" />
          Time this topic
        </Button>
        <Button href={`/courses/${course.slug}/topics/${topic.code}`} size="sm">
          <BookOpen size={13} aria-hidden="true" />
          Topic overview
        </Button>
      </div>
    </div>
  );
}
