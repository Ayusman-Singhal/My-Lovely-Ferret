import { useRef, useState } from 'preact/hooks';
import { t, tDynamic } from '../../i18n/t';
import { ImportError, type SaveStore } from '../../platform/saveStore';
import { Dialog } from './Dialog';

interface MenuDialogProps {
  petName: string;
  /** Null in preview mode: there is nothing to export or import. */
  store: SaveStore | null;
  /** Save first, so the backup has the latest state. */
  beforeExport(): Promise<void>;
  onClose(): void;
}

/** Export and import a backup (guide §8). Backups never contain the installId. */
export function MenuDialog({ petName, store, beforeExport, onClose }: MenuDialogProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState<File | null>(null);

  const doExport = async (): Promise<void> => {
    if (!store) return;
    try {
      await beforeExport();
      const blob = await store.export();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = store.exportFileName();
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setMessage(t('menu.exportDone'));
    } catch {
      setMessage(t('menu.exportFailed'));
    }
  };

  const doImport = async (file: File): Promise<void> => {
    if (!store) return;
    try {
      await store.import(file);
      window.location.reload(); // the app starts again from the restored save
    } catch (e) {
      setPending(null);
      setMessage(e instanceof ImportError ? tDynamic(`import.error.${e.reason}`) : t('menu.exportFailed'));
    }
  };

  if (pending) {
    return (
      <Dialog title={t('menu.import')} onClose={() => setPending(null)}>
        <p>{t('menu.importConfirm', { name: petName })}</p>
        <div class="row">
          <button type="button" class="primary" onClick={() => void doImport(pending)}>
            {t('menu.importYes')}
          </button>
          <button type="button" onClick={() => setPending(null)}>
            {t('menu.importNo')}
          </button>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog title={t('menu.title')} onClose={onClose}>
      {store ? (
        <div class="stack">
          <button type="button" onClick={() => void doExport()}>
            {t('menu.export')}
          </button>
          <button type="button" onClick={() => fileInput.current?.click()}>
            {t('menu.import')}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const file = (e.currentTarget as HTMLInputElement).files?.[0];
              (e.currentTarget as HTMLInputElement).value = '';
              if (file) setPending(file);
            }}
          />
        </div>
      ) : null}
      <p class="status" role="status">
        {message}
      </p>
      <p class="muted">{t('menu.version')}</p>
      <button type="button" onClick={onClose}>
        {t('menu.close')}
      </button>
    </Dialog>
  );
}
