import { Fragment, type ReactNode } from 'react';

/* ------------------------------------------------------------------ *
 * Inline markdown for lesson copy.
 *
 * Lesson text is authored content stored as data, not HTML. It is parsed
 * here into React elements, so there is no `dangerouslySetInnerHTML`
 * anywhere in the rendering path — an injected script in a content file
 * would be rendered as text, never executed.
 *
 * Supported: **bold**, *italic*, `code`, [label](https://…)
 * ------------------------------------------------------------------ */

const INLINE = /(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`\n]+`|\[[^\]\n]+\]\([^)\s]+\))/g;

export function RichText({ text }: { text: string }) {
  const parts = text.split(INLINE).filter((p) => p !== '');
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return <code key={i}>{part.slice(1, -1)}</code>;
        }
        if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
          return <em key={i}>{part.slice(1, -1)}</em>;
        }
        if (part.startsWith('[')) {
          const match = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);
          if (match) {
            const href = match[2];
            // Only http(s) links are rendered as links. Anything else stays text.
            if (/^https?:\/\//i.test(href)) {
              return (
                <a key={i} href={href} target="_blank" rel="noopener noreferrer nofollow">
                  {match[1]}
                </a>
              );
            }
            return <Fragment key={i}>{match[1]}</Fragment>;
          }
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}

export function RichLines({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <>
      {lines.map((line, i) => (
        <Fragment key={i}>
          {i > 0 ? <br /> : null}
          <RichText text={line} />
        </Fragment>
      ))}
    </>
  );
}

export type { ReactNode };
