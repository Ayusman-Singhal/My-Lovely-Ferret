import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

interface DialogProps {
  title: string;
  children: ComponentChildren;
  /** Called when the player presses Escape. */
  onClose?: () => void;
}

/** A simple modal card. Focus moves into it when it opens, and Escape closes it. */
export function Dialog({ title, children, onClose }: DialogProps) {
  const card = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const first = card.current?.querySelector<HTMLElement>('button, input, [tabindex]');
    first?.focus();
    if (!onClose) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div class="overlay">
      <div class="card" role="dialog" aria-modal="true" aria-label={title} ref={card}>
        <h2 class="card-title">{title}</h2>
        {children}
      </div>
    </div>
  );
}
