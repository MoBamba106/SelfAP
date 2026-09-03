import { Card, CardBody } from '@/components/ui/primitives';

export const metadata = { title: 'Contact' };

const TOPICS = [
  {
    title: 'Something in the content is wrong',
    body: 'This is the report we most want to hear. Tell us the course, the topic code and what is wrong — a mislabelled answer, an outdated exam weight, a formula that does not match the current framework.',
  },
  {
    title: 'Your data or your account',
    body: 'Export and deletion are self-service in Settings. If either fails, or you want something that is not on that page, tell us here.',
  },
  {
    title: 'A copyright or trademark concern',
    body: 'Mark your message DMCA. Include the specifics listed on the DMCA page so we can act on it without a second round trip.',
  },
  {
    title: 'A bug or a broken page',
    body: 'What you were doing, what you expected, what happened. A screenshot and the device you were on help more than you would think.',
  },
  {
    title: 'A course you want added',
    body: 'The architecture is not tied to the launch courses. Tell us which AP you are sitting and when.',
  },
];

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-6">
        <p className="eyebrow mb-1.5">Contact</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Talk to us
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-inksoft">
          One small team, reading every message. Corrections to the curriculum are the ones we act
          on fastest — a wrong answer key costs a student real time.
        </p>
      </header>

      <div className="callout mb-6" data-kind="note">
        <span className="callout-label">Before you write</span>
        <p className="text-sm leading-relaxed text-inksoft">
          SelfAP is not affiliated with the College Board and cannot answer questions about exam
          registration, score reports, accommodations or fee waivers. Those go to the College
          Board directly. We can help with anything inside this app.
        </p>
      </div>

      <ul className="mb-8 space-y-3">
        {TOPICS.map((topic) => (
          <li key={topic.title} className="card px-4 py-3.5">
            <h2 className="font-display text-base font-semibold text-ink">{topic.title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-inksoft">{topic.body}</p>
          </li>
        ))}
      </ul>

      <Card>
        <CardBody>
          <p className="eyebrow mb-1.5">Email</p>
          <p className="text-sm leading-relaxed text-inksoft">
            Send mail to <span className="font-mono text-ink">hello@selfap.study</span>. This
            address is a placeholder in the open-source build — point it at your own inbox before
            you deploy, and add a real reply-to in your transactional email provider.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-inksoft">
            We aim to reply within three working days. Security reports should say so in the
            subject line and will be handled ahead of everything else.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
