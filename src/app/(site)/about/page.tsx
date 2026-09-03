import { COURSES } from '@/content';
import { Button, Card, CardBody } from '@/components/ui/primitives';

export const metadata = { title: 'About' };

const PRINCIPLES = [
  {
    title: 'Answer three questions and nothing else',
    body: 'What should I study? How should I study it? Am I improving? Every feature has to answer one of those. If it does not, it does not get built.',
  },
  {
    title: 'Mastery is earned, not timed',
    body: 'Hours logged never move you to “mastered”. Mastery comes from lesson completion plus accuracy across repeated attempts, and it decays if you stop reviewing. A four-hour session on something you already know is not progress.',
  },
  {
    title: 'History is never rewritten',
    body: 'Weekly targets reset because your week reset — not because we deleted anything. Every session you have ever logged is still there, and this week is computed from it.',
  },
  {
    title: 'Your data is yours',
    body: 'Export everything as JSON at any time, delete everything at any time, from the same page. Row-level security in the database — not application code — is what keeps one student from seeing another’s work.',
  },
  {
    title: 'Original material only',
    body: 'Every question and lesson is written for SelfAP against the published frameworks. No past papers, no textbook extracts, no scraped content. Official resources are linked to their publisher, never mirrored.',
  },
  {
    title: 'Calm on purpose',
    body: 'No streak-shaming, no confetti for reading a paragraph, no dark patterns. Motion is quiet and turns itself off when your system asks for reduced motion.',
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-8">
        <p className="eyebrow mb-1.5">About</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Built for the student studying alone
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-inksoft">
          A lot of people sit AP exams without a class behind them — homeschooled, between
          schools, adding a subject their timetable would not fit, or retaking one. They do not
          have a teacher telling them what is next week. SelfAP is that structure: the curriculum
          broken down, a timer that survives a closed tab, practice that tells you where you are
          weak, and a dashboard that answers one question honestly.
        </p>
      </header>

      <section aria-labelledby="principles" className="mb-10">
        <h2 id="principles" className="rule-label mb-4 font-display text-2xl font-semibold text-ink">
          What we hold to
        </h2>
        <ul className="grid gap-3">
          {PRINCIPLES.map((principle) => (
            <li key={principle.title} className="card card-spine px-4 py-3.5">
              <h3 className="font-display text-base font-semibold text-ink">{principle.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-inksoft">{principle.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="courses" className="mb-10">
        <h2 id="courses" className="rule-label mb-4 font-display text-2xl font-semibold text-ink">
          Courses at launch
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {COURSES.map((course) => (
            <li key={course.id} className="card px-4 py-3.5">
              <h3 className="font-display text-base font-semibold text-ink">{course.code}</h3>
              <p className="mt-1 text-sm leading-relaxed text-inksoft">{course.tagline}</p>
              <p className="mt-2 font-mono text-[11px] text-inkfaint">
                {course.units.length} units · {course.topicCount} topics ·{' '}
                {course.lessonCount} written lessons
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm leading-relaxed text-inksoft">
          Adding a course means adding a content file — units, topics, lessons, questions and
          subject-specific tools — with no change to the schema, the routes or the UI.
        </p>
      </section>

      <section aria-labelledby="disclaimer" className="mb-10">
        <h2 id="disclaimer" className="rule-label mb-4 font-display text-2xl font-semibold text-ink">
          Independence
        </h2>
        <div className="callout" data-kind="warning">
          <span className="callout-label">Not affiliated with the College Board</span>
          <p className="text-sm leading-relaxed text-inksoft">
            SelfAP is an independent study tool. It is not affiliated with, endorsed by, sponsored
            by, or approved by the College Board. AP and Advanced Placement are registered
            trademarks of the College Board, which was not involved in the production of SelfAP
            and does not endorse it. Exam formats summarised here come from publicly published
            course and exam descriptions and may change — always confirm against the official
            documents linked from each course page.
          </p>
        </div>
      </section>

      <Card>
        <CardBody>
          <p className="text-sm leading-relaxed text-inksoft">
            Ready to try it? The demo account comes with several months of study history so you
            can see how the dashboard behaves before you commit to anything.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button href="/signup" variant="primary">
              Create an account
            </Button>
            <Button href="/#features">See the features</Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
