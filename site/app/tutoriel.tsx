import type { Contenu, Langue } from './content';

/**
 * Les cinq étapes sont **dessinées**, pas capturées.
 *
 * La console de Groq exige un compte pour montrer quoi que ce soit : une
 * capture supposerait de photographier le compte de quelqu'un, clé comprise.
 * Ces schémas disent la même chose sans faire passer un dessin pour une
 * photo, et ils ne vieilliront pas au premier changement de leur interface.
 */

const CADRE = 'rounded-xl border border-line bg-card p-4';

function Fenetre({ url, children }: { url: string; children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 320 180" className="w-full" role="img" aria-label={url}>
      <rect x="0.5" y="0.5" width="319" height="179" rx="9" className="fill-canvas stroke-line" />
      <line x1="0" y1="30" x2="320" y2="30" className="stroke-line" />
      {[12, 22, 32].map((cx) => (
        <circle key={cx} cx={cx} cy="15" r="3" className="fill-ink-soft opacity-40" />
      ))}
      <rect x="46" y="8" width="262" height="14" rx="7" className="fill-page" />
      <text x="56" y="18.5" className="fill-ink-soft" fontSize="8" fontFamily="monospace">
        {url}
      </text>
      {children}
    </svg>
  );
}

/** Étape 1 — la page de connexion et ses trois portes d'entrée. */
function EtapeCompte() {
  return (
    <Fenetre url="console.groq.com/keys">
      <rect x="90" y="48" width="140" height="112" rx="8" className="fill-card stroke-line" />
      <rect x="104" y="62" width="112" height="8" rx="4" className="fill-ink-soft opacity-30" />
      {[82, 100, 118].map((y) => (
        <g key={y}>
          <rect x="104" y={y} width="112" height="14" rx="7" className="fill-page stroke-line" />
          <circle cx="114" cy={y + 7} r="3.5" className="fill-ink-soft opacity-50" />
          <rect
            x="123"
            y={y + 4}
            width="60"
            height="6"
            rx="3"
            className="fill-ink-soft opacity-30"
          />
        </g>
      ))}
      <rect x="104" y="140" width="112" height="10" rx="5" className="fill-ink opacity-90" />
    </Fenetre>
  );
}

/** Étape 2 — la colonne de gauche, « API Keys » en surbrillance. */
function EtapeSection() {
  return (
    <Fenetre url="console.groq.com/keys">
      <rect x="8" y="38" width="86" height="134" rx="6" className="fill-card" />
      {[48, 66, 84, 102].map((y, i) => (
        <g key={y}>
          {i === 1 && <rect x="12" y={y - 5} width="78" height="18" rx="5" className="fill-page" />}
          <rect
            x="20"
            y={y}
            width={i === 1 ? 52 : 44}
            height="7"
            rx="3.5"
            className={i === 1 ? 'fill-record' : 'fill-ink-soft opacity-30'}
          />
        </g>
      ))}
      <rect x="104" y="46" width="70" height="9" rx="4" className="fill-ink-soft opacity-40" />
      <rect x="104" y="70" width="204" height="34" rx="6" className="fill-card stroke-line" />
      <rect x="104" y="112" width="204" height="34" rx="6" className="fill-card stroke-line" />
    </Fenetre>
  );
}

/** Étape 3 — la boîte de dialogue et son champ « nom ». */
function EtapeCreation() {
  return (
    <Fenetre url="console.groq.com/keys">
      <rect x="0" y="31" width="320" height="149" className="fill-ink opacity-20" />
      <rect x="70" y="56" width="180" height="96" rx="9" className="fill-card stroke-line" />
      <rect x="86" y="72" width="86" height="8" rx="4" className="fill-ink-soft opacity-40" />
      <rect x="86" y="92" width="148" height="18" rx="5" className="fill-page stroke-line" />
      <text x="94" y="104.5" className="fill-ink-soft" fontSize="8" fontFamily="monospace">
        VoiceType
      </text>
      <rect x="150" y="122" width="84" height="16" rx="8" className="fill-ink" />
      <text
        x="192"
        y="133"
        className="fill-page"
        fontSize="8"
        fontWeight="600"
        textAnchor="middle"
      >
        Create API Key
      </text>
    </Fenetre>
  );
}

/** Étape 4 — la clé, affichée une seule fois, et le bouton pour la copier. */
function EtapeCopie() {
  return (
    <Fenetre url="console.groq.com/keys">
      <rect x="0" y="31" width="320" height="149" className="fill-ink opacity-20" />
      <rect x="46" y="60" width="228" height="88" rx="9" className="fill-card stroke-line" />
      <rect x="62" y="76" width="120" height="8" rx="4" className="fill-ink-soft opacity-40" />
      <rect x="62" y="96" width="196" height="20" rx="5" className="fill-page stroke-line" />
      <text x="70" y="109.5" className="fill-record" fontSize="9" fontFamily="monospace">
        gsk_••••••••••••••••••••
      </text>
      <rect x="232" y="100" width="20" height="12" rx="3" className="fill-ink" />
      <rect x="62" y="126" width="150" height="6" rx="3" className="fill-ink-soft opacity-25" />
    </Fenetre>
  );
}

/** Étape 5 — le champ des réglages de VoiceType, pour boucler la boucle. */
function EtapeCollage() {
  return (
    <svg viewBox="0 0 320 180" className="w-full" role="img" aria-label="VoiceType">
      <rect x="0.5" y="0.5" width="319" height="179" rx="9" className="fill-canvas stroke-line" />
      <line x1="0" y1="38" x2="320" y2="38" className="stroke-line" />
      <rect x="14" y="12" width="16" height="16" rx="5" className="fill-ink" />
      <rect x="38" y="14" width="54" height="6" rx="3" className="fill-ink-soft opacity-50" />
      <rect x="38" y="24" width="80" height="5" rx="2.5" className="fill-ink-soft opacity-25" />

      <rect x="14" y="56" width="60" height="7" rx="3.5" className="fill-ink-soft opacity-40" />
      <rect x="14" y="70" width="292" height="20" rx="5" className="fill-card stroke-line" />
      <text x="22" y="83.5" className="fill-ink-soft" fontSize="8" fontFamily="monospace">
        Groq — Whisper large v3 turbo
      </text>

      <rect x="14" y="102" width="40" height="7" rx="3.5" className="fill-ink-soft opacity-40" />
      <rect x="14" y="116" width="292" height="20" rx="5" className="fill-card stroke-record" />
      <text x="22" y="129.5" className="fill-record" fontSize="9" fontFamily="monospace">
        gsk_••••••••••••••••••••
      </text>

      <rect x="14" y="150" width="292" height="18" rx="9" className="fill-ink" />
      <text
        x="160"
        y="162"
        className="fill-page"
        fontSize="8"
        fontWeight="600"
        textAnchor="middle"
      >
        Enregistrer
      </text>
    </svg>
  );
}

const ILLUSTRATIONS = [EtapeCompte, EtapeSection, EtapeCreation, EtapeCopie, EtapeCollage];

export default function Tutoriel({ t, locale }: { t: Contenu; locale: Langue }) {
  const accueil = locale === 'fr' ? '/fr' : '/';

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-line/70 bg-page/80 backdrop-blur">
        <nav className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-3">
          <a href={accueil} className="flex items-center gap-2 font-medium tracking-tight">
            <svg viewBox="0 0 32 32" className="size-5" fill="none" aria-hidden>
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
            VoiceType
          </a>
          <span className="flex-1" />
          <a
            href={locale === 'fr' ? '/api-key' : '/fr/api-key'}
            hrefLang={locale === 'fr' ? 'en' : 'fr'}
            className="rounded-full px-2.5 py-1 text-[13px] font-medium text-ink-soft transition-colors hover:text-ink"
          >
            {locale === 'fr' ? 'EN' : 'FR'}
          </a>
        </nav>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="headline text-[40px] sm:text-[52px]">{t.cle.titre}</h1>
        <p className="mt-6 max-w-[54ch] text-[17px] leading-relaxed text-ink-soft">
          {t.cle.chapeau}
        </p>
        <p className="mt-4 max-w-[54ch] text-sm leading-relaxed text-ink-soft">{t.cle.pourquoi}</p>

        <a
          href="https://console.groq.com/keys"
          target="_blank"
          rel="noreferrer"
          className="mt-8 inline-flex items-center justify-center rounded-full bg-ink px-6 py-3 text-[15px] font-medium text-page transition hover:opacity-90"
        >
          console.groq.com/keys ↗
        </a>

        <ol className="mt-14 grid gap-4">
          {t.cle.etapes.map((etape, i) => {
            const Illustration = ILLUSTRATIONS[i];
            return (
              <li key={etape.titre} className={`${CADRE} grid gap-5 sm:grid-cols-[1fr_320px]`}>
                <div className="min-w-0 self-center">
                  <span className="headline text-[24px] text-ink-soft">{i + 1}</span>
                  <h2 className="mt-2 text-[17px] font-semibold tracking-tight">{etape.titre}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-ink-soft">{etape.texte}</p>
                </div>
                <div className="self-center">{Illustration && <Illustration />}</div>
              </li>
            );
          })}
        </ol>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {[t.cle.gratuit, t.cle.openai].map((bloc) => (
            <div key={bloc.titre} className={CADRE}>
              <h2 className="text-[17px] font-semibold tracking-tight">{bloc.titre}</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{bloc.texte}</p>
            </div>
          ))}
        </div>

        <a
          href={accueil}
          className="mt-12 inline-block text-sm text-ink-soft underline-offset-4 hover:text-ink hover:underline"
        >
          ← {t.cle.retour}
        </a>
      </main>
    </>
  );
}
