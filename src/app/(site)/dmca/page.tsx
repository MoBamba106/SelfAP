import { LegalShell, Section } from '@/components/legal/legal-shell';

export const metadata = { title: 'DMCA policy' };

export default function DmcaPage() {
  return (
    <LegalShell eyebrow="Policy" title="DMCA and copyright" updated="2 September 2026">
      <Section n="1" title="Our position on copyrighted material">
        <p>
          SelfAP does not host, mirror, upload or redistribute official College Board exam
          questions, past papers, scoring guidelines or textbook content. Every lesson, practice
          question, rubric and reference entry in the app is an original work written for this
          product, informed by publicly published course frameworks and question types.
        </p>
        <p>
          Third-party video is embedded from its own host under that host&rsquo;s terms, never
          downloaded or re-hosted. Where a video cannot lawfully be embedded, SelfAP links to it
          and labels it as an external resource instead.
        </p>
      </Section>

      <Section n="2" title="Reporting infringement">
        <p>
          If you believe material on SelfAP infringes your copyright, send a notification
          containing the information below. We respond to notifications that substantially comply
          with 17 U.S.C. § 512(c)(3).
        </p>
        <ol>
          <li>
            Identification of the copyrighted work claimed to be infringed, or a representative
            list if several works are covered by one notification.
          </li>
          <li>
            Identification of the material claimed to be infringing, with enough detail for us to
            locate it — a URL, and the page or lesson title.
          </li>
          <li>
            Your contact information: name, postal address, telephone number and email address.
          </li>
          <li>
            A statement that you have a good-faith belief that the use is not authorised by the
            copyright owner, its agent, or the law.
          </li>
          <li>
            A statement, made under penalty of perjury, that the information in the notification
            is accurate and that you are the copyright owner or authorised to act on the
            owner&rsquo;s behalf.
          </li>
          <li>
            Your physical or electronic signature.
          </li>
        </ol>
      </Section>

      <Section n="3" title="Where to send it">
        <p>
          Send notifications through the contact page, marked <strong>DMCA</strong> in the subject.
          Do not send unrelated support requests to the same address, as this slows the response to
          genuine notices.
        </p>
      </Section>

      <Section n="4" title="What we do on receipt">
        <p>
          On receiving a compliant notification we will remove or disable access to the identified
          material and, where we can reach the person who put it there, tell them what happened
          and how to file a counter-notification. We may suspend accounts used for repeated
          infringement.
        </p>
      </Section>

      <Section n="5" title="Counter-notification">
        <p>
          If your material was removed and you believe it was a mistake or a misidentification,
          you may send a counter-notification containing: your name, address and telephone number;
          identification of the removed material and where it appeared; a statement under penalty
          of perjury that you have a good-faith belief the removal was a mistake; your consent to
          the jurisdiction of the federal district court for your address (or, outside the United
          States, an appropriate judicial body); and your signature. We may forward it to the
          original complainant.
        </p>
      </Section>

      <Section n="6" title="Misrepresentation">
        <p>
          Under 17 U.S.C. § 512(f), a person who knowingly materially misrepresents that material
          is infringing, or that it was removed by mistake, may be liable for damages including
          costs and attorneys&rsquo; fees. Please consider before you send a notice.
        </p>
      </Section>

      <Section n="7" title="Repeat infringers">
        <p>
          We terminate, in appropriate circumstances, accounts of users who are repeat infringers,
          and we accommodate and do not interfere with standard technical measures used by
          copyright owners to identify or protect their works.
        </p>
      </Section>
    </LegalShell>
  );
}
