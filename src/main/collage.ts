import { app } from 'electron'
import { execFile, spawn, type ChildProcess } from 'child_process'
import fs from 'fs'
import { join } from 'path'

/**
 * Colle le presse-papiers dans la fenêtre active.
 *
 * Les deux systèmes n'offrent pas la même prise : Windows laisse injecter une
 * frappe clavier au niveau du pilote, macOS passe par System Events et exige
 * pour cela une autorisation d'accessibilité.
 *
 * Un court délai précède la frappe : le presse-papiers vient d'être écrit et
 * l'overlay de se masquer, et sans lui le collage part avant que la fenêtre
 * visée ait repris la main.
 */

// `[UIntPtr]::Zero`, pas `0` : PowerShell refuse de convertir un entier en
// UIntPtr et l'appel échoue — silencieusement, puisque personne ne lit sa
// sortie d'erreur. Le collage ne faisait alors strictement rien.
const ZERO = '[UIntPtr]::Zero'

/** Déclaration de `keybd_event`, posée une fois dans l'hôte PowerShell. */
const PREPARATION = [
  "$signature = '[DllImport(\"user32.dll\")] public static extern void keybd_event(byte b, byte s, uint f, UIntPtr e);'",
  '$global:VT = Add-Type -MemberDefinition $signature -Name VT -Namespace VoiceType -PassThru',
  `$global:Z = ${ZERO}`,
  // Jeton de bonne santé : tant qu'il n'est pas revenu, on ne confie rien à
  // cet hôte. C'est ce contrôle qui manquait quand la déclaration échouait.
  "'VT-PRET'",
  ''
].join('\r\n')

/** Ctrl enfoncé, V enfoncé, V relâché, Ctrl relâché. */
const FRAPPE = [
  'Start-Sleep -Milliseconds 110',
  '$VT::keybd_event(0x11,0,0,$Z); $VT::keybd_event(0x56,0,0,$Z); $VT::keybd_event(0x56,0,2,$Z); $VT::keybd_event(0x11,0,2,$Z)',
  ''
].join('\r\n')

/**
 * Un PowerShell reste ouvert en attente.
 *
 * En lancer un à chaque dictée coûtait près d'une demi-seconde — démarrage de
 * l'hôte puis déclaration du type — et cette demi-seconde tombait juste au
 * moment où le texte devait apparaître. L'hôte paie ce prix une fois, au
 * démarrage de l'application ; chaque collage ne lui coûte plus qu'une ligne
 * écrite sur son entrée standard.
 */
let hote: ChildProcess | null = null
let hotePret = false

function demarrerHote(): void {
  if (process.platform !== 'win32' || hote) return
  try {
    hote = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', '-'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    })
    hote.stdout?.on('data', (d: Buffer) => {
      if (d.toString().includes('VT-PRET')) hotePret = true
    })
    // La moindre erreur disqualifie l'hôte : on repart sur le script à la
    // demande, plus lent mais autonome.
    hote.stderr?.on('data', () => {
      hotePret = false
      hote?.kill()
    })
    hote.on('exit', () => {
      hote = null
      hotePret = false
    })
    hote.on('error', () => {
      hote = null
      hotePret = false
    })
    hote.stdin?.write(PREPARATION)
  } catch {
    hote = null
    hotePret = false
  }
}

// ─── Repli ───────────────────────────────────────────────────────────────────

// Script lancé à la demande, quand l'hôte est absent ou fâché.
const SCRIPT_REPLI = [
  '$signature = \'[DllImport("user32.dll")] public static extern void keybd_event(byte b, byte s, uint f, UIntPtr e);\'',
  '$VT = Add-Type -MemberDefinition $signature -Name VT -Namespace VoiceType -PassThru',
  `$Z = ${ZERO}`,
  'Start-Sleep -Milliseconds 110',
  '$VT::keybd_event(0x11,0,0,$Z); $VT::keybd_event(0x56,0,0,$Z); $VT::keybd_event(0x56,0,2,$Z); $VT::keybd_event(0x11,0,2,$Z)',
  ''
].join('\r\n')

const cheminRepli = join(app.getPath('userData'), 'paste.ps1')

export function preparer(): void {
  if (process.platform !== 'win32') return
  try {
    fs.writeFileSync(cheminRepli, SCRIPT_REPLI)
  } catch {
    // Sans ce fichier, seul le repli est perdu : l'hôte suffit.
  }
  demarrerHote()
}

export function arreter(): void {
  hote?.kill()
  hote = null
  hotePret = false
}

function collerParRepli(): void {
  execFile(
    'powershell',
    ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-File', cheminRepli],
    () => {}
  )
}

export function coller(): void {
  if (process.platform === 'darwin') {
    execFile(
      'osascript',
      [
        '-e',
        'delay 0.11',
        '-e',
        'tell application "System Events" to keystroke "v" using command down'
      ],
      () => {}
    )
    return
  }

  if (process.platform !== 'win32') return

  if (hotePret && hote?.stdin?.writable) {
    try {
      hote.stdin.write(FRAPPE)
      return
    } catch {
      hotePret = false
    }
  }

  collerParRepli()
  // L'hôte reviendra peut-être pour la prochaine dictée.
  demarrerHote()
}
