import { app } from 'electron'
import { execFile } from 'child_process'
import fs from 'fs'
import { join } from 'path'

/**
 * Colle le presse-papiers dans la fenêtre active.
 *
 * Les deux systèmes n'offrent pas la même prise : Windows laisse injecter une
 * frappe clavier au niveau du pilote, macOS passe par System Events et exige
 * pour cela une autorisation d'accessibilité.
 *
 * Un délai précède la frappe dans les deux cas : le presse-papiers vient
 * d'être écrit et l'overlay de se masquer, et sans lui le collage part avant
 * que la fenêtre visée ait repris la main.
 */

// `keybd_event` plutôt que SendKeys : SendKeys passe par le shell, qui ne
// rejoint pas toujours la fenêtre active.
const SCRIPT_WINDOWS = [
  'Add-Type -TypeDefinition @"',
  'using System;',
  'using System.Runtime.InteropServices;',
  'public class VTPaste {',
  '    [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);',
  '    public const byte VK_CONTROL = 0x11;',
  '    public const byte VK_V = 0x56;',
  '    public const uint KEYEVENTF_KEYUP = 0x0002;',
  '    public static void CtrlV() {',
  '        keybd_event(VK_CONTROL, 0, 0, UIntPtr.Zero);',
  '        keybd_event(VK_V, 0, 0, UIntPtr.Zero);',
  '        keybd_event(VK_V, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);',
  '        keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);',
  '    }',
  '}',
  '"@',
  'Start-Sleep -Milliseconds 180',
  '[VTPaste]::CtrlV()',
  ''
].join('\r\n')

// Écrit une fois pour toutes : le réécrire à chaque dictée ajoutait un accès
// disque sur le chemin le plus sensible à la latence.
const cheminScript = join(app.getPath('userData'), 'paste.ps1')

export function preparer(): void {
  if (process.platform !== 'win32') return
  try {
    fs.writeFileSync(cheminScript, SCRIPT_WINDOWS)
  } catch {
    // Sans ce fichier, seul le collage automatique est perdu : le texte reste
    // dans le presse-papiers.
  }
}

export function coller(): void {
  if (process.platform === 'win32') {
    execFile(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-File', cheminScript],
      () => {}
    )
    return
  }

  if (process.platform === 'darwin') {
    execFile(
      'osascript',
      [
        '-e',
        'delay 0.18',
        '-e',
        'tell application "System Events" to keystroke "v" using command down'
      ],
      () => {}
    )
  }
}
