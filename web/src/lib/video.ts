/** Turn a lesson's video URL into something playable: a YouTube/Vimeo embed or a direct file. */
export type VideoSource = { kind: "embed"; src: string } | { kind: "file"; src: string } | null;

export function videoSource(url?: string): VideoSource {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, "");
  if (host === "youtube.com" || host === "m.youtube.com") {
    const id = u.searchParams.get("v") || u.pathname.split("/").filter(Boolean).at(-1);
    if (id) return { kind: "embed", src: `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1` };
  }
  if (host === "youtu.be") {
    return { kind: "embed", src: `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}?rel=0&modestbranding=1` };
  }
  if (host === "vimeo.com") {
    const id = u.pathname.split("/").filter(Boolean)[0];
    if (id) return { kind: "embed", src: `https://player.vimeo.com/video/${id}` };
  }
  if (host === "player.vimeo.com" || host.endsWith("youtube-nocookie.com")) return { kind: "embed", src: url };
  return { kind: "file", src: url };
}
