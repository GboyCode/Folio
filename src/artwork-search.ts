import type { Artwork } from './types';

const normalize = (value: string) => value.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');

function differsByOneCharacter(left: string, right: string) {
  if (Math.abs(left.length - right.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (left.length >= right.length) i++;
    if (right.length >= left.length) j++;
  }
  return edits + Number(i < left.length || j < right.length) <= 1;
}

export function searchArtworks(artworks: readonly Artwork[], search: string): Artwork[] {
  const query = normalize(search);
  const exact = artworks.filter(art => normalize(`${art.name} ${art.issuer}`).includes(query));
  if (exact.length || !/^[a-z0-9]{4,}$/.test(query)) return exact;
  // Only fall back to a one-character brand typo when no direct result exists.
  // Short queries and unrelated words must not produce a broad set of matches.
  return artworks.filter(art => differsByOneCharacter(query, normalize(art.issuer).replace(/[^a-z0-9]/g, '')));
}
