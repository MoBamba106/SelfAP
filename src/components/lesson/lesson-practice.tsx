import Link from 'next/link';
import type { PracticeQuestion } from '@/content';
import { Badge } from '@/components/ui/primitives';
import { QuestionRunner } from '@/components/practice/question-runner';

/**
 * Practice attached to a lesson. Kept inline so the student can check
 * understanding immediately rather than navigating away mid-lesson.
 */
export function LessonPractice({
  questions,
  topicHref,
}: {
  questions: PracticeQuestion[];
  topicHref: string;
}) {
  if (!questions.length) {
    return (
      <div className="well mt-8 px-4 py-4">
        <p className="text-sm font-semibold text-ink">No practice attached yet</p>
        <p className="mt-1 text-sm text-inksoft">
          Practice questions for this topic are still being written. In the meantime,{' '}
          <Link href={topicHref} className="text-accent underline underline-offset-2">
            review the topic overview
          </Link>{' '}
          or run mixed practice for the course.
        </p>
      </div>
    );
  }

  return (
    <section className="mt-10" aria-labelledby="lesson-practice">
      <div className="rule-label mb-4">
        <h2 id="lesson-practice" className="font-display text-xl font-semibold text-ink">
          Check yourself
        </h2>
      </div>
      <div className="space-y-4">
        {questions.map((question) => (
          <QuestionRunner key={question.id} question={question} />
        ))}
      </div>
      <div className="mt-4 flex items-center gap-2">
        <Badge tone="accent">Scores feed your topic mastery</Badge>
      </div>
    </section>
  );
}
