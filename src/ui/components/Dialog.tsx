import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

interface DialogProps {
  title: string;
  children: ComponentChildren;
  /** Called when the player presses Escape. */
  onClose?: () => void;
  /** `bottom` is a sheet along the bottom that leaves the room above it in view and touchable. */
  placement?: 'center' | 'bottom';
  /** A shorter bottom sheet, so more of the room above it shows. */
  compact?: boolean;
}

/** A simple modal card. Focus moves into it when it opens, and Escape closes it. */
export function Dialog({ title, children, onClose, placement = 'center', compact = false }: DialogProps) {
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
    <div class={placement === 'bottom' ? 'overlay bottom' : 'overlay'}>
      <div class={compact ? 'card compact' : 'card'} role="dialog" aria-modal="true" aria-label={title} ref={card}>
        <h2 class="card-title">{title}</h2>
        {children}
      </div>
    </div>
  );
}
