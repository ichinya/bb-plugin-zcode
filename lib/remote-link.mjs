// Keep the exact versioned URL emitted by ZCode. /remote/v4 without
// app_version currently serves a different, older authentication protocol.
export function parseRemoteLink(text) {
  let url;
  try { url = new URL(text.trim()); } catch { throw new Error("The QR link is not a valid URL"); }
  if (url.origin !== "https://zcode.z.ai" || url.username || url.password) throw new Error("Expected an official https://zcode.z.ai QR link");
  if (!/^\/remote\/v4\/?$/.test(url.pathname)) throw new Error("Only versioned ZCode /remote/v4 links are supported");
  if (url.hash || url.searchParams.has("t")) throw new Error("Legacy secret-bearing QR links are not supported; generate a new link in ZCode");
  for (const key of ["sid", "mid", "app_version"]) {
    if (url.searchParams.getAll(key).length !== 1 || !url.searchParams.get(key)?.trim()) throw new Error(`The QR link must contain one ${key} parameter`);
  }
  const version = url.searchParams.get("app_version");
  if (!/^\d+\.\d+\.\d+(?:[-+][a-zA-Z0-9.-]+)?$/.test(version)) throw new Error("Invalid ZCode app_version in QR link");
  if (url.href.length > 8192) throw new Error("The QR link is too long");
  return { url: url.href, origin: url.origin, appVersion: version, clientPath: url.pathname, authentication: "official-web-login", controls: "existing-desktop-window" };
}
