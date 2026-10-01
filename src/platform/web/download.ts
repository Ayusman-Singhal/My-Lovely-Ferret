// Hand a backup file to the browser's download. Shared by the menu and the dev panel.

import type { SaveStore } from '../saveStore';

export async function downloadBackup(store: SaveStore): Promise<void> {
  const blob = await store.export();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = store.exportFileName();
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
