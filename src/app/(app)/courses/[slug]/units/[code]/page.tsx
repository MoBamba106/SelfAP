import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { requireUser } from '@/lib/auth/session';
import { getCourse } from '@/content';
import { getLessonProgressMap, getTopicProgressMap } from '@/lib/data/repository';
import { courseTint } from '@/lib/utils/format';
import { TopicRow } from '@/components/course/topic-row';
import { Button, Card, CardBody, Meter } from '@/components/ui/primitives';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; code: string }>;
}) {
  const { slug, code } = await params;
  const course = getCourse(slug);
  const unit = course?.units.find((u) => u.code === code);
  if (!course || !unit) notFound();
  return { title: `Unit ${unit.code} — ${unit.title}` };
}

export default async function UnitPage({
  params,
}: {
  params: Promise<{ slug: string; code: string }> }) {
  const user = await requireUser();
  const { slug, code } = await params;
  const course = getCourse(slug);
  const unit = course?.units.find((u) => u.code === code);
  if (!course || !unit) notFound();

  const [topicProgress, lessonProgress] = await Promise.all([
    getTopicProgressMap(user.id, [course.id]),
    getLessonProgressMap(user.id, [course.id]),
  ]);

  const done = unit.topics.filter(
    (t) =>
      topicProgress.get(t.id)?.lessonDone ||
      (t.lesson ? Boolean(lessonProgress.get(t.lesson.id)?.completedAt) : false),
  ).length;
  const nextTopic = unit.topics.find(
    (t) =>
      !(
        topicProgress.get(t.id)?.lessonDone ||
        (t.lesson ? Boolean(lessonProgress.get(t.lesson.id)?.completedAt) : false)
      ),
  );

  return (
    <div className="space-y-6" style={courseTint(course.accent)}>
      <nav aria-label="Breadcrumb" className="mb-1">
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
          <li aria-current="page" className="text-inksoft">
            Unit {unit.code}
          </li>
        </ol>
      </nav>

      <header>
        <p className="eyebrow mb-1.5">
          Unit {unit.code}
          {unit.examWeight ? ` · ${unit.examWeight} of the exam` : ''}
        </p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          {unit.title}
        </h1>
        {unit.summary ? (
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-inksoft">{unit.summary}</p>
        ) : null}
      </header>

      <Card className="px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-[12rem] flex-1">
            <p className="eyebrow mb-1.5">
              {done} of {unit.topics.length} topics complete
            </p>
            <Meter value={done} max={unit.topics.length} label="Unit progress" />
          </div>
          {nextTopic?.lesson ? (
            <Button href={`/learn/${nextTopic.lesson.id}`} variant="primary">
              Continue with {nextTopic.code}
              <ArrowRight size={14} aria-hidden="true" />
            </Button>
          ) : null}
        </div>
      </Card>

      <section className="card" aria-label="Topics in this unit">
        <ul className="divide-y divide-linesoft">
          {unit.topics.map((topic) => (
            <TopicRow
              key={topic.id}
              topic={topic}
              courseSlug={course.slug}
              progress={topicProgress.get(topic.id)}
              lessonDone={
                topic.lesson ? Boolean(lessonProgress.get(topic.lesson.id)?.completedAt) : undefined
              }
            />
          ))}
        </ul>
      </section>

      <Card>
        <CardBody className="py-4">
          <p className="text-sm leading-relaxed text-inksoft">
            Practice for this unit lives on each topic page, or you can run a mixed set from{' '}
            <Link href={`/practice/${course.slug}`} className="text-accent underline underline-offset-2">
              {course.shortName} practice
            </Link>
            .
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
