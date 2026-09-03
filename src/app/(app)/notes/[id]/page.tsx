import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSessionUser, requireUser } from '@/lib/auth/session';
import { COURSE_BY_ID, LESSON_BY_ID, TOPIC_BY_ID, UNIT_BY_ID } from '@/content';
import { getEnrollments, getNote } from '@/lib/data/repository';
import { NoteEditor, type AttachOption } from '@/components/notes/note-editor';

/** Resolves the note title, and 404s early for a note that is not yours. */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  const { id } = await params;
  if (!user) return { title: 'Note' };
  const note = await getNote(user.id, id);
  if (!note) notFound();
  return { title: note.title || 'Note' };
}

export default async function NoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const [note, enrollments] = await Promise.all([getNote(user.id, id), getEnrollments(user.id)]);
  if (!note) notFound();

  const options: AttachOption[] = enrollments.map((e) => ({
    courseId: e.course.id,
    courseCode: e.course.code,
    units: e.course.units.map((u) => ({
      id: u.id,
      code: u.code,
      topics: u.topics.map((t) => ({ id: t.id, code: t.code, title: t.title })),
    })),
  }));

  /* Breadcrumb for wherever this note is attached. */
  const course = note.courseId ? COURSE_BY_ID.get(note.courseId) : null;
  const unit = note.unitId ? UNIT_BY_ID.get(note.unitId) : null;
  const topic = note.topicId ? TOPIC_BY_ID.get(note.topicId) : null;
  const lesson = note.lessonId ? LESSON_BY_ID.get(note.lessonId) : null;

  const crumbs = [
    { href: '/courses', label: 'Courses' },
    course ? { href: `/courses/${course.slug}`, label: course.shortName } : null,
    course && unit ? { href: `/courses/${course.slug}/units/${unit.code}`, label: `Unit ${unit.code}` } : null,
    course && topic
      ? { href: `/courses/${course.slug}/topics/${topic.code}`, label: topic.code }
      : null,
    lesson ? { href: `/learn/${lesson.id}`, label: 'Lesson' } : null,
  ].filter(Boolean) as { href: string; label: string }[];

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1.5 text-xs text-inkfaint">
          <li>
            <Link href="/notes" className="hover:text-accent">
              Notes
            </Link>
          </li>
          {crumbs.map((crumb) => (
            <li key={crumb.href} className="flex items-center gap-1.5">
              <span aria-hidden="true">/</span>
              <Link href={crumb.href} className="hover:text-accent">
                {crumb.label}
              </Link>
            </li>
          ))}
          <li className="flex items-center gap-1.5" aria-current="page">
            <span aria-hidden="true">/</span>
            <span className="text-inksoft">{note.title || 'Untitled note'}</span>
          </li>
        </ol>
      </nav>

      <NoteEditor
        noteId={note.id}
        options={options}
        initial={{
          title: note.title,
          body: note.body,
          checklist: note.checklist,
          courseId: note.courseId,
          unitId: note.unitId,
          topicId: note.topicId,
          lessonId: note.lessonId,
          pinned: note.pinned,
          updatedAt: note.updatedAt,
        }}
      />

      {topic ? (
        <p className="text-xs text-inkfaint">
          Attached to topic{' '}
          <Link
            href={`/courses/${course?.slug ?? ''}/topics/${topic.code}`}
            className="text-accent underline underline-offset-2"
          >
            {topic.code} {topic.title}
          </Link>
          . It shows up on that page while you study.
        </p>
      ) : null}
    </div>
  );
}
