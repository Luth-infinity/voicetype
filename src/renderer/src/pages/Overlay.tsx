import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Mic, MicOff, Settings2, X } from 'lucide-react'
import { PROVIDERS, type Settings } from '@shared/settings'
import { useSyncedTheme } from '@renderer/lib/theme'
import { cn } from '@renderer/lib/utils'

type Etat = 'demarrage' | 'ecoute' | 'transcription' | 'termine' | 'erreur'

type Erreur = {
  titre: string
  detail?: string
  /** Les réglages sont la seule issue : on propose d'y aller. */
  reglages?: boolean
}

const BARRES = 22
/** Fenêtre laissée à l'écran pour lire un message d'erreur avant fermeture. */
const DELAI_ERREUR = 5000

export default function Overlay(): JSX.Element {
  useSyncedTheme()

  const [etat, setEtat] = useState<Etat>('demarrage')
  const [erreur, setErreur] = useState<Erreur | null>(null)
  const [texte, setTexte] = useState('')
  const [secondes, setSecondes] = useState(0)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioRef = useRef<AudioContext | null>(null)
  const rafRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)
  const barresRef = useRef<(HTMLSpanElement | null)[]>([])
  /**
   * Chaque dictée porte un numéro. Une réponse d'API qui revient après une
   * annulation appartient à une dictée périmée : sans ce compteur, le texte
   * était collé alors qu'on venait d'appuyer sur Échap.
   */
  const dicteeRef = useRef(0)

  // ─── Nettoyage ────────────────────────────────────────────────────────────

  const arreterTout = useCallback((): void => {
    cancelAnimationFrame(rafRef.current)
    abortRef.current?.abort()
    abortRef.current = null
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
    }
    recorderRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    void audioRef.current?.close().catch(() => {})
    audioRef.current = null
  }, [])

  const echouer = useCallback(
    (e: Erreur): void => {
      arreterTout()
      setErreur(e)
      setEtat('erreur')
      // Sans ce signal, le main resterait persuadé qu'un enregistrement est en
      // cours et le raccourci n'aurait plus aucun effet.
      const dictee = dicteeRef.current
      setTimeout(() => {
        if (dicteeRef.current === dictee) window.api.recordingCancelled()
      }, DELAI_ERREUR)
    },
    [arreterTout]
  )

  // ─── Niveau sonore ────────────────────────────────────────────────────────

  /**
   * Les barres suivent le micro pour de vrai : l'ancienne animation était une
   * boucle CSS, qui s'agitait autant devant un micro muet. C'est le seul
   * retour visuel qui prouve que le bon périphérique est écouté.
   */
  const suivreNiveau = useCallback((stream: MediaStream): void => {
    const ctx = new AudioContext()
    audioRef.current = ctx
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 512
    analyser.smoothingTimeConstant = 0.75
    ctx.createMediaStreamSource(stream).connect(analyser)

    const echantillons = new Uint8Array(analyser.fftSize)
    const niveaux = new Array<number>(BARRES).fill(0)

    const boucle = (): void => {
      analyser.getByteTimeDomainData(echantillons)
      let somme = 0
      for (const v of echantillons) somme += ((v - 128) / 128) ** 2
      const rms = Math.sqrt(somme / echantillons.length)
      // La voix occupe le bas de l'échelle linéaire : on l'étire pour que la
      // parole normale remplisse la bande sans saturer.
      const niveau = Math.min(1, Math.sqrt(rms) * 2.4)

      niveaux.shift()
      niveaux.push(niveau)
      // Écriture directe dans le DOM : soixante rendus React par seconde pour
      // vingt-deux barres coûtaient plus cher que l'animation elle-même.
      niveaux.forEach((n, i) => {
        const el = barresRef.current[i]
        if (el) el.style.transform = `scaleY(${0.12 + n * 0.88})`
      })
      rafRef.current = requestAnimationFrame(boucle)
    }
    boucle()
  }, [])

  // ─── Transcription ────────────────────────────────────────────────────────

  const transcrire = useCallback(
    async (blob: Blob, s: Settings, dictee: number): Promise<void> => {
      const fournisseur = PROVIDERS[s.provider]
      const corps = new FormData()
      corps.append('file', blob, 'dictee.webm')
      corps.append('model', fournisseur.model)
      corps.append('language', s.language)

      const controleur = new AbortController()
      abortRef.current = controleur

      try {
        const res = await fetch(fournisseur.endpoint, {
          method: 'POST',
          headers: { Authorization: `Bearer ${s.apiKey}` },
          body: corps,
          signal: controleur.signal
        })

        if (dicteeRef.current !== dictee) return

        if (!res.ok) {
          const brut = await res.text().catch(() => '')
          let detail = brut.slice(0, 160)
          try {
            detail = JSON.parse(brut)?.error?.message ?? detail
          } catch {
            // Réponse non JSON (page d'erreur d'un proxy) : on garde le brut.
          }
          echouer({
            titre:
              res.status === 401
                ? 'Clé API refusée'
                : res.status === 429
                  ? 'Quota atteint — réessayez dans un instant'
                  : `Erreur ${res.status}`,
            detail,
            reglages: res.status === 401
          })
          return
        }

        const texteRecu = String((await res.json())?.text ?? '').trim()
        if (dicteeRef.current !== dictee) return

        if (!texteRecu) {
          echouer({ titre: 'Aucune parole détectée', detail: 'Rien à coller.' })
          return
        }

        arreterTout()
        setTexte(texteRecu)
        setEtat('termine')
        // Court palier avant de rendre la main : on voit ce qui a été compris,
        // et le presse-papiers a le temps d'être écrit avant le collage.
        setTimeout(() => {
          if (dicteeRef.current === dictee) window.api.recordingDone(texteRecu)
        }, 350)
      } catch (err) {
        if (controleur.signal.aborted || dicteeRef.current !== dictee) return
        echouer({
          titre: 'Impossible de joindre le service',
          detail: String((err as Error)?.message || err).slice(0, 160)
        })
      }
    },
    [arreterTout, echouer]
  )

  // ─── Démarrage ────────────────────────────────────────────────────────────

  const demarrer = useCallback(async (): Promise<void> => {
    const dictee = ++dicteeRef.current
    setErreur(null)
    setTexte('')
    setSecondes(0)
    setEtat('demarrage')

    const s = await window.api.getSettings()
    if (dicteeRef.current !== dictee) return

    if (!s.apiKey) {
      echouer({
        titre: 'Clé API manquante',
        detail: `Ajoutez une clé ${PROVIDERS[s.provider].label.split(' —')[0]} dans les réglages.`,
        reglages: true
      })
      return
    }

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: s.deviceId ? { deviceId: { exact: s.deviceId } } : true
      })
    } catch (err) {
      const nom = String((err as Error)?.name || '')
      if (nom === 'OverconstrainedError' || nom === 'NotFoundError') {
        // Les identifiants de périphérique changent de session : le micro
        // choisi hier peut ne plus exister aujourd'hui.
        echouer({
          titre: 'Microphone introuvable',
          detail: 'Le micro choisi a disparu — sélectionnez-en un autre.',
          reglages: true
        })
      } else if (nom === 'NotAllowedError') {
        echouer({
          titre: 'Accès au micro refusé',
          detail: 'Windows → Confidentialité → Microphone.'
        })
      } else {
        echouer({ titre: 'Micro indisponible', detail: nom })
      }
      return
    }

    if (dicteeRef.current !== dictee) {
      stream.getTracks().forEach((t) => t.stop())
      return
    }

    streamRef.current = stream
    suivreNiveau(stream)

    const morceaux: Blob[] = []
    const recorder = new MediaRecorder(stream)
    recorderRef.current = recorder
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) morceaux.push(e.data)
    }
    recorder.onstop = () => {
      cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
      if (dicteeRef.current !== dictee) return
      const blob = new Blob(morceaux, { type: 'audio/webm' })
      // En dessous, il n'y a qu'un déclenchement involontaire : l'API
      // facturerait une requête pour du silence.
      if (blob.size < 2000) {
        arreterTout()
        window.api.recordingCancelled()
        return
      }
      setEtat('transcription')
      void transcrire(blob, s, dictee)
    }
    recorder.start()
    setEtat('ecoute')
  }, [arreterTout, echouer, suivreNiveau, transcrire])

  // ─── Commandes ────────────────────────────────────────────────────────────

  const arreter = useCallback((): void => {
    // On ne touche pas au numéro de dictée : `onstop` doit poursuivre jusqu'à
    // la transcription.
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
  }, [])

  const annuler = useCallback((): void => {
    // Le numéro change d'abord : tout ce qui revient ensuite est ignoré.
    dicteeRef.current++
    arreterTout()
    setEtat('demarrage')
    window.api.recordingCancelled()
  }, [arreterTout])

  useEffect(() => {
    const off = [
      window.api.onStartRecording(() => void demarrer()),
      window.api.onStopRecording(arreter),
      window.api.onCancelRecording(annuler)
    ]
    return () => off.forEach((f) => f())
  }, [demarrer, arreter, annuler])

  // Minuteur : au-delà de quelques secondes, on perd la notion du temps parlé,
  // et les fournisseurs facturent à la durée.
  useEffect(() => {
    if (etat !== 'ecoute') return
    const debut = Date.now()
    const t = setInterval(() => setSecondes(Math.floor((Date.now() - debut) / 1000)), 250)
    return () => clearInterval(t)
  }, [etat])

  // ─── Rendu ────────────────────────────────────────────────────────────────

  const chrono = `${Math.floor(secondes / 60)}:${String(secondes % 60).padStart(2, '0')}`

  return (
    <div className="flex h-full items-end justify-center pb-4">
      <div className="animate-fade-up flex w-full max-w-[430px] flex-col gap-2 rounded-xl border border-shell-border bg-shell/95 px-3.5 py-3 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-3">
          {/* Pastille du micro : c'est elle qui porte l'état. */}
          <div className="relative flex-shrink-0">
            {etat === 'ecoute' && (
              <span className="animate-ripple absolute inset-0 rounded-full bg-destructive/40" />
            )}
            <div
              className={cn(
                'relative flex h-9 w-9 items-center justify-center rounded-full transition-colors',
                etat === 'ecoute' && 'bg-destructive text-destructive-foreground',
                etat === 'transcription' && 'bg-shell-raised text-shell-muted',
                etat === 'termine' && 'bg-positive text-white',
                etat === 'erreur' && 'bg-destructive/15 text-destructive',
                etat === 'demarrage' && 'bg-shell-raised text-shell-muted'
              )}
            >
              {etat === 'erreur' ? (
                <MicOff className="h-4 w-4" />
              ) : etat === 'termine' ? (
                <Check className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </div>
          </div>

          <div className="min-w-0 flex-1">
            {etat === 'demarrage' && <p className="text-shell-muted">Ouverture du micro…</p>}

            {etat === 'ecoute' && (
              <div className="flex h-9 items-center gap-[3px]" aria-label="Niveau du micro">
                {Array.from({ length: BARRES }).map((_, i) => (
                  <span
                    key={i}
                    ref={(el) => (barresRef.current[i] = el)}
                    className="h-6 w-[3px] origin-center rounded-full bg-destructive/70 transition-transform duration-75"
                    style={{ transform: 'scaleY(0.12)' }}
                  />
                ))}
              </div>
            )}

            {etat === 'transcription' && (
              <p className="animate-shimmer bg-[linear-gradient(90deg,theme(colors.shell.muted),theme(colors.shell.foreground),theme(colors.shell.muted))] bg-[length:200%_100%] bg-clip-text text-transparent">
                Transcription…
              </p>
            )}

            {etat === 'termine' && <p className="truncate text-shell-foreground">{texte}</p>}

            {etat === 'erreur' && erreur && (
              <div className="min-w-0">
                <p className="truncate font-medium text-destructive">{erreur.titre}</p>
                {erreur.detail && (
                  <p className="truncate text-[11px] text-shell-muted">{erreur.detail}</p>
                )}
              </div>
            )}
          </div>

          {etat === 'ecoute' && (
            <span className="flex-shrink-0 font-mono text-xs tabular-nums text-shell-muted">
              {chrono}
            </span>
          )}

          <div className="flex flex-shrink-0 items-center gap-0.5">
            <button
              onClick={() => {
                annuler()
                window.api.openSettings()
              }}
              title="Paramètres"
              className="flex h-7 w-7 items-center justify-center rounded-md text-shell-muted transition-colors hover:bg-shell-raised hover:text-shell-foreground"
            >
              <Settings2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={annuler}
              title="Annuler (Échap)"
              className="flex h-7 w-7 items-center justify-center rounded-md text-shell-muted transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Rappel des touches : l'overlay n'a pas le focus, rien n'indiquerait
            autrement comment le refermer. */}
        <p className="px-0.5 text-[11px] leading-none text-shell-muted">
          {etat === 'ecoute' ? (
            <>
              Le raccourci valide · <kbd className="font-sans">Échap</kbd> annule
            </>
          ) : etat === 'erreur' && erreur?.reglages ? (
            'Ouvrez les paramètres pour corriger'
          ) : etat === 'termine' ? (
            'Copié dans le presse-papiers'
          ) : (
            ' '
          )}
        </p>
      </div>
    </div>
  )
}
