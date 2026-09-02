import { Reveal } from './reveal';
import { getReleases, getTelechargements, PAGE_VERSIONS, type Telechargements } from './releases';

const DEPOT = 'https://github.com/Luth-infinity/voicetype';
const SUITE = 'https://luth-apps.vercel.app';

// ─── Fragments ──────────────────────────────────────────────────────────────

function Micro({ className = 'size-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden>
      <rect x="11" y="3.5" width="10" height="14.5" rx="5" fill="currentColor" />
      <path
        d="M7 16.5a9 7.5 0 0 0 18 0"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        d="M16 21.5v5M11.5 27.6h9"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

// Rythme figé plutôt qu'aléatoire : une valeur tirée au rendu diffèrerait
// entre le serveur et le navigateur, et React signalerait la divergence.
const RYTHME = [
  0.42, 0.71, 0.35, 0.88, 0.55, 0.24, 0.63, 0.94, 0.48, 0.31, 0.77, 0.59, 0.86, 0.4, 0.68, 0.27,
  0.81, 0.52, 0.36, 0.73, 0.45, 0.9
];

/**
 * La barre de dictée, rejouée en HTML.
 *
 * Une capture figée ne dit pas que les barres suivent la voix — c'est
 * pourtant ce qui distingue l'application d'un bouton d'enregistrement.
 */
function Barre() {
  return (
    <div className="mx-auto w-full max-w-[430px] rounded-xl border border-line bg-card px-3.5 py-3 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)]">
      <div className="flex items-center gap-3">
        <div className="relative flex-shrink-0">
          <span className="halo absolute inset-0 rounded-full bg-record/40" />
          <div className="relative flex size-9 items-center justify-center rounded-full bg-record text-white">
            <Micro className="size-4" />
          </div>
        </div>

        <div className="onde flex h-9 min-w-0 flex-1 items-center gap-[3px]">
          {RYTHME.map((valeur, i) => (
            <span
              key={i}
              className="h-6 w-[3px] origin-center rounded-full bg-record/70"
              style={{
                animationDelay: `${(i * 0.07).toFixed(2)}s`,
                animationDuration: `${(0.7 + valeur * 0.8).toFixed(2)}s`
              }}
            />
          ))}
        </div>

        <span className="flex-shrink-0 font-mono text-xs tabular-nums text-ink-soft">0:04</span>
      </div>
      <p className="mt-2 px-0.5 text-[11px] leading-none text-ink-soft">
        Le raccourci valide · Échap annule
      </p>
    </div>
  );
}

function Telecharger({ t, compact = false }: { t: Telechargements; compact?: boolean }) {
  const principal =
    'inline-flex items-center justify-center gap-2 rounded-full bg-ink px-6 py-3 text-[15px] font-medium text-page transition hover:opacity-90';
  const second = 'text-sm text-ink-soft underline-offset-4 hover:underline';

  return (
    <div className={compact ? 'flex flex-col items-center gap-3' : 'flex flex-col items-center gap-4'}>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <a data-cta="win" href={t.win ?? PAGE_VERSIONS} className={principal}>
          Télécharger pour Windows
        </a>
        <a data-cta="mac" href={t.macArm ?? PAGE_VERSIONS} className={principal}>
          Télécharger pour Mac
        </a>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-center">
        {t.version && <span className="text-sm text-ink-soft">Version {t.version}</span>}
        <a data-cta="mac" href={t.macIntel ?? PAGE_VERSIONS} className={second}>
          Mac Intel
        </a>
        <a data-cta="win" href={PAGE_VERSIONS} className={second}>
          Toutes les versions
        </a>
      </div>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default async function Page() {
  const [telechargements, releases] = await Promise.all([getTelechargements(), getReleases()]);

  return (
    <>
      <Reveal />

      <header className="sticky top-0 z-10 border-b border-line/70 bg-page/80 backdrop-blur">
        <nav className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3.5">
          <span className="flex items-center gap-2 font-medium tracking-tight">
            <Micro className="size-5" />
            VoiceType
          </span>
          <span className="flex-1" />
          <a href="#fonctions" className="hidden text-sm text-ink-soft hover:text-ink sm:block">
            Ce qu'il fait
          </a>
          <a href="#versions" className="hidden text-sm text-ink-soft hover:text-ink sm:block">
            Versions
          </a>
          <a href="#telecharger" className="text-sm font-medium hover:opacity-80">
            Télécharger
          </a>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="px-4 pb-16 pt-20 sm:pt-28">
          <div className="mx-auto max-w-5xl text-center">
            <h1 className="reveal headline mx-auto max-w-[14ch] text-[13vw] sm:text-[76px] lg:text-[88px]">
              Parlez. Le texte est déjà là.
            </h1>
            <p className="reveal mx-auto mt-7 max-w-[52ch] text-[17px] leading-relaxed text-ink-soft">
              Un raccourci ouvre le micro, où que vous soyez. Vous dictez, et le texte se colle dans
              le champ où vous écriviez — un mail, un ticket, un message. La fenêtre ne perd jamais
              le focus.
            </p>
            <div className="reveal mt-10">
              <Telecharger t={telechargements} />
            </div>
            <p className="reveal mt-6 text-sm text-ink-soft">
              Windows et macOS · gratuit · votre propre clé de transcription
            </p>
          </div>
        </section>

        {/* La barre */}
        <section className="px-4 pb-24">
          <div className="reveal mx-auto max-w-5xl rounded-3xl border border-line bg-canvas px-4 py-16 sm:px-10">
            <Barre />
            <p className="mx-auto mt-8 max-w-[46ch] text-center text-sm leading-relaxed text-ink-soft">
              C'est tout ce que l'application montre pendant que vous parlez : une barre au-dessus
              de votre travail, dont les niveaux suivent votre voix. Elle disparaît dès que le texte
              est posé.
            </p>
          </div>
        </section>

        {/* Trois temps */}
        <section id="fonctions" className="px-4 py-8">
          <div className="mx-auto max-w-5xl">
            <h2 className="reveal headline max-w-[16ch] text-[40px] sm:text-[54px]">
              Trois secondes entre l'idée et le texte.
            </h2>
            <ol className="mt-12 grid gap-4 sm:grid-cols-3">
              {[
                [
                  '1',
                  'Le raccourci',
                  "Alt+Shift+R par défaut, ou celui que vous voulez. Il fonctionne par-dessus n'importe quelle application, y compris en plein écran."
                ],
                [
                  '2',
                  'Vous parlez',
                  'La barre apparaît sans voler le focus. Le raccourci à nouveau pour valider, Échap pour annuler — la requête est alors vraiment coupée.'
                ],
                [
                  '3',
                  'Le texte arrive',
                  "Whisper transcrit, le texte va dans le presse-papiers, et un Ctrl+V simulé le pose là où vous étiez. Rien à recopier."
                ]
              ].map(([n, titre, texte]) => (
                <li key={n} className="reveal rounded-2xl border border-line bg-card p-6">
                  <span className="headline text-[28px] text-ink-soft">{n}</span>
                  <h3 className="mt-3 text-[17px] font-semibold tracking-tight">{titre}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-soft">{texte}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Détails */}
        <section className="px-4 py-16">
          <div className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-2">
            {[
              [
                'Votre clé, votre facture',
                "VoiceType n'a pas de serveur et ne revend rien. Vous branchez une clé Groq — gratuite — ou OpenAI, et l'audio va directement chez le fournisseur choisi."
              ],
              [
                'Rien n’est conservé',
                "Ni l'audio ni le texte ne sont stockés : l'enregistrement part, la transcription revient, tout est oublié. Seuls vos réglages restent sur la machine."
              ],
              [
                'Neuf langues',
                'Français, anglais, espagnol, allemand, italien, portugais, néerlandais, japonais, chinois. La langue se choisit une fois pour toutes.'
              ],
              [
                'Elle se met à jour seule',
                'Sous Windows, la nouvelle version se télécharge et s’installe depuis les réglages. Sur macOS, faute de signature Apple, elle vous signale simplement la version.'
              ]
            ].map(([titre, texte]) => (
              <div key={titre} className="reveal rounded-2xl border border-line bg-card p-6">
                <h3 className="text-[17px] font-semibold tracking-tight">{titre}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{texte}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Téléchargement */}
        <section id="telecharger" className="px-4 py-24">
          <div className="reveal mx-auto max-w-3xl rounded-3xl border border-line bg-canvas px-6 py-16 text-center">
            <Micro className="mx-auto size-9" />
            <h2 className="headline mt-6 text-[40px] sm:text-[52px]">Essayez sur un mail.</h2>
            <p className="mx-auto mt-5 max-w-[44ch] text-[15px] leading-relaxed text-ink-soft">
              L'installation prend quelques secondes et ne demande aucun droit administrateur.
              Il vous faudra une clé de transcription — celle de Groq est gratuite, l'application
              vous y emmène.
            </p>
            <div className="mt-10">
              <Telecharger t={telechargements} compact />
            </div>
            <p className="mx-auto mt-8 max-w-[48ch] text-xs leading-relaxed text-ink-soft">
              L'application n'est signée par aucun éditeur : Windows peut afficher un avertissement
              SmartScreen (« Informations complémentaires » puis « Exécuter quand même »), et sur
              macOS il faut l'ouvrir la première fois par un clic droit puis « Ouvrir ».
            </p>
          </div>
        </section>

        {/* Versions */}
        {releases.length > 0 && (
          <section id="versions" className="px-4 py-8">
            <div className="mx-auto max-w-5xl">
              <h2 className="reveal headline text-[40px] sm:text-[54px]">Ce qui a changé.</h2>
              <ul className="mt-12 grid gap-4">
                {releases.map((release) => (
                  <li
                    key={release.version}
                    className="reveal grid gap-4 rounded-2xl border border-line bg-card p-6 sm:grid-cols-[10rem_1fr]"
                  >
                    <div>
                      <a
                        href={release.page}
                        className="headline text-[24px] hover:opacity-80"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {release.version}
                      </a>
                      <p className="mt-1 text-xs text-ink-soft">{release.date}</p>
                    </div>
                    <ul className="grid gap-2">
                      {release.points.map((point) => (
                        <li key={point} className="text-sm leading-relaxed text-ink-soft">
                          {point}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}
      </main>

      <footer className="mt-16 border-t border-line px-4 py-12">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-3">
          <span className="flex items-center gap-2 text-sm">
            <Micro className="size-4" />
            VoiceType
          </span>
          <span className="flex-1" />
          <a href={SUITE} className="text-sm text-ink-soft hover:text-ink">
            Les autres apps
          </a>
          <a href={DEPOT} className="text-sm text-ink-soft hover:text-ink">
            Code source
          </a>
          <a href={PAGE_VERSIONS} className="text-sm text-ink-soft hover:text-ink">
            Versions
          </a>
        </div>
      </footer>
    </>
  );
}
