import { useState } from 'preact/hooks';
import type { SaveFile } from '../../core/save';
import type { PetRecord } from '../../core/types';
import { buildAboutPet } from '../../game/aboutPet';
import { buildFeedbackText, mailtoUrl } from '../../game/feedback';
import { t } from '../../i18n/t';
import { copyText } from '../../platform/web/clipboard';
import { Dialog } from './Dialog';

interface FeedbackDialogProps {
  pet: PetRecord;
  tester: SaveFile['tester'];
  nowMs: number;
  onClose(): void;
}

// Where feedback goes is set when the app is built, so no address is written into the code:
//   VITE_FEEDBACK_EMAIL     an address for the "Send by email" button
//   VITE_FEEDBACK_FORM_URL  a link to a hosted form for the "Open feedback form" button
// Without either, the tester can still copy the text and send it any way they like.
const FEEDBACK_EMAIL = (import.meta.env['VITE_FEEDBACK_EMAIL'] as string | undefined) || '';
const FEEDBACK_FORM_URL = (import.meta.env['VITE_FEEDBACK_FORM_URL'] as string | undefined) || '';

/** One-tap feedback (guide §25.3). Sent only if the tester presses a button: no account, no tracking. */
export function FeedbackDialog({ pet, tester, nowMs, onClose }: FeedbackDialogProps) {
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('');
  const about = buildAboutPet(pet, tester, nowMs);
  const text = buildFeedbackText(message, about, {
    version: __APP_VERSION__,
    userAgent: navigator.userAgent,
    language: navigator.language,
    nowIso: new Date(nowMs).toISOString(),
  });

  const copy = async (): Promise<void> => setStatus((await copyText(text)) ? t('feedback.copied') : t('feedback.copyFailed'));

  return (
    <Dialog title={t('feedback.title')} onClose={onClose}>
      <div class="stack">
        <label for="feedback-message">{t('feedback.prompt')}</label>
        <textarea
          id="feedback-message"
          rows={4}
          value={message}
          onInput={(e) => setMessage((e.currentTarget as HTMLTextAreaElement).value)}
          aria-label={t('feedback.label')}
        />
        {FEEDBACK_EMAIL && (
          <a class="button primary" href={mailtoUrl(FEEDBACK_EMAIL, `Ferret feedback (${__APP_VERSION__})`, text)}>
            {t('feedback.email')}
          </a>
        )}
        {FEEDBACK_FORM_URL && (
          <a class="button" href={FEEDBACK_FORM_URL} target="_blank" rel="noopener noreferrer">
            {t('feedback.form')}
          </a>
        )}
        <button type="button" class={FEEDBACK_EMAIL ? '' : 'primary'} onClick={() => void copy()}>
          {t('feedback.copy')}
        </button>
        <p class="status" role="status">
          {status}
        </p>
        <details>
          <summary>{t('feedback.preview')}</summary>
          <pre class="preview">{text}</pre>
        </details>
        <p class="muted">{t('feedback.privacy')}</p>
        <button type="button" onClick={onClose}>
          {t('feedback.close')}
        </button>
      </div>
    </Dialog>
  );
}
