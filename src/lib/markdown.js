export function sanitizeMarkdownLinkLabel(label) {
  if (!label) return '';
  return label.replace(/[\[\]【】]/g, '').replace(/\s+/g, ' ').trim();
}

export function buildMarkdownLink(label, url) {
  const normalizedUrl = url || '';
  const safeLabel = sanitizeMarkdownLinkLabel(label) || normalizedUrl;
  return normalizedUrl ? `[${safeLabel}](${normalizedUrl})` : safeLabel;
}
