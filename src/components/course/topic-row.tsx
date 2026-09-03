import Link from 'next/link';
import { ArrowRight, BookOpen, FileQuestion } from 'lucide-react';
import type { Topic } from '@/content';
import type { MasteryStatus } from '@/lib/utils/mastery';
import type { TopicProgress } from '@/lib/data/repository';
import { MASTERY_LABEL } from '@/lib/utils/mastery';
import { masteryTone } from '@/lib/utils/mastery';
import { Badge, MasteryMeter } from '@/components/ui/primitives';

export function TopicRow({
  topic,
  courseSlug,
  progress,
  lessonDone,
}: {
  topic: Topic;
  courseSlug: string;
  progress?: TopicProgress;
  lessonDone?: boolean;
}) {
  const done = lessonDone ?? progress?.lessonDone ?? false;
  const status = progress?.mastery.status ?? (done ? 'learning' : 'not-started');
  const rung = progress?.mastery.rung ?? (done ? 2 : 1);
  const accuracy = progress?.mastery.accuracy;
  /* The row always opens the topic: that is where the key ideas, the
   * confidence rating and this topic's practice live. The lesson is a
   * separate destination, not a replacement for the topic page. */
  const topicHref = `/courses/${courseSlug}/topics/${topic.code}`;
  const lessonHref = topic.lesson ? `/learn/${topic.lesson.id}` : null;

  return (
    <li className="group relative flex items-start gap-3 px-4 py-3 transition-colors hover:bg-paper-sunk/60 sm:px-5">
      <span
        aria-hidden="true"
        className="mt-1 w-10 shrink-0 font-mono text-xs font-semibold tabular-nums text-inkghost"
      >
        {topic.code}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={topicHref}
            className="text-sm font-semibold text-ink underline-offset-4 group-hover:underline"
          >
            {topic.title}
          </Link>
          {topic.lesson?.draft ? <span className="badge">Outline</span> : null}
        </div>
        {topic.summary ? (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-inkfaint">{topic.summary}</p>
        ) : null}

        <div className="mt-2 flex flex-wrap items-center gap-2.5">
          <div className="w-20">
            <MasteryMeter rung={rung} label={`Mastery: ${MASTERY_LABEL[status]}`} />
          </div>
          <Badge tone={masteryTone(status)}>{MASTERY_LABEL[status]}</Badge>
          {accuracy !== null && accuracy !== undefined ? (
            <span className="font-mono text-[11px] tabular-nums text-inkfaint">
              {Math.round(accuracy * 100)}% · {progress?.practiceTotal ?? 0} attempts
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {topic.questions.length ? (
          <span className="badge hidden sm:inline-flex" title={`${topic.questions.length} practice questions`}>
            <FileQuestion size={11} aria-hidden="true" />
            {topic.questions.length}
          </span>
        ) : null}
        {lessonHref ? (
          <Link
            href={lessonHref}
            className="badge hidden sm:inline-flex hover:border-accent hover:text-accent"
          >
            <BookOpen size={11} aria-hidden="true" />
            {done ? 'Lesson' : 'Start'} · {topic.lesson!.minutes}m
          </Link>
        ) : null}
        <Link
          href={topicHref}
          aria-label={`Open topic ${topic.code} ${topic.title}`}
          className="grid h-7 w-7 place-items-center rounded-[6px] border border-line text-inkghost transition-colors hover:border-accent hover:text-accent"
        >
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </div>
    </li>
  );
}

export function TopicBadge({ status }: { status: MasteryStatus }) {
  return <Badge tone={masteryTone(status)}>{MASTERY_LABEL[status]}</Badge>;
}
