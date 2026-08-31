const OPEN_MODAL_SELECTOR = [
  '[role="dialog"][data-state="open"]',
  '[role="alertdialog"][data-state="open"]',
].join(',');

/**
 * Radix disables pointer events on the page while a modal is open. When a
 * controlled modal is removed during an async action, that inline style can
 * occasionally survive the portal. Recover it only after the last modal has
 * actually closed so nested dialogs keep their modal behaviour.
 */
export function scheduleModalInteractionRecovery(): void {
  if (typeof document === 'undefined') return;

  const recover = () => {
    if (document.querySelector(OPEN_MODAL_SELECTOR)) return;
    document.body.style.removeProperty('pointer-events');
  };

  requestAnimationFrame(() => requestAnimationFrame(recover));
  window.setTimeout(recover, 250);
}
