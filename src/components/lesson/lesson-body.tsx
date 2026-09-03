import type { ContentBlock, LessonWithVideos } from '@/content';
import { RichText, RichLines } from './rich-text';
import { VideoPlayer } from './video-player';

function Block({ block }: { block: ContentBlock }) {
  switch (block.type) {
    case 'p':
      return (
        <p>
          <RichText text={block.text} />
        </p>
      );
    case 'h':
      return (
        <h4>
          <RichText text={block.text} />
        </h4>
      );
    case 'ul':
      return (
        <ul>
          {block.items.map((item, i) => (
            <li key={i}>
              <RichText text={item} />
            </li>
          ))}
        </ul>
      );
    case 'ol':
      return (
        <ol>
          {block.items.map((item, i) => (
            <li key={i}>
              <RichText text={item} />
            </li>
          ))}
        </ol>
      );
    case 'callout':
      return (
        <div className="callout" data-kind={block.kind}>
          <span className="callout-label">{block.label}</span>
          <RichLines text={block.text} />
        </div>
      );
    case 'formula':
      return (
        <div className="formula">
          <span className="formula-label">{block.label}</span>
          <pre className="m-0 whitespace-pre-wrap font-mono">{block.expression}</pre>
        </div>
      );
    case 'table':
      return (
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                {block.head.map((h) => (
                  <th key={h} scope="col">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j}>
                      <RichText text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    default:
      return null;
  }
}

export function LessonBody({ lesson }: { lesson: LessonWithVideos }) {
  return (
    <div className="prose">
      {lesson.body.map((block, i) => (
        <Block key={i} block={block} />
      ))}
    </div>
  );
}

export { VideoPlayer };
