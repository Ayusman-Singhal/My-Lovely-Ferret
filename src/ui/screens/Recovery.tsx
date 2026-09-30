import { useRef, useState } from 'preact/hooks';
import { t, tDynamic } from '../../i18n/t';
import { ImportError, type SaveStore } from '../../platform/saveStore';

interface RecoveryProps {
  kind: 'corrupt' | 'too_new';
  store: SaveStore;
  /** Start fresh: only offered when the save cannot be read at all. */
  onStartOver(): void;
}

/** Shown instead of a broken pet when the save cannot be used (guide §8). Nothing is deleted. */
export function Recovery({ kind, store, onStartOver }: RecoveryProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');

  const importFile = async (file: File): Promise<void> => {
    try {
      await store.import(file);
      window.location.reload();
    } catch (e) {
      setMessage(e instanceof ImportError ? tDynamic(`import.error.${e.reason}`) : t('menu.exportFailed'));
    }
  };

  return (
    <div class="app onboarding">
      <div class="sheet full">
        {kind === 'corrupt' ? (
          <div class="stack">
            <h1 class="title">{t('recovery.corruptTitle')}</h1>
            <p>{t('recovery.corruptBody')}</p>
            <button type="button" class="primary" onClick={() => fileInput.current?.click()}>
              {t('recovery.import')}
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const file = (e.currentTarget as HTMLInputElement).files?.[0];
                (e.currentTarget as HTMLInputElement).value = '';
                if (file) void importFile(file);
              }}
            />
            <button type="button" onClick={onStartOver}>
              {t('recovery.startOver')}
            </button>
            <p class="error" role="alert">
              {message}
            </p>
          </div>
        ) : (
          <div class="stack">
            <h1 class="title">{t('recovery.tooNewTitle')}</h1>
            <p>{t('recovery.tooNewBody')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
