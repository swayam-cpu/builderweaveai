const PUBLISHED_ORIGIN = "https://builderweave.lovable.app";

export function getPublicSiteUrl(slug: string) {
  if (typeof window === "undefined") return `${PUBLISHED_ORIGIN}/s/${slug}`;

  const { origin, hostname } = window.location;
  const isPublicLovableApp = hostname.endsWith(".lovable.app") && !hostname.startsWith("id-preview--");

  if (isPublicLovableApp) return `${origin}/s/${slug}`;
  return `${PUBLISHED_ORIGIN}/s/${slug}`;
}