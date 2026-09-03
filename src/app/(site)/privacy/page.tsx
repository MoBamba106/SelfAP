import { LegalShell, Section } from '@/components/legal/legal-shell';

export const metadata = { title: 'Privacy policy' };

export default function PrivacyPage() {
  return (
    <LegalShell eyebrow="Policy" title="Privacy policy" updated="2 September 2026">
      <Section n="1" title="What we collect">
        <p>
          SelfAP collects the minimum needed to run a study tool. When you create an account we
          store your email address, a display name you choose, your time zone and your chosen
          week start. While you use the app we store the study sessions you log, the practice
          answers you submit, the lessons you complete, the notes you write and the plans you
          set.
        </p>
        <p>
          We do not collect precise location, contacts, advertising identifiers or data from
          third-party data brokers. There is no advertising on SelfAP and no sale or rental of
          personal information.
        </p>
      </Section>

      <Section n="2" title="How your data is isolated">
        <p>
          Every record you create carries your user identifier. Access control is enforced in
          Postgres through row-level security policies, which means the database itself refuses to
          return another user&rsquo;s rows — the application is not the only thing standing between
          your data and someone else&rsquo;s. The browser never receives a credential capable of
          bypassing those policies.
        </p>
        <p>
          Curriculum content is published read-only. Writing to it requires an administrative role
          that is not reachable from the student-facing application.
        </p>
      </Section>

      <Section n="3" title="Study sessions and how they are used">
        <p>
          A study session records when it started, when it ended, the course, unit, topic and
          lesson you selected, and the duration. Sessions are never deleted when a weekly target
          resets: weekly progress is calculated from your stored history rather than stored as a
          running total that gets overwritten.
        </p>
        <p>
          Sessions longer than four hours are truncated to four hours, and any session that was
          never closed properly is reconstructed from its last heartbeat. This prevents an
          abandoned tab from producing an impossible amount of study time.
        </p>
      </Section>

      <Section n="4" title="Embedded video">
        <p>
          Video lessons are loaded through a privacy-enhanced embed host, and only after you
          choose to play them. No video is loaded, and no third-party cookie is set, until that
          happens. Your resume position is stored by SelfAP on your account, not by the video
          host. SelfAP does not host, download or redistribute third-party video files.
        </p>
      </Section>

      <Section n="5" title="Your rights">
        <p>
          You can export everything we hold about you as a single JSON file from Settings, at any
          time, without asking us. You can delete your account and all attached data from the same
          page; deletion is permanent and immediate. You can correct your profile at any time.
        </p>
        <p>
          Depending on where you live you may have additional rights — access, rectification,
          erasure, restriction, portability and objection. To exercise any of them, contact us
          through the contact page. We will respond within the period required by applicable law.
        </p>
      </Section>

      <Section n="6" title="Children">
        <p>
          SelfAP is intended for students studying Advanced Placement courses, who are typically
          14 or older. We do not knowingly collect data from children under 13. If you believe a
          child under 13 has created an account, contact us and we will delete it.
        </p>
      </Section>

      <Section n="7" title="Retention">
        <p>
          Study data is kept for as long as your account exists, because its value to you is the
          history. When you delete your account, your rows are removed. Backups age out on the
          schedule of the hosting provider; see the terms for the hosting arrangement.
        </p>
      </Section>

      <Section n="8" title="Security">
        <p>
          Authentication is handled by a managed identity provider; SelfAP never stores your
          password. Traffic is encrypted in transit, response headers restrict framing and content
          sniffing, and server actions validate every input against a schema before it reaches the
          database.
        </p>
        <p>
          No system is perfectly secure. If you become aware of a vulnerability, tell us through
          the contact page and we will act on it.
        </p>
      </Section>

      <Section n="9" title="Changes">
        <p>
          If this policy changes materially we will update the date at the top of the page and,
          where the change affects how existing data is used, notify you before it takes effect.
        </p>
      </Section>

      <Section n="10" title="College Board">
        <p>
          SelfAP is an independent study tool. It is not affiliated with, endorsed by, sponsored
          by, or approved by the College Board. AP and Advanced Placement are registered
          trademarks of the College Board. Exam formats summarised in this app are drawn from
          publicly published course and exam descriptions; official documents are linked to their
          publisher and are not hosted here.
        </p>
      </Section>
    </LegalShell>
  );
}
