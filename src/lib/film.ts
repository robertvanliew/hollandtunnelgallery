/** Embed URL for YouTube/Vimeo (privacy-friendly, captions on, autoplay after the click), or null for a video file. */
export function filmEmbed(url: string): { kind: 'youtube' | 'vimeo'; id: string; src: string } | null {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  if (yt) return { kind: 'youtube', id: yt[1], src: `https://www.youtube-nocookie.com/embed/${yt[1]}?autoplay=1&cc_load_policy=1&rel=0` };
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) return { kind: 'vimeo', id: vm[1], src: `https://player.vimeo.com/video/${vm[1]}?autoplay=1&texttrack=en` };
  return null;
}

/** "PT9M30S" -> "9 min 30 sec" */
export function readableDuration(iso: string) {
  const [, h, m, s] = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/) ?? [];
  return [h && `${h} hr`, m && `${m} min`, s && `${s} sec`].filter(Boolean).join(' ');
}
