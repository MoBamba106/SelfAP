'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Download, Trash2 } from 'lucide-react';
import { buildDataExport, destroyAccount, saveProfile } from '@/lib/actions/workspace';
import { WEEKDAY_LONG } from '@/lib/utils/time';
import { Button, Card, CardBody, Field } from '@/components/ui/primitives';

/**
 * IANA zone list, resolved once.
 *
 * `Intl.supportedValuesOf` is deterministic and present on the server too, so
 * this does not need an effect — and computing it during render avoids a
 * cascading second render on mount.
 */
const TIME_ZONES: string[] = (() => {
  try {
    const all = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] })
      .supportedValuesOf?.('timeZone');
    return all && all.length ? all : [];
  } catch {
    return [];
  }
})();

/* ------------------------------------------------------------- profile */

export function ProfileForm({
  displayName,
  timezone,
  weekStartDay,
  examYear,
}: {
  displayName: string;
  timezone: string;
  weekStartDay: number;
  examYear: number | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = (formData: FormData) => {
    start(async () => {
      setError(null);
      const year = formData.get('examYear');
      const res = await saveProfile({
        displayName: String(formData.get('displayName') ?? '').trim(),
        timezone: String(formData.get('timezone') ?? timezone),
        weekStartDay: Number(formData.get('weekStartDay') ?? weekStartDay),
        examYear: year ? Number(year) : null,
      });
      if (!res.ok) {
        setError(res.message ?? 'Could not save.');
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
        <p className="eyebrow mb-1">Profile</p>
        <h2 className="font-display text-lg font-semibold text-ink">About you</h2>
      </div>
      <CardBody>
        <form action={submit} className="space-y-4">
          <Field label="Display name" htmlFor="displayName" hint="Shown on your dashboard.">
            <input
              id="displayName"
              name="displayName"
              className="input"
              defaultValue={displayName}
              required
              maxLength={60}
              autoComplete="name"
            />
          </Field>

          <Field
            label="Time zone"
            htmlFor="timezone"
            hint="Weeks and streaks are calculated in this zone."
          >
            <select id="timezone" name="timezone" className="select" defaultValue={timezone}>
              {!TIME_ZONES.includes(timezone) ? <option value={timezone}>{timezone}</option> : null}
              {TIME_ZONES.map((zone) => (
                <option key={zone} value={zone}>
                  {zone.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Week starts on" htmlFor="weekStartDay">
            <select
              id="weekStartDay"
              name="weekStartDay"
              className="select"
              defaultValue={String(weekStartDay)}
            >
              {WEEKDAY_LONG.map((label, i) => (
                <option key={label} value={String(i)}>
                  {label}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Exam year"
            htmlFor="examYear"
            hint="Optional. Used to tell you how much runway you have left."
          >
            <input
              id="examYear"
              name="examYear"
              className="input"
              type="number"
              min={2024}
              max={2035}
              defaultValue={examYear ?? ''}
              placeholder="2027"
            />
          </Field>

          {error ? <p className="field-error">{error}</p> : null}

          <div className="flex items-center gap-3">
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? 'Saving…' : 'Save changes'}
            </Button>
            {saved ? (
              <span className="anim-pop flex items-center gap-1.5 text-sm font-medium text-good">
                <Check size={15} aria-hidden="true" /> Saved
              </span>
            ) : null}
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

/* -------------------------------------------------------------- export */

export function DataExport() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const download = () => {
    start(async () => {
      setError(null);
      const res = await buildDataExport();
      if (!res.ok || !res.data) {
        setError(res.message ?? 'Could not build the export.');
        return;
      }
      const blob = new Blob([JSON.stringify(res.data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `selfap-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
  };

  return (
    <Card>
      <div className="border-b border-linesoft px-4 py-3 sm:px-5">
        <p className="eyebrow mb-1">Your data</p>
        <h2 className="font-display text-lg font-semibold text-ink">Export</h2>
      </div>
      <CardBody>
        <p className="mb-4 text-sm leading-relaxed text-inksoft">
          A single JSON file with your profile, courses and goals, every logged study session,
          practice attempts, lesson progress, notes and plans. Nothing is transformed — it is the
          same rows the app reads.
        </p>
        {error ? <p className="field-error mb-3">{error}</p> : null}
        <Button onClick={download} disabled={pending}>
          <Download size={14} aria-hidden="true" />
          {pending ? 'Preparing…' : 'Download my data'}
        </Button>
      </CardBody>
    </Card>
  );
}

/* ------------------------------------------------------------- deletion */

export function DangerZone({ summary }: { summary: { courses: number; completion: number; accuracy: number | null; email: string } }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState('');
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = (formData: FormData) => {
    start(async () => {
      setError(null);
      const res = await destroyAccount(String(formData.get('confirm') ?? ''));
      if (!res.ok) {
        setError(res.message ?? 'Could not delete the account.');
        return;
      }
      router.push('/');
      router.refresh();
    });
  };

  return (
    <Card spine="bad">
      <div className="border-b border-linesoft px-4 py-3 sm:px-5">
        <p className="eyebrow mb-1 text-bad">Danger zone</p>
        <h2 className="font-display text-lg font-semibold text-ink">Delete account</h2>
      </div>
      <CardBody>
        <p className="text-sm leading-relaxed text-inksoft">
          This permanently removes <span className="font-mono text-ink">{summary.email}</span> and
          everything attached to it — your{' '}
          <strong className="font-semibold text-ink">{summary.courses}</strong> course
          {summary.courses === 1 ? '' : 's'}, every logged study session, every practice attempt,
          your notes and your plans. There is no undo and no support queue to undo it for you.
          Export your data first if you might want it.
        </p>
        <form action={submit} className="mt-4">
          <Field
            label="Type DELETE to confirm"
            htmlFor="confirm"
            hint="Case sensitive. Nothing is deleted without it."
          >
            <input
              id="confirm"
              name="confirm"
              className="input"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </Field>
          {error ? <p className="field-error mt-2">{error}</p> : null}
          <Button
            type="submit"
            variant="danger"
            className="mt-3"
            disabled={pending || confirm.trim().toUpperCase() !== 'DELETE'}
          >
            <Trash2 size={14} aria-hidden="true" />
            {pending ? 'Deleting…' : 'Delete everything'}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
