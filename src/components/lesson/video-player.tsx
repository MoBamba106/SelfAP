'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, Play } from 'lucide-react';
import type { LessonVideo } from '@/content';
import { formatDuration } from '@/lib/utils/time';
import { storeVideoPosition } from '@/lib/actions/study';

/**
 * Embedded video lesson.
 *
 * Rules this component follows:
 *   • Only providers that publish an embeddable player are framed. Anything
 *     else renders as an explicitly-labelled external link — we never try to
 *     work around a publisher's embedding restriction.
 *   • The iframe is not created until the student presses play, so no third
 *     party learns about a page view they did not ask for and the lesson
 *     stays fast on a phone.
 *   • Watch position is saved every 15 seconds so the lesson can resume.
 */
export function VideoPlayer({
  video,
  lessonId,
  resumeAt = 0,
}: {
  video: LessonVideo;
  lessonId: string;
  resumeAt?: number;
}) {
  const [playing, setPlaying] = useState(false);
  const elapsedRef = useRef(resumeAt);
  const lastSaveRef = useRef(resumeAt);

  const save = useCallback(
    (seconds: number) => {
      if (Math.abs(seconds - lastSaveRef.current) < 10) return;
      lastSaveRef.current = seconds;
      void storeVideoPosition(lessonId, Math.round(seconds));
    },
    [lessonId],
  );

  useEffect(() => {
    if (!playing) return;
    const tick = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      elapsedRef.current += 5;
      save(elapsedRef.current);
    }, 5000);
    const onLeave = () => save(elapsedRef.current);
    window.addEventListener('pagehide', onLeave);
    document.addEventListener('visibilitychange', onLeave);
    return () => {
      window.clearInterval(tick);
      window.removeEventListener('pagehide', onLeave);
      document.removeEventListener('visibilitychange', onLeave);
      onLeave();
    };
  }, [playing, save]);

  if (!video.embeddable) {
    return (
      <div className="well flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">{video.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-inkfaint">
            This resource cannot be embedded here, so it opens on its own site.
            {video.durationSeconds ? ` · ${formatDuration(video.durationSeconds)}` : ''}
          </p>
        </div>
        {video.externalUrl ? (
          <a
            className="btn shrink-0"
            href={video.externalUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
          >
            Open resource
            <ExternalLink size={14} aria-hidden="true" />
          </a>
        ) : null}
      </div>
    );
  }

  const src =
    video.provider === 'vimeo'
      ? `https://player.vimeo.com/video/${video.videoId}?autoplay=1`
      : `https://www.youtube-nocookie.com/embed/${video.videoId}?rel=0&modestbranding=1&start=${Math.max(0, Math.floor(resumeAt))}&autoplay=1`;

  return (
    <figure className="m-0">
      <div className="relative aspect-video w-full overflow-hidden rounded-[var(--radius-card)] border border-line bg-paper-deep">
        {playing ? (
          <iframe
            src={src}
            title={video.title}
            className="absolute inset-0 h-full w-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="group absolute inset-0 flex w-full items-center justify-center border-0 bg-paper-deep p-0"
            aria-label={`Play video: ${video.title}`}
          >
            {video.thumbnailUrl ? (
              // Thumbnail is a remote image; the layout reserves the box so
              // nothing shifts when it arrives.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={video.thumbnailUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-cover opacity-90 transition-opacity group-hover:opacity-100"
                loading="lazy"
                width={480}
                height={270}
              />
            ) : null}
            <span className="relative grid h-14 w-14 place-items-center rounded-full bg-accent text-[#fbf7ef] shadow-[var(--shadow-lift)] transition-transform duration-200 group-hover:scale-105">
              <Play size={22} className="ml-0.5" aria-hidden="true" />
            </span>
            {video.durationSeconds ? (
              <span className="absolute bottom-3 right-3 rounded-[4px] bg-[rgba(30,26,22,.82)] px-2 py-1 font-mono text-[11px] text-[#f6efe2]">
                {formatDuration(video.durationSeconds)}
              </span>
            ) : null}
            {resumeAt > 30 ? (
              <span className="absolute bottom-3 left-3 rounded-[4px] bg-[rgba(30,26,22,.82)] px-2 py-1 text-[11px] font-semibold text-[#f6efe2]">
                Resume at {formatDuration(resumeAt)}
              </span>
            ) : null}
          </button>
        )}
      </div>

      <figcaption className="mt-2.5 flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm font-medium text-ink">{video.title}</p>
        {video.attribution ? (
          <p className="max-w-prose text-[11.5px] leading-relaxed text-inkfaint">
            {video.attribution}
          </p>
        ) : null}
      </figcaption>
    </figure>
  );
}
