import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  ArrowDownToLine,
  Check,
  ClipboardPaste,
  ExternalLink,
  Keyboard,
  Loader2,
  Mic,
  RefreshCw,
  Save,
  Wand2
} from 'lucide-react'
import {
  DEFAULT_SETTINGS,
  LANGUAGES,
  PROVIDERS,
  type Provider,
  type Settings as Reglages
} from '@shared/settings'
import type { UpdateState } from '../../../main/updates'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { Select } from '@renderer/components/ui/select'
import { Switch } from '@renderer/components/ui/switch'
import { useSyncedTheme } from '@renderer/lib/theme'
import { cn } from '@renderer/lib/utils'

type Enregistrement = 'repos' | 'en-cours' | 'fait' | 'echec'
type Micro = { deviceId: string; label: string }

/** En-tête de section : même grammaire que les réglages de Hublink. */
function Section({
  icone: Icone,
  titre,
  description,
  children
}: {
  icone: typeof Mic
  titre: string
  description?: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <section className="grid gap-3">
      <div className="grid gap-1">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <Icone className="h-4 w-4 text-shell-muted" />
          {titre}
        </h2>
        {description && (
          <p className="text-xs leading-relaxed text-shell-muted">{description}</p>
        )}
      </div>
      {children}
    </section>
  )
}

export default function Settings(): JSX.Element {
  useSyncedTheme()

  const [reglages, setReglages] = useState<Reglages>(DEFAULT_SETTINGS)
  const [captureRaccourci, setCaptureRaccourci] = useState(false)
  const [enregistrement, setEnregistrement] = useState<Enregistrement>('repos')
  const [erreur, setErreur] = useState('')
  const [micros, setMicros] = useState<Micro[]>([])
  const [version, setVersion] = useState('')
  const [maj, setMaj] = useState<UpdateState>({ statut: 'inconnu' })
  const champRaccourci = useRef<HTMLInputElement>(null)

  // ─── Chargement ───────────────────────────────────────────────────────────

  const listerMicros = useCallback(async (): Promise<void> => {
    try {
      // Les libellés des périphériques restent masqués tant que l'accès n'a pas
      // été accordé : on ouvre le flux une fraction de seconde pour les lire.
      const flux = await navigator.mediaDevices.getUserMedia({ audio: true })
      flux.getTracks().forEach((t) => t.stop())
      const trouves = (await navigator.mediaDevices.enumerateDevices())
        .filter((d) => d.kind === 'audioinput' && d.deviceId !== 'default')
        .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Microphone ${i + 1}` }))
      setMicros(trouves)
    } catch {
      // Accès refusé : la liste reste vide, le micro par défaut fonctionne.
    }
  }, [])

  useEffect(() => {
    void window.api.getSettings().then(setReglages)
    void window.api.appVersion().then(setVersion)
    void window.api.updateState().then(setMaj)

    // On n'ouvre le micro que lorsque la fenêtre est montrée : elle est créée
    // masquée au démarrage, et allumer le témoin du micro à ce moment-là
    // inquiéterait à juste titre.
    const off = window.api.onSettingsShown(() => void listerMicros())
    const offMaj = window.api.onUpdateState(setMaj)
    return () => {
      off()
      offMaj()
    }
  }, [listerMicros])

  // ─── Capture du raccourci ─────────────────────────────────────────────────

  const toucheRaccourci = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    e.preventDefault()
    e.stopPropagation()

    if (e.key === 'Escape') {
      setCaptureRaccourci(false)
      champRaccourci.current?.blur()
      return
    }

    const parties: string[] = []
    if (e.ctrlKey) parties.push('Ctrl')
    if (e.altKey) parties.push('Alt')
    if (e.shiftKey) parties.push('Shift')
    if (e.metaKey) parties.push('Super')

    if (['Control', 'Alt', 'Shift', 'Meta', 'CapsLock', 'Tab'].includes(e.key)) return

    const equivalents: Record<string, string> = {
      ' ': 'Space',
      ArrowUp: 'Up',
      ArrowDown: 'Down',
      ArrowLeft: 'Left',
      ArrowRight: 'Right',
      Enter: 'Return',
      Backspace: 'Backspace',
      Delete: 'Delete'
    }
    parties.push(equivalents[e.key] || (e.key.length === 1 ? e.key.toUpperCase() : e.key))

    // Sans modificateur, le raccourci confisquerait la touche dans toutes les
    // applications.
    if (parties.length < 2) return

    setReglages((p) => ({ ...p, shortcut: parties.join('+') }))
    setCaptureRaccourci(false)
    champRaccourci.current?.blur()
  }

  // ─── Enregistrement ───────────────────────────────────────────────────────

  const enregistrer = async (): Promise<void> => {
    setEnregistrement('en-cours')
    setErreur('')
    const res = await window.api.saveSettings(reglages)
    if (res.success) {
      setEnregistrement('fait')
      setTimeout(() => setEnregistrement('repos'), 2000)
    } else {
      setEnregistrement('echec')
      setErreur(res.error || 'Erreur inconnue')
      setTimeout(() => setEnregistrement('repos'), 4000)
    }
  }

  const fournisseur = PROVIDERS[reglages.provider]
  // Alt + une seule lettre est avalé par les menus des autres applications.
  const raccourciRisque = /^Alt\+[A-Z0-9]$/.test(reglages.shortcut)

  return (
    <div className="flex h-full flex-col bg-shell text-shell-foreground">
      {/* En-tête */}
      <header className="flex items-center gap-3 border-b border-shell-border px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-foreground">
          <Mic className="h-[18px] w-[18px] text-background" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-medium leading-tight">VoiceType</h1>
          <p className="text-xs text-shell-muted">
            Dictez n'importe où avec {reglages.shortcut}
          </p>
        </div>
        {version && <span className="font-mono text-[11px] text-shell-muted">v{version}</span>}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <BandeauMaj etat={maj} />

        <div className="grid gap-6">
          <Section
            icone={Keyboard}
            titre="Raccourci"
            description="Une pression lance la dictée, une seconde la valide. Échap annule."
          >
            <div className="flex gap-2">
              <Input
                ref={champRaccourci}
                value={captureRaccourci ? 'Appuyez sur les touches…' : reglages.shortcut}
                readOnly
                onFocus={() => setCaptureRaccourci(true)}
                onBlur={() => setCaptureRaccourci(false)}
                onKeyDown={toucheRaccourci}
                className={cn(
                  'cursor-pointer font-mono',
                  captureRaccourci && 'text-shell-muted ring-2 ring-ring'
                )}
              />
              <Button
                variant="outline"
                onClick={() => {
                  setCaptureRaccourci(true)
                  champRaccourci.current?.focus()
                }}
              >
                Modifier
              </Button>
            </div>

            {raccourciRisque && (
              <Alerte>
                <strong>Alt + une seule touche</strong> est souvent intercepté par les menus des
                autres applications. Préférez{' '}
                <strong>Alt+Shift+{reglages.shortcut.split('+').pop()}</strong>.
              </Alerte>
            )}
          </Section>

          <Section
            icone={Wand2}
            titre="Transcription"
            description="L'audio part chez le fournisseur choisi, qui renvoie le texte. Rien n'est conservé par VoiceType."
          >
            <div className="grid gap-1.5">
              <Label>Fournisseur</Label>
              <Select
                value={reglages.provider}
                onChange={(e) =>
                  setReglages((p) => ({ ...p, provider: e.target.value as Provider }))
                }
              >
                {Object.entries(PROVIDERS).map(([valeur, p]) => (
                  <option key={valeur} value={valeur}>
                    {p.label}
                  </option>
                ))}
              </Select>
              <div className="flex items-center gap-2 rounded-md border border-shell-border bg-shell-raised px-3 py-2">
                <p className="flex-1 text-xs text-shell-muted">{fournisseur.hint}</p>
                <a
                  href={fournisseur.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex flex-shrink-0 items-center gap-1 text-xs font-medium hover:underline"
                >
                  Obtenir une clé <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label>Clé API</Label>
              <Input
                type="password"
                value={reglages.apiKey}
                onChange={(e) => setReglages((p) => ({ ...p, apiKey: e.target.value }))}
                placeholder={`${fournisseur.prefix}…`}
                className="font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Langue parlée</Label>
                <Select
                  value={reglages.language}
                  onChange={(e) => setReglages((p) => ({ ...p, language: e.target.value }))}
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Microphone</Label>
                <Select
                  value={reglages.deviceId}
                  onChange={(e) => setReglages((p) => ({ ...p, deviceId: e.target.value }))}
                  disabled={micros.length === 0}
                >
                  <option value="">Micro par défaut</option>
                  {micros.map((m) => (
                    <option key={m.deviceId} value={m.deviceId}>
                      {m.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </Section>

          <Section icone={ClipboardPaste} titre="Comportement">
            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-shell-border bg-shell-raised p-3">
              <span className="grid gap-0.5">
                <span className="text-sm font-medium">Coller automatiquement</span>
                <span className="text-xs text-shell-muted">
                  Simule Ctrl+V dans la fenêtre active. Sinon, le texte reste dans le
                  presse-papiers.
                </span>
              </span>
              <Switch
                checked={reglages.autoPaste}
                onCheckedChange={(coche) => setReglages((p) => ({ ...p, autoPaste: coche }))}
              />
            </label>
          </Section>

          <Section
            icone={RefreshCw}
            titre="Mises à jour"
            description="VoiceType se met à jour tout seul depuis les versions publiées sur GitHub."
          >
            <EtatMaj etat={maj} />
          </Section>
        </div>
      </div>

      {/* Pied fixe : le bouton reste atteignable quelle que soit la hauteur. */}
      <footer className="grid gap-2 border-t border-shell-border px-5 py-4">
        {enregistrement === 'echec' && erreur && <Alerte destructif>{erreur}</Alerte>}
        <Button onClick={enregistrer} disabled={enregistrement === 'en-cours'}>
          {enregistrement === 'fait' ? (
            <>
              <Check className="mr-2 h-4 w-4" />
              Enregistré
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Enregistrer
            </>
          )}
        </Button>
      </footer>
    </div>
  )
}

// ─── Fragments ──────────────────────────────────────────────────────────────

function Alerte({
  children,
  destructif
}: {
  children: React.ReactNode
  destructif?: boolean
}): JSX.Element {
  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-md border px-3 py-2 text-xs leading-relaxed',
        destructif
          ? 'border-destructive/40 bg-destructive/10 text-destructive'
          : 'border-shell-border bg-shell-raised text-shell-muted'
      )}
    >
      <AlertCircle className="mt-px h-3.5 w-3.5 flex-shrink-0" />
      <span>{children}</span>
    </div>
  )
}

/** Bandeau haut : seule une version prête à poser mérite d'interrompre. */
function BandeauMaj({ etat }: { etat: UpdateState }): JSX.Element | null {
  if (etat.statut !== 'disponible' && etat.statut !== 'prete') return null
  const prete = etat.statut === 'prete'
  return (
    <div className="mb-5 flex items-center gap-3 rounded-lg border border-shell-border bg-shell-raised p-3">
      <ArrowDownToLine className="h-4 w-4 flex-shrink-0 text-shell-muted" />
      <p className="flex-1 text-xs">
        <span className="font-medium">Version {etat.version} disponible</span>
        {prete && ' — prête à installer.'}
      </p>
      <Button
        size="sm"
        onClick={() => (prete ? window.api.updateInstall() : window.api.updateDownload())}
      >
        {prete ? 'Redémarrer et installer' : 'Télécharger'}
      </Button>
    </div>
  )
}

function EtatMaj({ etat }: { etat: UpdateState }): JSX.Element {
  const libelle: Record<UpdateState['statut'], string> = {
    inconnu: 'Statut inconnu.',
    indisponible: "Disponible seulement depuis l'application installée.",
    verification: 'Recherche en cours…',
    'a-jour': 'VoiceType est à jour.',
    disponible: 'Une nouvelle version est disponible.',
    telechargement: 'Téléchargement…',
    prete: 'Mise à jour prête à installer.',
    erreur: 'La vérification a échoué.'
  }

  return (
    <div className="grid gap-2 rounded-lg border border-shell-border bg-shell-raised p-3">
      <div className="flex items-center gap-3">
        {etat.statut === 'verification' || etat.statut === 'telechargement' ? (
          <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-shell-muted" />
        ) : etat.statut === 'a-jour' ? (
          <Check className="h-4 w-4 flex-shrink-0 text-positive" />
        ) : (
          <RefreshCw className="h-4 w-4 flex-shrink-0 text-shell-muted" />
        )}
        <p className="flex-1 text-xs">{libelle[etat.statut]}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void window.api.updateCheck()}
          disabled={etat.statut === 'verification' || etat.statut === 'indisponible'}
        >
          Vérifier
        </Button>
      </div>

      {etat.statut === 'telechargement' && (
        <div className="h-1 overflow-hidden rounded-full bg-shell-border">
          <div
            className="h-full rounded-full bg-foreground transition-[width] duration-300"
            style={{ width: `${etat.progres}%` }}
          />
        </div>
      )}

      {etat.statut === 'erreur' && <p className="text-xs text-destructive">{etat.message}</p>}
    </div>
  )
}
