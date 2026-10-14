export function normalizeLink(input: string): string | null {
  const value = input.trim();
  if (!value || value.length >= 2048 || /\s/.test(value)) return null;
  if (/^mailto:/i.test(value))
    return /^mailto:[^@?]+@[^@?]+(?:\?.*)?$/i.test(value) ? value : null;
  if (/^[a-z][a-z\d+.-]*:/i.test(value) && !/^https?:\/\//i.test(value))
    return null;
  const href = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(href);
    if (!url.hostname || url.username || url.password) return null;
    // Bare addresses must look like a domain; explicit URLs can use localhost.
    if (!/^https?:\/\//i.test(value) && !url.hostname.includes("."))
      return null;
    return href.length < 2048 ? href : null;
  } catch {
    return null;
  }
}
