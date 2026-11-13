/**
 * Copy text to the clipboard. The async Clipboard API only exists in secure
 * contexts, so plain-HTTP deployments fall back to a hidden textarea.
 */
export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "true");
  textArea.style.position = "fixed";
  textArea.style.top = "-9999px";
  textArea.style.left = "-9999px";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  const previousFocus = document.activeElement;
  try {
    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, text.length);
    if (!document.execCommand("copy")) {
      throw new Error("copy failed");
    }
  } finally {
    document.body.removeChild(textArea);
    if (previousFocus instanceof HTMLElement) previousFocus.focus();
  }
}
