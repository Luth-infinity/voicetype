import {
  app,
  BrowserWindow,
  clipboard,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  nativeTheme,
  screen,
  session,
  shell,
  Tray
} from 'electron'
import { execFile } from 'child_process'
import fs from 'fs'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { DEFAULT_SETTINGS, normalizeSettings, type Settings } from '../shared/settings'
import * as updates from './updates'

// ─── Avant app.whenReady() ───────────────────────────────────────────────────
// Chromium bloque le micro hors HTTPS et pose sinon une demande d'accès que
// personne ne peut valider : la fenêtre de l'overlay n'a jamais le focus.
app.commandLine.appendSwitch('enable-media-stream')
app.commandLine.appendSwitch('use-fake-ui-for-media-stream')

// Une seconde instance réenregistrerait le raccourci (échec silencieux) et
// poserait une deuxième icône dans la zone de notification.
if (!app.requestSingleInstanceLock()) app.exit(0)

// ─── Réglages ────────────────────────────────────────────────────────────────

const settingsPath = join(app.getPath('userData'), 'settings.json')

function loadSettings(): Settings {
  try {
    return normalizeSettings(JSON.parse(fs.readFileSync(settingsPath, 'utf-8')))
  } catch {
    // Fichier absent au premier lancement, ou illisible : on repart des défauts
    // plutôt que d'empêcher le démarrage.
    return { ...DEFAULT_SETTINGS }
  }
}

function saveSettings(settings: Settings): void {
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
}

// ─── État ────────────────────────────────────────────────────────────────────

let overlayWindow: BrowserWindow | null = null
let settingsWindow: BrowserWindow | null = null
let tray: Tray | null = null
let currentSettings = loadSettings()
let isRecording = false
let quitting = false
/** Résolue quand l'overlay a fini de charger : un `send` avant serait perdu. */
let overlayReady: Promise<void> = Promise.resolve()

// ─── Icônes ──────────────────────────────────────────────────────────────────

const assetsDir = app.isPackaged
  ? join(process.resourcesPath, 'assets')
  : join(app.getAppPath(), 'assets')

const iconApp = join(assetsDir, 'icon.ico')

/**
 * L'icône de la zone de notification est un glyphe plat, pas la tuile de
 * l'application : sur le fond de la barre des tâches, une tuile sombre se lit
 * comme une case vide — c'est ce que donnait l'ancien PNG encodé en dur, qui
 * était en réalité une image vide. Elle suit le thème du système, sinon elle
 * disparaît dans un fond de même valeur.
 *
 * Deux PNG plutôt qu'un ICO : Electron ramène l'ICO à 256 pixels avant de le
 * rendre, et le glyphe revenait flou une fois redescendu à 16. On fournit donc
 * les deux définitions attendues, 100 % et 200 %.
 */
function trayIcon(): Electron.NativeImage {
  const nom = isRecording ? 'tray-rec' : nativeTheme.shouldUseDarkColors ? 'tray-dark' : 'tray-light'
  const image = nativeImage.createFromPath(join(assetsDir, `${nom}-16.png`))
  image.addRepresentation({
    scaleFactor: 2,
    buffer: fs.readFileSync(join(assetsDir, `${nom}-32.png`))
  })
  return image
}

// ─── Fenêtres ────────────────────────────────────────────────────────────────

function chargerPage(win: BrowserWindow, page: 'overlay' | 'settings'): void {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}?page=${page}`)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), { query: { page } })
  }
}

function createOverlayWindow(): void {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  overlayWindow = new BrowserWindow({
    width: 460,
    height: 150,
    x: Math.floor(width / 2 - 230),
    y: height - 180,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: true,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: false
    }
  })

  // Au-dessus des fenêtres plein écran également : on dicte souvent dans une
  // visio ou un jeu.
  overlayWindow.setAlwaysOnTop(true, 'screen-saver')

  overlayReady = new Promise((resolve) => {
    overlayWindow?.webContents.once('did-finish-load', () => resolve())
  })

  chargerPage(overlayWindow, 'overlay')
}

function createSettingsWindow(): void {
  settingsWindow = new BrowserWindow({
    width: 560,
    height: 760,
    minWidth: 480,
    minHeight: 520,
    show: false,
    icon: iconApp,
    title: 'VoiceType — Paramètres',
    autoHideMenuBar: true,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#191a1c' : '#fcfcfd',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: false
    }
  })

  chargerPage(settingsWindow, 'settings')

  // Fermer la fenêtre ne quitte pas : l'application vit dans la zone de
  // notification, on se contente de la masquer.
  settingsWindow.on('close', (e) => {
    if (quitting) return
    e.preventDefault()
    settingsWindow?.hide()
  })

  // La liste des microphones ne se lit qu'une fois l'accès accordé, donc en
  // ouvrant le flux : le faire au démarrage allumerait le témoin du micro sans
  // que personne n'ait rien demandé. On attend l'ouverture de la fenêtre.
  settingsWindow.on('show', () => {
    settingsWindow?.webContents.send('settings-shown')
    void updates.verifier()
  })

  // Les liens externes (obtenir une clé API) partent dans le navigateur.
  settingsWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
}

function ouvrirParametres(): void {
  if (!settingsWindow) return
  settingsWindow.show()
  settingsWindow.focus()
}

// ─── Zone de notification ────────────────────────────────────────────────────

function buildTrayMenu(): Menu {
  const maj = updates.currentState()
  const items: Electron.MenuItemConstructorOptions[] = [
    { label: `VoiceType ${app.getVersion()}`, enabled: false },
    { label: `Raccourci : ${currentSettings.shortcut}`, enabled: false },
    { type: 'separator' }
  ]

  if (maj.statut === 'disponible') {
    items.push({ label: `Mise à jour ${maj.version} disponible…`, click: ouvrirParametres })
  } else if (maj.statut === 'prete') {
    items.push({ label: `Installer la version ${maj.version}`, click: installerMaj })
  }

  items.push(
    { label: 'Paramètres', click: ouvrirParametres },
    { type: 'separator' },
    { label: 'Quitter', click: quitter }
  )
  return Menu.buildFromTemplate(items)
}

function refreshTray(): void {
  if (!tray) return
  tray.setImage(trayIcon())
  tray.setToolTip(
    isRecording ? 'VoiceType — enregistrement…' : `VoiceType — ${currentSettings.shortcut}`
  )
  tray.setContextMenu(buildTrayMenu())
}

function createTray(): void {
  tray = new Tray(trayIcon())
  // Sous Windows le clic gauche n'ouvre rien par défaut, et l'icône paraît
  // alors morte : on l'associe aux réglages, comme le double-clic.
  tray.on('click', ouvrirParametres)
  tray.on('double-click', ouvrirParametres)
  refreshTray()

  nativeTheme.on('updated', refreshTray)
  updates.onChange((etat) => {
    refreshTray()
    settingsWindow?.webContents.send('update-state', etat)
  })
}

// ─── Enregistrement ──────────────────────────────────────────────────────────

function registerShortcut(shortcut: string): boolean {
  globalShortcut.unregisterAll()
  try {
    return globalShortcut.register(shortcut, toggleRecording)
  } catch {
    return false
  }
}

async function toggleRecording(): Promise<void> {
  // Garde-fou : si l'overlay a disparu sans le dire (renderer rechargé, page
  // plantée), l'état resterait sur « en cours » et le raccourci n'agirait plus.
  if (isRecording && !overlayWindow?.isVisible()) isRecording = false

  if (isRecording) {
    overlayWindow?.webContents.send('stop-recording')
    return
  }

  isRecording = true
  refreshTray()
  await overlayReady
  // `showInactive` : la fenêtre visée garde le focus, sinon le collage
  // automatique atterrirait dans l'overlay.
  overlayWindow?.showInactive()
  overlayWindow?.webContents.send('start-recording')

  // Échap annule. Le raccourci n'est global que le temps de l'enregistrement :
  // l'overlay n'ayant pas le focus, il ne reçoit aucune touche autrement.
  try {
    globalShortcut.register('Escape', () => overlayWindow?.webContents.send('cancel-recording'))
  } catch {
    // Échap déjà pris : on s'en passe, les boutons de l'overlay restent.
  }
}

/** Fin d'enregistrement, quelle qu'en soit l'issue. */
function finirEnregistrement(): void {
  isRecording = false
  globalShortcut.unregister('Escape')
  overlayWindow?.hide()
  refreshTray()
}

// ─── Collage automatique ─────────────────────────────────────────────────────

// `keybd_event` plutôt que SendKeys : SendKeys passe par le shell, qui ne
// rejoint pas toujours la fenêtre active.
const PASTE_SCRIPT = [
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
  // Le presse-papiers vient d'être écrit et l'overlay de se masquer : sans ce
  // délai, le Ctrl+V part avant que la fenêtre visée ait repris la main.
  'Start-Sleep -Milliseconds 180',
  '[VTPaste]::CtrlV()',
  ''
].join('\r\n')

// Écrit une fois pour toutes : le réécrire à chaque dictée ajoutait un accès
// disque sur le chemin le plus sensible à la latence.
const pasteScriptPath = join(app.getPath('userData'), 'paste.ps1')

function preparerCollage(): void {
  try {
    fs.writeFileSync(pasteScriptPath, PASTE_SCRIPT)
  } catch {
    // Sans ce fichier, seul le collage automatique est perdu : le texte reste
    // dans le presse-papiers.
  }
}

function autoPaste(): void {
  if (process.platform !== 'win32') return
  execFile(
    'powershell',
    ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-File', pasteScriptPath],
    () => {}
  )
}

// ─── Cycle de vie ────────────────────────────────────────────────────────────

function quitter(): void {
  quitting = true
  app.quit()
}

function installerMaj(): void {
  quitting = true
  updates.installer()
}

app.whenReady().then(() => {
  // Les deux gestionnaires de permissions ont un rôle distinct : le contrôle
  // synchrone répond aussi à `navigator.permissions.query()`, que le renderer
  // interroge avant `getUserMedia`. Y refuser le micro fermerait la boucle
  // avant même la demande.
  session.defaultSession.setPermissionCheckHandler((_wc, permission) =>
    ['media', 'microphone', 'audioCapture'].includes(permission)
  )
  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) =>
    cb(['media', 'microphone', 'audioCapture', 'clipboard-sanitized-write'].includes(permission))
  )
  session.defaultSession.setDevicePermissionHandler(() => true)

  app.setAppUserModelId('com.voicetype.app')
  preparerCollage()
  createOverlayWindow()
  createSettingsWindow()
  createTray()

  if (!registerShortcut(currentSettings.shortcut)) {
    // Raccourci pris par une autre application : sans fenêtre ouverte personne
    // ne le saurait, on montre les réglages — seul endroit où le corriger.
    ouvrirParametres()
  }

  updates.surveiller()

  // ─── IPC ──────────────────────────────────────────────────────────────────

  ipcMain.handle('get-settings', () => currentSettings)

  ipcMain.handle('save-settings', (_, recu: unknown) => {
    const precedent = currentSettings.shortcut
    const suivant = normalizeSettings(recu)

    if (suivant.shortcut !== precedent && !registerShortcut(suivant.shortcut)) {
      // On remet l'ancien : sans raccourci enregistré, plus rien ne déclenche
      // l'application.
      registerShortcut(precedent)
      return { success: false, error: 'Ce raccourci est déjà utilisé par une autre application.' }
    }

    currentSettings = suivant
    saveSettings(currentSettings)
    refreshTray()
    return { success: true }
  })

  ipcMain.on('recording-done', (_, text: string) => {
    finirEnregistrement()
    const propre = (text || '').trim()
    if (!propre) return
    clipboard.writeText(propre)
    if (currentSettings.autoPaste) autoPaste()
  })

  ipcMain.on('recording-cancelled', finirEnregistrement)

  ipcMain.on('open-settings', ouvrirParametres)

  ipcMain.handle('app-version', () => app.getVersion())
  ipcMain.handle('update-state', () => updates.currentState())
  ipcMain.handle('update-check', () => updates.verifier())
  ipcMain.on('update-download', () => void updates.telecharger())
  ipcMain.on('update-install', installerMaj)
})

app.on('second-instance', ouvrirParametres)

app.on('will-quit', () => globalShortcut.unregisterAll())

// Toutes les fenêtres peuvent être fermées : l'application continue dans la
// zone de notification. Un gestionnaire vide suffit à empêcher l'arrêt.
app.on('window-all-closed', () => {})
