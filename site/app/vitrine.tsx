import { LangLink } from './lang-link';
import { Reveal } from './reveal';
import type { Contenu, Langue } from './content';
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

// Les deux langues restent dans cet ordre quelle que soit la page : c'est la
// marque qui se déplace, pas les libellés.
const LANGUES: { code: Langue; libelle: string; href: string }[] = [
  { code: 'fr', libelle: 'FR', href: '/fr' },
  { code: 'en', libelle: 'EN', href: '/' }
];

const SEGMENT = 'rounded-full px-2.5 py-1 text-[13px] font-medium transition-colors';
const SEGMENT_LU = `${SEGMENT} bg-card text-ink ring-1 ring-line`;
const SEGMENT_AUTRE = `${SEGMENT} text-ink-soft hover:text-ink`;

function BasculeLangue({ t, locale }: { t: Contenu; locale: Langue }) {
  return (
    <div
      className="flex items-center gap-0.5 rounded-full bg-canvas p-0.5 ring-1 ring-line/60"
      role="group"
      aria-label={t.nav.langue}
    >
      {LANGUES.map((langue) =>
        langue.code === locale ? (
          <span key={langue.code} className={SEGMENT_LU} aria-current="true">
            {langue.libelle}
          </span>
        ) : (
          <LangLink
            key={langue.code}
            href={langue.href}
            hrefLang={langue.code}
            className={SEGMENT_AUTRE}
          >
            {langue.libelle}
          </LangLink>
        )
      )}
    </div>
  );
}

// Rythme figé plutôt qu'aléatoire : une valeur tirée au rendu diffèrerait
// entre le serveur et le navigateur, et React signalerait la divergence.
const RYTHME = [
  0.42, 0.71, 0.35, 0.88, 0.55, 0.24, 0.63, 0.94, 0.48, 0.31, 0.77, 0.59, 0.86, 0.4, 0.68, 0.27,
  0.81, 0.52, 0.36, 0.73, 0.45, 0.9, 0.38, 0.66, 0.29, 0.84, 0.5, 0.75, 0.33, 0.61, 0.92, 0.44,
  0.7, 0.26, 0.79, 0.57, 0.34, 0.87, 0.46, 0.64, 0.3, 0.82, 0.53, 0.69, 0.41, 0.76
];

/**
 * La barre de dictée, rejouée en HTML.
 *
 * Une capture figée ne dit pas que les barres suivent la voix — c'est
 * pourtant ce qui distingue l'application d'un bouton d'enregistrement. Les
 * barres tiennent toute la largeur jusqu'au minuteur, comme dans l'app.
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
              className="h-6 min-w-[2px] flex-1 origin-center rounded-full bg-record/70"
              style={{
                animationDelay: `${(i * 0.06).toFixed(2)}s`,
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

function Telecharger({ t, dl }: { t: Contenu; dl: Telechargements }) {
  const principal =
    'inline-flex items-center justify-center gap-2 rounded-full bg-ink px-6 py-3 text-[15px] font-medium text-page transition hover:opacity-90';
  const second = 'text-sm text-ink-soft underline-offset-4 hover:underline';

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <a data-cta="win" href={dl.win ?? PAGE_VERSIONS} className={principal}>
          {t.telecharger.windows}
        </a>
        <a data-cta="mac" href={dl.macArm ?? PAGE_VERSIONS} className={principal}>
          {t.telecharger.mac}
        </a>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-center">
        {dl.version && (
          <span className="text-sm text-ink-soft">
            {t.telecharger.version} {dl.version}
          </span>
        )}
        <a data-cta="mac" href={dl.macIntel ?? PAGE_VERSIONS} className={second}>
          {t.telecharger.macIntel}
        </a>
        <a data-cta="win" href={PAGE_VERSIONS} className={second}>
          {t.telecharger.toutes}
        </a>
      </div>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default async function Vitrine({ t, locale }: { t: Contenu; locale: Langue }) {
  const [dl, releases] = await Promise.all([getTelechargements(), getReleases(locale)]);

  return (
    <>
      <Reveal />

      <header className="sticky top-0 z-10 border-b border-line/70 bg-page/80 backdrop-blur">
        <nav className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
          <span className="flex items-center gap-2 font-medium tracking-tight">
            <Micro className="size-5" />
            VoiceType
          </span>
          <span className="flex-1" />
          <a href="#fonctions" className="hidden text-sm text-ink-soft hover:text-ink sm:block">
            {t.nav.fonctions}
          </a>
          <a href="#versions" className="hidden text-sm text-ink-soft hover:text-ink sm:block">
            {t.nav.versions}
          </a>
          <BasculeLangue t={t} locale={locale} />
          <a href="#telecharger" className="text-sm font-medium hover:opacity-80">
            {t.nav.telecharger}
          </a>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="px-4 pb-16 pt-20 sm:pt-28">
          <div className="mx-auto max-w-5xl text-center">
            <h1 className="reveal headline mx-auto max-w-[14ch] text-[13vw] sm:text-[76px] lg:text-[88px]">
              {t.hero.titre}
            </h1>
            <p className="reveal mx-auto mt-7 max-w-[52ch] text-[17px] leading-relaxed text-ink-soft">
              {t.hero.texte}
            </p>
            <div className="reveal mt-10">
              <Telecharger t={t} dl={dl} />
            </div>
            <p className="reveal mt-6 text-sm text-ink-soft">{t.hero.mention}</p>
          </div>
        </section>

        {/* La barre */}
        <section id="barre" className="px-4 pb-24">
          <div className="reveal mx-auto max-w-5xl rounded-3xl border border-line bg-canvas px-4 py-16 sm:px-10">
            <Barre />
            <p className="mx-auto mt-8 max-w-[46ch] text-center text-sm leading-relaxed text-ink-soft">
              {t.barre.legende}
            </p>
          </div>
        </section>

        {/* Trois temps */}
        <section id="fonctions" className="px-4 py-8">
          <div className="mx-auto max-w-5xl">
            <h2 className="reveal headline max-w-[16ch] text-[40px] sm:text-[54px]">
              {t.etapes.titre}
            </h2>
            <ol className="mt-12 grid gap-4 sm:grid-cols-3">
              {t.etapes.items.map(([titre, texte], i) => (
                <li key={titre} className="reveal rounded-2xl border border-line bg-card p-6">
                  <span className="headline text-[28px] text-ink-soft">{i + 1}</span>
                  <h3 className="mt-3 text-[17px] font-semibold tracking-tight">{titre}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-soft">{texte}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Détails */}
        <section id="details" className="px-4 py-16">
          <div className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-2">
            {t.details.map(([titre, texte]) => (
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
            <h2 className="headline mt-6 text-[40px] sm:text-[52px]">{t.telecharger.titre}</h2>
            <p className="mx-auto mt-5 max-w-[44ch] text-[15px] leading-relaxed text-ink-soft">
              {t.telecharger.texte}
            </p>
            <div className="mt-10">
              <Telecharger t={t} dl={dl} />
            </div>
            <p className="mx-auto mt-8 max-w-[48ch] text-xs leading-relaxed text-ink-soft">
              {t.telecharger.signature}
            </p>
          </div>
        </section>

        {/* Versions */}
        {releases.length > 0 && (
          <section id="versions" className="px-4 py-8">
            <div className="mx-auto max-w-5xl">
              <h2 className="reveal headline text-[40px] sm:text-[54px]">{t.changelog.titre}</h2>
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
            {t.pied.suite}
          </a>
          <a href={DEPOT} className="text-sm text-ink-soft hover:text-ink">
            {t.pied.code}
          </a>
          <a href={PAGE_VERSIONS} className="text-sm text-ink-soft hover:text-ink">
            {t.pied.versions}
          </a>
        </div>
      </footer>
    </>
  );
}
