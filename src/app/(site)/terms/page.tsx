import { LegalShell, Section } from '@/components/legal/legal-shell';

export const metadata = { title: 'Terms of service' };

export default function TermsPage() {
  return (
    <LegalShell eyebrow="Policy" title="Terms of service" updated="2 September 2026">
      <Section n="1" title="Acceptance">
        <p>
          By creating an account or using SelfAP you agree to these terms. If you do not agree, do
          not use the service. If you are under the age of majority where you live, a parent or
          guardian must agree on your behalf.
        </p>
      </Section>

      <Section n="2" title="The service">
        <p>
          SelfAP is a study-planning and practice tool. It gives you curriculum structure, a study
          timer, original practice questions, progress tracking and notes. It is not a school, not
          a tutor, and not a credential. Nothing in SelfAP awards credit, and no score you see in
          the app is a College Board score or a prediction of one.
        </p>
      </Section>

      <Section n="3" title="Original content and what we do not host">
        <p>
          All lessons, practice questions, rubrics and reference material in SelfAP are original
          works created for this product. They are written to the publicly published question
          types, skills and formats of each AP course, but they are not reproductions of past exam
          questions and not extracts from any textbook.
        </p>
        <p>
          SelfAP does not host, mirror, upload or redistribute official College Board exam
          material, and does not scrape or store copyrighted third-party content. Links to official
          resources open on the publisher&rsquo;s own site and are provided for reference only.
        </p>
        <p>
          Some lessons embed video from third-party hosts. That video remains the property of its
          creator, is embedded in accordance with the host&rsquo;s terms, and is never downloaded
          or redistributed. Where a video cannot lawfully be embedded, SelfAP links to it instead
          and labels it as an external resource.
        </p>
      </Section>

      <Section n="4" title="Your account">
        <p>
          You are responsible for keeping your credentials secret and for activity under your
          account. Tell us promptly if you believe your account has been compromised. One account
          per person; do not share credentials.
        </p>
      </Section>

      <Section n="5" title="Acceptable use">
        <p>
          You agree not to: attempt to access another user&rsquo;s data; circumvent access
          controls or row-level security; probe or disrupt the service; resell, sublicense or
          republish SelfAP content; or use automated means to extract the curriculum in bulk.
        </p>
      </Section>

      <Section n="6" title="Your content">
        <p>
          Notes you write belong to you. You grant SelfAP a limited licence to store and display
          them to you, and to keep backups of them, for the sole purpose of operating the service.
          We do not use your notes to train models or to build products for anyone else.
        </p>
      </Section>

      <Section n="7" title="Availability and change">
        <p>
          We aim for the service to be available but do not promise uninterrupted access. We may
          change, suspend or discontinue features, and may change these terms, with the updated
          date shown on this page. Material changes affecting existing accounts will be
          communicated in advance where practicable.
        </p>
      </Section>

      <Section n="8" title="No warranty">
        <p>
          The service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;, without
          warranty of any kind, express or implied, including warranties of merchantability,
          fitness for a particular purpose and non-infringement. Study outcomes depend on many
          factors outside this tool&rsquo;s control and no result is guaranteed.
        </p>
      </Section>

      <Section n="9" title="Limitation of liability">
        <p>
          To the maximum extent permitted by law, SelfAP will not be liable for indirect,
          incidental, consequential or punitive damages, or for lost profits or lost data. Our
          total liability for any claim arising out of or relating to the service is limited to
          the amount you paid us in the twelve months before the claim.
        </p>
      </Section>

      <Section n="10" title="Termination">
        <p>
          You may delete your account at any time from Settings; deletion is immediate and
          permanent. We may suspend or terminate an account that breaches these terms. On
          termination your right to use the service ends, and your data is deleted as described in
          the privacy policy.
        </p>
      </Section>

      <Section n="11" title="Trademarks and non-affiliation">
        <p>
          SelfAP is an independent product and is not affiliated with, endorsed by, sponsored by,
          or approved by the College Board. AP, Advanced Placement and the AP designation are
          registered trademarks of the College Board, which was not involved in the production of
          SelfAP and does not endorse it.
        </p>
      </Section>

      <Section n="12" title="Governing law">
        <p>
          These terms are governed by the laws of the jurisdiction in which SelfAP operates,
          without regard to conflict-of-law rules. Any dispute will be resolved in the courts of
          that jurisdiction. Nothing here removes rights you cannot waive under your local
          consumer-protection law.
        </p>
      </Section>
    </LegalShell>
  );
}
