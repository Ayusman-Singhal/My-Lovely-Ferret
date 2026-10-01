import { t } from '../../i18n/t';

interface ErrorBannerProps {
  copied: boolean;
  onCopy(): void;
  onDismiss(): void;
}

/** A small notice after an uncaught error, with "copy error details" for the tester (guide §25.3). */
export function ErrorBanner({ copied, onCopy, onDismiss }: ErrorBannerProps) {
  return (
    <div class="notice notice-error" role="alert">
      <p>{copied ? t('error.copied') : t('error.banner')}</p>
      <div class="notice-actions">
        <button type="button" onClick={onCopy}>
          {t('error.copy')}
        </button>
        <button type="button" onClick={onDismiss}>
          {t('error.dismiss')}
        </button>
      </div>
    </div>
  );
}

/** iOS Safari outside the Home Screen can delete saved data after about a week (guide §8). */
export function IosNotice({ onDismiss }: { onDismiss(): void }) {
  return (
    <div class="notice" role="note">
      <p>{t('ios.notice')}</p>
      <div class="notice-actions">
        <button type="button" onClick={onDismiss}>
          {t('ios.dismiss')}
        </button>
      </div>
    </div>
  );
}
