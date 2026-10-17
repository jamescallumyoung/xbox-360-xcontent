// Header thumbnails are PNG bytes; an <img> needs a URL. Each byte array gets one
// object URL, kept for as long as the array is.

const urls = new WeakMap<Uint8Array, string>();

/** An object URL for a thumbnail's bytes, or `undefined` for none. */
export function thumbnailUrl(bytes: Uint8Array | null): string | undefined {
  if (bytes === null) return undefined;
  let url = urls.get(bytes);
  if (url === undefined) {
    url = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'image/png' }));
    urls.set(bytes, url);
  }
  return url;
}
