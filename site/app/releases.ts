const DEPOT = 'Luth-infinity/voicetype';
const API = `https://api.github.com/repos/${DEPOT}/releases`;

export const PAGE_VERSIONS = `https://github.com/${DEPOT}/releases`;

export type Release = {
  version: string;
  date: string;
  page: string;
  points: string[];
};

export type Telechargements = {
  version: string;
  win: string | null;
  macArm: string | null;
  macIntel: string | null;
};

type ReleaseApi = {
  tag_name: string;
  published_at: string;
  html_url: string;
  body: string;
  draft: boolean;
  prerelease: boolean;
  assets: { name: string; browser_download_url: string }[];
};

/**
 * Les versions viennent des releases GitHub : le site se met à jour tout seul
 * à chaque publication, sans double saisie qui finirait par diverger.
 * Revalidé toutes les heures.
 */
async function lire(): Promise<ReleaseApi[]> {
  try {
    const res = await fetch(API, {
      headers: { Accept: 'application/vnd.github+json' },
      next: { revalidate: 3600 }
    });
    if (!res.ok) return [];
    const data = (await res.json()) as ReleaseApi[];
    return data.filter((r) => !r.draft && !r.prerelease);
  } catch {
    // Le site doit se construire même si l'API GitHub est indisponible.
    return [];
  }
}

/** Garde les puces et les phrases courtes, écarte les blocs d'installation. */
function resumer(body: string): string[] {
  return body
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && !l.startsWith('**') && !l.startsWith('>'))
    .map((l) => l.replace(/^[-*]\s*/, ''))
    .filter((l) => l.length > 25)
    .slice(0, 4);
}

export async function getReleases(): Promise<Release[]> {
  return (await lire()).slice(0, 5).map((r) => ({
    version: r.tag_name.replace(/^v/, ''),
    date: new Date(r.published_at).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }),
    page: r.html_url,
    points: resumer(r.body || '')
  }));
}

/**
 * Les liens de téléchargement sont lus sur la dernière release, jamais écrits
 * à la main : un numéro de version en dur dans la page finit toujours par
 * pointer vers un fichier supprimé.
 *
 * Une plateforme peut manquer — une version publiée avant que le runner macOS
 * n'existe, ou une construction qui a échoué. Les boutons correspondants
 * renvoient alors vers la page des versions plutôt que vers le vide.
 */
export async function getTelechargements(): Promise<Telechargements> {
  const derniere = (await lire())[0];
  if (!derniere) return { version: '', win: null, macArm: null, macIntel: null };

  const url = (test: (nom: string) => boolean): string | null =>
    derniere.assets.find((a) => test(a.name))?.browser_download_url ?? null;

  return {
    version: derniere.tag_name.replace(/^v/, ''),
    win: url((n) => n.endsWith('.exe')),
    macArm: url((n) => n.endsWith('.dmg') && n.includes('arm64')),
    macIntel: url((n) => n.endsWith('.dmg') && !n.includes('arm64'))
  };
}
