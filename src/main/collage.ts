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
 * Sous Windows, la fenêtre visée est **mémorisée au moment où la dictée
 * commence**, puis remise au premier plan juste avant la frappe. Sans cela le
 * collage partait parfois ailleurs : entre le début de la dictée et la fin de
 * la transcription, il s'écoule plusieurs secondes pendant lesquelles rien
 * n'empêche une autre fenêtre de passer devant.
 */

// `[UIntPtr]::Zero`, pas `0` : PowerShell refuse de convertir un entier en
// UIntPtr et l'appel échoue — silencieusement, puisque personne ne lit sa
// sortie d'erreur. Le collage ne faisait alors strictement rien.
const SIGNATURE = [
  '[DllImport("user32.dll")] public static extern void keybd_event(byte b, byte s, uint f, UIntPtr e);',
  '[DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();',
  '[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);'
].join(' ')

const PREPARATION = [
  `$signature = '${SIGNATURE}'`,
  '$global:VT = Add-Type -MemberDefinition $signature -Name VT -Namespace VoiceType -PassThru',
  '$global:Z = [UIntPtr]::Zero',
  '$global:CIBLE = [IntPtr]::Zero',
  // Jeton de bonne santé : tant qu'il n'est pas revenu, on ne confie rien à
  // cet hôte. C'est ce contrôle qui manquait quand la déclaration échouait.
  "'VT-PRET'",
  ''
].join('\r\n')

/** Retient la fenêtre qui a le focus au début de la dictée. */
const MEMORISER = '$global:CIBLE = $VT::GetForegroundWindow()\r\n'

/** La remet devant, puis Ctrl enfoncé, V enfoncé, V relâché, Ctrl relâché. */
const FRAPPE = [
  'if ($CIBLE -ne [IntPtr]::Zero) { $VT::SetForegroundWindow($CIBLE) | Out-Null }',
  // Assez pour que le focus soit rendu, assez peu pour ne pas se voir.
  'Start-Sleep -Milliseconds 60',
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
 * écrite sur son entrée standard. C'est aussi lui qui garde en mémoire la
 * fenêtre visée d'un bout à l'autre de la dictée.
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

// Script lancé à la demande, quand l'hôte est absent ou fâché. Il ne peut pas
// mémoriser la fenêtre visée — il n'existe qu'au moment du collage — et se
// contente donc de frapper là où le focus se trouve.
const SCRIPT_REPLI = [
  `$signature = '${SIGNATURE}'`,
  '$VT = Add-Type -MemberDefinition $signature -Name VT -Namespace VoiceType -PassThru',
  '$Z = [UIntPtr]::Zero',
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

/** À appeler quand la dictée commence, tant que la bonne fenêtre a le focus. */
export function memoriserCible(): void {
  if (process.platform !== 'win32') return
  if (!hote) demarrerHote()
  if (hotePret && hote?.stdin?.writable) {
    try {
      hote.stdin.write(MEMORISER)
    } catch {
      hotePret = false
    }
  }
}

export function coller(): void {
  if (process.platform === 'darwin') {
    execFile(
      'osascript',
      [
        '-e',
        'delay 0.09',
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

  execFile(
    'powershell',
    ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-File', cheminRepli],
    () => {}
  )
  // L'hôte reviendra peut-être pour la prochaine dictée.
  demarrerHote()
}
