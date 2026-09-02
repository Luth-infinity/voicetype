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

/** Déclaration de `keybd_event`, posée une fois dans l'hôte PowerShell. */
const PREPARATION = [
  "$signature = '[DllImport(\"user32.dll\")] public static extern void keybd_event(byte b, byte s, uint f, UIntPtr e);'",
  '$global:VT = Add-Type -MemberDefinition $signature -Name VT -Namespace VoiceType -PassThru',
  ''
].join('\r\n')

/** Ctrl enfoncé, V enfoncé, V relâché, Ctrl relâché. */
const FRAPPE = [
  'Start-Sleep -Milliseconds 110',
  '$VT::keybd_event(0x11,0,0,0); $VT::keybd_event(0x56,0,0,0); $VT::keybd_event(0x56,0,2,0); $VT::keybd_event(0x11,0,2,0)',
  ''
].join('\r\n')

/**
 * Un PowerShell reste ouvert en attente.
 *
 * En lancer un à chaque dictée coûtait près d'une demi-seconde — démarrage de
 * l'hôte puis déclaration du type — et cette demi-seconde tombait juste au
 * moment où le texte devait apparaître. L'hôte paie ce prix une fois, au
 * démarrage de l'application, et chaque collage ne lui coûte plus qu'une
 * ligne écrite sur son entrée standard.
 */
let hote: ChildProcess | null = null

function demarrerHote(): void {
  if (process.platform !== 'win32' || hote) return
  try {
    hote = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', '-'], {
      stdio: ['pipe', 'ignore', 'ignore'],
      windowsHide: true
    })
    hote.on('exit', () => {
      hote = null
    })
    hote.on('error', () => {
      hote = null
    })
    hote.stdin?.write(PREPARATION)
  } catch {
    hote = null
  }
}

// ─── Repli ───────────────────────────────────────────────────────────────────

// Si l'hôte a disparu, on retombe sur un script lancé à la demande : plus lent,
// mais le texte finit collé.
const SCRIPT_REPLI = [
  '$signature = \'[DllImport("user32.dll")] public static extern void keybd_event(byte b, byte s, uint f, UIntPtr e);\'',
  '$VT = Add-Type -MemberDefinition $signature -Name VT -Namespace VoiceType -PassThru',
  'Start-Sleep -Milliseconds 110',
  '$VT::keybd_event(0x11,0,0,0); $VT::keybd_event(0x56,0,0,0); $VT::keybd_event(0x56,0,2,0); $VT::keybd_event(0x11,0,2,0)',
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

  if (!hote) demarrerHote()
  try {
    if (hote?.stdin?.writable) {
      hote.stdin.write(FRAPPE)
      return
    }
  } catch {
    hote = null
  }

  execFile(
    'powershell',
    ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-File', cheminRepli],
    () => {}
  )
}
