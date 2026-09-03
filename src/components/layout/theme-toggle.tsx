'use client';

import { useSyncExternalStore } from 'react';
import { Moon, Sun } from 'lucide-react';

type Theme = 'paper' | 'ink';

/**
 * Paper (light) and Ink (dark).
 *
 * The theme lives on `<html data-theme>` and is applied pre-paint by
 * `ThemeScript`, so it is external state. Reading it through
 * `useSyncExternalStore` keeps React in sync without a mount-time setState
 * pass, and the server snapshot avoids a hydration mismatch.
 */

function subscribe(callback: () => void): () => void {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
  return () => observer.disconnect();
}

function readTheme(): Theme {
  return document.documentElement.getAttribute('data-theme') === 'ink' ? 'ink' : 'paper';
}

function serverTheme(): Theme {
  return 'paper';
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, readTheme, serverTheme);

  function toggle() {
    const next: Theme = theme === 'ink' ? 'paper' : 'ink';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('selfap-theme', next);
    } catch {
      // Private browsing — the theme simply will not persist.
    }
  }

  const Icon = theme === 'ink' ? Sun : Moon;
  return (
    <button
      type="button"
      onClick={toggle}
      className="btn btn-quiet btn-sm px-2"
      aria-label={`Switch to ${theme === 'ink' ? 'paper' : 'ink'} theme`}
      title={theme === 'ink' ? 'Paper theme' : 'Ink theme'}
    >
      <Icon size={16} aria-hidden="true" />
    </button>
  );
}
