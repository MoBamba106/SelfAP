'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Pin, Plus, Trash2, X } from 'lucide-react';
import { removeNote, saveUserNote } from '@/lib/actions/workspace';
import { relativeTime } from '@/lib/utils/time';
import { Button, Card, CardBody, Field } from '@/components/ui/primitives';

export type AttachOption = {
  courseId: string;
  courseCode: string;
  units: { id: string; code: string; topics: { id: string; code: string; title: string }[] }[];
};

type ChecklistItem = { text: string; done: boolean };

export function NoteEditor({
  noteId,
  initial,
  options,
  preset,
}: {
  noteId: string | null;
  initial: {
    title: string;
    body: string;
    checklist: ChecklistItem[];
    courseId: string | null;
    unitId: string | null;
    topicId: string | null;
    lessonId: string | null;
    pinned: boolean;
    updatedAt: string | null;
  };
  options: AttachOption[];
  /** Where a brand-new note is attached when the user came from a lesson/topic. */
  preset?: { courseId?: string; unitId?: string; topicId?: string; lessonId?: string };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [title, setTitle] = useState(initial.title);
  const [body, setBody] = useState(initial.body);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(initial.checklist);
  const [draft, setDraft] = useState('');
  const [pinned, setPinned] = useState(initial.pinned);

  const [courseId, setCourseId] = useState(initial.courseId ?? preset?.courseId ?? '');
  const [unitId, setUnitId] = useState(initial.unitId ?? preset?.unitId ?? '');
  const [topicId, setTopicId] = useState(initial.topicId ?? preset?.topicId ?? '');

  const course = options.find((c) => c.courseId === courseId);
  const unit = course?.units.find((u) => u.id === unitId);

  const submit = (formData: FormData) => {
    start(async () => {
      setError(null);
      const res = await saveUserNote({
        id: noteId ?? undefined,
        title: title.trim() || 'Untitled note',
        body,
        checklist,
        courseId: courseId || null,
        unitId: unitId || null,
        topicId: topicId || null,
        lessonId: initial.lessonId ?? preset?.lessonId ?? null,
        pinned,
      });
      void formData;
      if (!res.ok) {
        setError(res.message ?? 'Could not save that note.');
        return;
      }
      setSaved(true);
      router.refresh();
      window.setTimeout(() => setSaved(false), 2500);
    });
  };

  return (
    <Card>
      <div className="border-b border-linesoft px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="eyebrow mb-1">{noteId ? 'Note' : 'New note'}</p>
            <h2 className="font-display text-lg font-semibold text-ink">
              {noteId ? title || 'Untitled note' : 'Capture it while it is fresh'}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPinned((p) => !p)}
              aria-pressed={pinned}
              className={`no-tap-flash flex items-center gap-1.5 rounded-[4px] border px-2.5 py-1.5 text-xs transition-all duration-120 ${
                pinned
                  ? 'border-ochre bg-ochre/10 text-ochre'
                  : 'border-line bg-paper2 text-inkfaint hover:border-ochre hover:text-ochre'
              }`}
            >
              <Pin size={13} aria-hidden="true" className={pinned ? 'fill-current' : ''} />
              {pinned ? 'Pinned' : 'Pin'}
            </button>
          </div>
        </div>
        {initial.updatedAt ? (
          <p className="mt-1 text-xs text-inkfaint">Last edited {relativeTime(initial.updatedAt)}</p>
        ) : null}
      </div>

      <CardBody>
        <form
          action={submit}
          className="space-y-4"
          onSubmit={() => {
            setSaved(false);
          }}
        >
          <Field label="Title" htmlFor="note-title">
            <input
              id="note-title"
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={160}
              placeholder="Conditions for a one-sample t interval"
              required
            />
          </Field>

          <Field label="Attach to" hint="Optional. Attached notes surface on the page they belong to.">
            <div className="grid gap-2 sm:grid-cols-3">
              <select
                className="select"
                aria-label="Course"
                value={courseId}
                onChange={(e) => {
                  setCourseId(e.target.value);
                  setUnitId('');
                  setTopicId('');
                }}
              >
                <option value="">No course</option>
                {options.map((c) => (
                  <option key={c.courseId} value={c.courseId}>
                    {c.courseCode}
                  </option>
                ))}
              </select>
              <select
                className="select"
                aria-label="Unit"
                value={unitId}
                disabled={!course}
                onChange={(e) => {
                  setUnitId(e.target.value);
                  setTopicId('');
                }}
              >
                <option value="">Whole course</option>
                {course?.units.map((u) => (
                  <option key={u.id} value={u.id}>
                    Unit {u.code}
                  </option>
                ))}
              </select>
              <select
                className="select"
                aria-label="Topic"
                value={topicId}
                disabled={!unit}
                onChange={(e) => setTopicId(e.target.value)}
              >
                <option value="">Whole unit</option>
                {unit?.topics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.code} {t.title}
                  </option>
                ))}
              </select>
            </div>
          </Field>

          <Field label="Notes" htmlFor="note-body">
            <textarea
              id="note-body"
              className="textarea min-h-56"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={20000}
              placeholder="Plain text. Your own words are worth more than a copied definition."
            />
          </Field>

          <fieldset>
            <legend className="label mb-2">Checklist</legend>
            {checklist.length ? (
              <ul className="mb-2 space-y-1.5">
                {checklist.map((item, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[var(--accent)]"
                      checked={item.done}
                      onChange={(e) =>
                        setChecklist((prev) =>
                          prev.map((it, j) => (j === i ? { ...it, done: e.target.checked } : it)),
                        )
                      }
                      aria-label={`Mark "${item.text}" ${item.done ? 'not done' : 'done'}`}
                    />
                    <span
                      className={`flex-1 text-sm ${
                        item.done ? 'text-inkghost line-through' : 'text-ink'
                      }`}
                    >
                      {item.text}
                    </span>
                    <button
                      type="button"
                      className="no-tap-flash rounded-[4px] p-1 text-inkghost hover:text-bad"
                      aria-label={`Remove "${item.text}"`}
                      onClick={() => setChecklist((prev) => prev.filter((_, j) => j !== i))}
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mb-2 text-xs text-inkfaint">
                No checklist items yet. Good for &ldquo;things I still have to redo&rdquo;.
              </p>
            )}
            <div className="flex gap-2">
              <label className="sr-only" htmlFor="checklist-add">
                New checklist item
              </label>
              <input
                id="checklist-add"
                className="input h-9 flex-1"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={300}
                placeholder="Add an item"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (!draft.trim()) return;
                    setChecklist((prev) => [...prev, { text: draft.trim(), done: false }]);
                    setDraft('');
                  }
                }}
              />
              <Button
                type="button"
                size="sm"
                disabled={!draft.trim() || checklist.length >= 100}
                onClick={() => {
                  setChecklist((prev) => [...prev, { text: draft.trim(), done: false }]);
                  setDraft('');
                }}
              >
                <Plus size={14} aria-hidden="true" />
                Add
              </Button>
            </div>
          </fieldset>

          {error ? <p className="field-error">{error}</p> : null}

          <div className="flex flex-wrap items-center gap-2 border-t border-linesoft pt-4">
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? 'Saving…' : noteId ? 'Save note' : 'Create note'}
            </Button>
            {saved ? (
              <span className="anim-pop flex items-center gap-1.5 text-sm font-medium text-good">
                <Check size={15} aria-hidden="true" /> Saved
              </span>
            ) : null}
            {noteId ? (
              <Button
                type="button"
                variant="danger"
                className="ml-auto"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await removeNote(noteId);
                    if (res.ok) router.push('/notes');
                  })
                }
              >
                <Trash2 size={14} aria-hidden="true" />
                Delete
              </Button>
            ) : null}
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

/** A note as it appears in lists and on the pages it is attached to. */
export function NoteCard({
  note,
  courseCode,
  breadcrumb,
}: {
  note: { id: string; title: string; body: string; checklist: { text: string; done: boolean }[]; pinned: boolean; updatedAt: string };
  courseCode?: string;
  breadcrumb?: string;
}) {
  const done = note.checklist.filter((c) => c.done).length;
  return (
    <Card className="h-full">
      <CardBody className="px-4 py-3.5">
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
          {note.pinned ? (
            <span className="badge badge-ochre">
              <Pin size={10} aria-hidden="true" className="fill-current" /> pinned
            </span>
          ) : null}
          {courseCode ? <span className="badge">{courseCode}</span> : null}
          {breadcrumb ? <span className="font-mono text-[10.5px] text-inkghost">{breadcrumb}</span> : null}
        </div>
        <Link href={`/notes/${note.id}`} className="block">
          <h3 className="font-display text-base font-semibold text-ink hover:text-accent">
            {note.title}
          </h3>
        </Link>
        {note.body ? (
          <p className="mt-1.5 line-clamp-3 whitespace-pre-wrap text-sm leading-relaxed text-inksoft">
            {note.body}
          </p>
        ) : null}
        <p className="mt-2.5 text-[11px] text-inkfaint">
          {note.checklist.length
            ? `${done}/${note.checklist.length} checklist items · `
            : ''}
          edited {relativeTime(note.updatedAt)}
        </p>
      </CardBody>
    </Card>
  );
}
