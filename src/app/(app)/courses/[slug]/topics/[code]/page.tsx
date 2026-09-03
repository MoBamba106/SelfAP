import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, BookOpen, Timer } from 'lucide-react';
import { requireUser } from '@/lib/auth/session';
import { getCourse } from '@/content';
import { getLessonProgressMap, getTopicProgressMap } from '@/lib/data/repository';
import { MASTERY_LABEL } from '@/lib/utils/mastery';
import { courseTint } from '@/lib/utils/format';
import { ConfidenceRating } from '@/components/lesson/confidence-rating';
import { QuestionRunner } from '@/components/practice/question-runner';
import { Badge, Button, Card, CardBody, MasteryMeter } from '@/components/ui/primitives';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; code: string }>;
}) {
  const { slug, code } = await params;
  const course = getCourse(slug);
  const topic = course?.topics.find((t) => t.code === code);
  if (!course || !topic) notFound();
  return { title: `Topic ${topic.code} — ${topic.title}` };
}

export default async function TopicPage({
  params,
}: {
  params: Promise<{ slug: string; code: string }> }) {
  const user = await requireUser();
  const { slug, code } = await params;
  const course = getCourse(slug);
  const topic = course?.topics.find((t) => t.code === code);
  if (!course || !topic) notFound();
  const unit = course.units.find((u) => u.id === topic.unitId);

  const [topicProgress, lessonProgress] = await Promise.all([
    getTopicProgressMap(user.id, [course.id]),
    getLessonProgressMap(user.id, [course.id]),
  ]);
  const progress = topicProgress.get(topic.id);
  const lessonDone = topic.lesson
    ? Boolean(lessonProgress.get(topic.lesson.id)?.completedAt)
    : false;
  const status = progress?.mastery.status ?? (lessonDone ? 'learning' : 'not-started');
  const rung = progress?.mastery.rung ?? (lessonDone ? 2 : 1);

  return (
    <div className="mx-auto max-w-3xl space-y-6" style={courseTint(course.accent)}>
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1.5 text-xs text-inkfaint">
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
              href={`/courses/${course.slug}/units/${unit?.code ?? ''}`}
              className="hover:text-accent"
            >
              Unit {unit?.code}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-inksoft">
            {topic.code}
          </li>
        </ol>
      </nav>

      <header className="anim-rise">
        <p className="eyebrow mb-1.5">
          Topic {topic.code} · Unit {unit?.code} — {unit?.title}
        </p>
        <h1 className="font-display text-[2rem] font-semibold leading-tight tracking-tight text-ink sm:text-[2.4rem]">
          {topic.title}
        </h1>
        <p className="mt-3 text-base leading-relaxed text-inksoft">{topic.summary}</p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <MasteryMeter rung={rung} label={`Mastery: ${MASTERY_LABEL[status]}`} />
          <Badge tone="accent">{MASTERY_LABEL[status]}</Badge>
          {progress?.mastery.accuracy !== null && progress?.mastery.accuracy !== undefined ? (
            <span className="badge">
              {Math.round(progress.mastery.accuracy * 100)}% over {progress.practiceTotal} attempts
            </span>
          ) : null}
        </div>
      </header>

      {topic.keyIdeas.length ? (
        <Card>
          <CardBody className="py-4">
            <p className="eyebrow mb-2.5">Key ideas</p>
            <ul className="space-y-2">
              {topic.keyIdeas.map((idea, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed text-inksoft">
                  <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ochre" />
                  {idea}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {topic.lesson ? (
          <Button href={`/learn/${topic.lesson.id}`} variant="primary">
            <BookOpen size={15} aria-hidden="true" />
            {lessonDone ? 'Revisit lesson' : 'Open lesson'}
            <ArrowRight size={14} aria-hidden="true" />
          </Button>
        ) : null}
        <Button href={`/study?course=${course.slug}`}>
          <Timer size={14} aria-hidden="true" />
          Study this topic
        </Button>
      </div>

      {topic.lesson?.draft ? (
        <p className="well px-4 py-3 text-sm leading-relaxed text-inksoft">
          The full written lesson for this topic is still in progress. The key ideas above and
          the practice below are complete, and the course reference sheet covers the material
          in the meantime.
        </p>
      ) : null}

      <ConfidenceRating
        topicId={topic.id}
        initial={progress?.selfRating ?? null}
        status={status}
        reasons={progress?.mastery.reasons ?? []}
      />

      <section aria-labelledby="topic-practice">
        <div className="rule-label mb-4">
          <h2 id="topic-practice" className="font-display text-xl font-semibold text-ink">
            Practice this topic
          </h2>
        </div>
        {topic.questions.length ? (
          <div className="space-y-4">
            {topic.questions.map((question) => (
              <QuestionRunner key={question.id} question={question} compact />
            ))}
          </div>
        ) : (
          <Card>
            <CardBody className="py-4">
              <p className="text-sm leading-relaxed text-inksoft">
                No topic-specific questions written yet. Run{' '}
                <Link
                  href={`/practice/${course.slug}`}
                  className="text-accent underline underline-offset-2"
                >
                  mixed {course.shortName} practice
                </Link>{' '}
                in the meantime.
              </p>
            </CardBody>
          </Card>
        )}
      </section>
    </div>
  );
}
