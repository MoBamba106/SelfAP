import Link from 'next/link';
import { requireUser } from '@/lib/auth/session';
import { COURSE_BY_ID, TOPIC_BY_ID } from '@/content';
import { getEnrollments, listNotes } from '@/lib/data/repository';
import { NoteCard, NoteEditor, type AttachOption } from '@/components/notes/note-editor';
import { Button, EmptyState } from '@/components/ui/primitives';

export const metadata = { title: 'Notes' };

function attachOptions(courses: { id: string; code: string; units: { id: string; code: string; topics: { id: string; code: string; title: string }[] }[] }[]): AttachOption[] {
  return courses.map((course) => ({
    courseId: course.id,
    courseCode: course.code,
    units: course.units.map((unit) => ({
      id: unit.id,
      code: unit.code,
      topics: unit.topics.map((topic) => ({ id: topic.id, code: topic.code, title: topic.title })),
    })),
  }));
}

export default async function NotesPage() {
  const user = await requireUser();
  const [notes, enrollments] = await Promise.all([listNotes(user.id), getEnrollments(user.id)]);

  const options = attachOptions(
    enrollments.map((e) => ({
      id: e.course.id,
      code: e.course.code,
      units: e.course.units.map((u) => ({
        id: u.id,
        code: u.code,
        topics: u.topics.map((t) => ({ id: t.id, code: t.code, title: t.title })),
      })),
    })),
  );

  const pinned = notes.filter((n) => n.pinned);
  const rest = notes.filter((n) => !n.pinned);

  const crumbs = (courseId: string | null, topicId: string | null): string | undefined => {
    const parts: string[] = [];
    const course = courseId ? COURSE_BY_ID.get(courseId) : null;
    if (course) parts.push(course.code);
    const topic = topicId ? TOPIC_BY_ID.get(topicId) : null;
    if (topic) parts.push(topic.code);
    return parts.length ? parts.join(' · ') : undefined;
  };

  return (
    <div className="space-y-8">
      <header>
        <p className="eyebrow mb-1.5">Notes</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Your own words
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-inksoft">
          Notes attach to a course, unit, topic or lesson and appear on that page while you study
          it. They are searchable from the top bar, and they export with your data.
        </p>
      </header>

      {notes.length === 0 ? (
        <EmptyState
          title="No notes yet"
          description="Write one the moment something clicks — or the moment something does not."
        />
      ) : (
        <>
          {pinned.length ? (
            <section aria-labelledby="pinned">
              <h2 id="pinned" className="rule-label mb-3 font-display text-lg font-semibold text-ink">
                Pinned
              </h2>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {pinned.map((note) => (
                  <li key={note.id}>
                    <NoteCard
                      note={note}
                      courseCode={note.courseId ? COURSE_BY_ID.get(note.courseId)?.code : undefined}
                      breadcrumb={crumbs(note.courseId, note.topicId)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section aria-labelledby="all-notes">
            <h2 id="all-notes" className="rule-label mb-3 font-display text-lg font-semibold text-ink">
              All notes
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((note) => (
                <li key={note.id}>
                  <NoteCard
                    note={note}
                    courseCode={note.courseId ? COURSE_BY_ID.get(note.courseId)?.code : undefined}
                    breadcrumb={crumbs(note.courseId, note.topicId)}
                  />
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      <section aria-labelledby="new-note" className="max-w-3xl">
        <h2 id="new-note" className="rule-label mb-3 font-display text-lg font-semibold text-ink">
          Write a note
        </h2>
        <NoteEditor
          noteId={null}
          options={options}
          initial={{
            title: '',
            body: '',
            checklist: [],
            courseId: null,
            unitId: null,
            topicId: null,
            lessonId: null,
            pinned: false,
            updatedAt: null,
          }}
        />
      </section>

      {enrollments.length === 0 ? (
        <div className="well px-4 py-3">
          <p className="text-sm leading-relaxed text-inksoft">
            Notes work without a course, but attaching them is what makes them useful.{' '}
            <Link href="/courses" className="text-accent underline underline-offset-2">
              Add a course
            </Link>{' '}
            and the attach menus fill in.
          </p>
        </div>
      ) : null}

      <p className="text-xs text-inkfaint">
        Looking for something specific? Use the{' '}
        <Button href="/search" variant="quiet" size="sm">
          global search
        </Button>{' '}
        — it covers notes, topics and lessons together.
      </p>
    </div>
  );
}
