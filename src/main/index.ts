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
  systemPreferences,
  Tray
} from 'electron'
import fs from 'fs'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { DEFAULT_SETTINGS, normalizeSettings, type Settings } from '../shared/settings'
import * as collage from './collage'
import * as updates from './updates'

// ─── Avant app.whenReady() ───────────────────────────────────────────────────
// Chromium bloque le micro hors HTTPS et pose sinon une demande d'accès que
// personne ne peut valider : la fenêtre de l'overlay n'a jamais le focus.
app.commandLine.appendSwitch('enable-media-stream')
app.commandLine.appendSwitch('use-fake-ui-for-media-stream')

// L'overlay passe sa vie masqué, et Windows déclare occluse toute fenêtre
// qui ne se voit pas : Chromium ralentit alors ses minuteurs, puis gèle son
// renderer. Le réveil se paie au moment précis où l'on attend la barre.
app.commandLine.appendSwitch('disable-background-timer-throttling')
app.commandLine.appendSwitch('disable-renderer-backgrounding')
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion')

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
/** Horodatage de la pression du raccourci, pour le journal de performance. */
let departDictee = 0
/** Résolue quand l'overlay a fini de charger : un `send` avant serait perdu. */
let overlayReady: Promise<void> = Promise.resolve()

// ─── Icônes ──────────────────────────────────────────────────────────────────

// `app.getAppPath()` ne désigne pas le même dossier selon la façon dont
// Electron est lancé : on remonte depuis le fichier construit, qui est
// toujours dans out/main.
const assetsDir = app.isPackaged
  ? join(process.resourcesPath, 'assets')
  : join(__dirname, '../../assets')

const iconApp = join(assetsDir, 'icon.ico')

/**
 * L'icône de la zone de notification est un glyphe plat, pas la tuile de
 * l'application : sur le fond de la barre des tâches, une tuile sombre se lit
 * comme une case vide — c'est ce que donnait l'ancien PNG encodé en dur, qui
 * était en réalité une image vide.
 *
 * Deux PNG plutôt qu'un ICO : Electron ramène l'ICO à 256 pixels avant de le
 * rendre, et le glyphe revenait flou une fois redescendu à 16.
 *
 * macOS veut une « image template » : un glyphe noir que le système inverse
 * lui-même selon la barre de menus et la sélection. L'enregistrement fait
 * exception — un template ne peut pas porter de couleur, et le rouge est ce
 * qui signale le mieux qu'un micro est ouvert.
 */
function trayIcon(): Electron.NativeImage {
  const mac = process.platform === 'darwin'
  const base = mac
    ? isRecording
      ? 'tray-rec-mac'
      : 'trayTemplate'
    : isRecording
      ? 'tray-rec'
      : nativeTheme.shouldUseDarkColors
        ? 'tray-dark'
        : 'tray-light'

  const [normal, double] = mac
    ? [`${base}.png`, `${base}@2x.png`]
    : [`${base}-16.png`, `${base}-32.png`]

  const image = nativeImage.createFromPath(join(assetsDir, normal))
  try {
    image.addRepresentation({ scaleFactor: 2, buffer: fs.readFileSync(join(assetsDir, double)) })
  } catch {
    // Une icône manquante ne doit pas interrompre le démarrage : sans ce
    // filet, l'exception traversait `app.whenReady()` et aucun canal IPC
    // n'était plus enregistré — l'application se lançait à moitié.
  }
  if (mac && !isRecording) image.setTemplateImage(true)
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
    // La barre ne doit jamais prendre le focus, même cliquée : c'est la
    // fenêtre visée qui doit le garder, sinon le Ctrl+V simulé atterrit dans
    // le vide. Les boutons répondent quand même à la souris.
    focusable: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: false,
      // Cette fenêtre doit répondre à l'instant où le raccourci tombe : elle
      // ne peut pas être mise en veille comme un onglet d'arrière-plan.
      backgroundThrottling: false
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
  // alors morte : on l'associe aux réglages. Sur macOS il déroule déjà le
  // menu, y greffer une fenêtre serait une surprise.
  if (process.platform !== 'darwin') {
    tray.on('click', ouvrirParametres)
    tray.on('double-click', ouvrirParametres)
  }
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

  // macOS demande l'accès au micro au niveau du système, avant Chromium.
  // L'appel est instantané une fois l'autorisation accordée.
  if (process.platform === 'darwin') await systemPreferences.askForMediaAccess('microphone')

  // Tant que rien n'a bougé, la fenêtre visée est celle qui a le focus.
  collage.memoriserCible()

  isRecording = true
  refreshTray()
  await overlayReady
  // `showInactive` : la fenêtre visée garde le focus, sinon le collage
  // automatique atterrirait dans l'overlay.
  overlayWindow?.showInactive()
  departDictee = Date.now()
  overlayWindow?.webContents.send('start-recording', currentSettings)

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

// ─── Journal de performance ──────────────────────────────────────────────────

// Le ressenti et la mesure divergeaient : on garde une trace des dernières
// dictées, écrite là où l'on peut aller la lire, plutôt que d'en débattre.
const cheminPerf = join(app.getPath('userData'), 'perf.log')
const PERF_LIGNES = 40

function noterPerf(ligne: string): void {
  try {
    const passe = fs.existsSync(cheminPerf) ? fs.readFileSync(cheminPerf, 'utf-8') : ''
    const lignes = [
      ...passe.split(/\r?\n/).filter(Boolean),
      `${new Date().toISOString()}  ${ligne}`
    ]
    fs.writeFileSync(cheminPerf, lignes.slice(-PERF_LIGNES).join('\r\n') + '\r\n')
  } catch {
    // Un journal absent n'empêche rien.
  }
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
  // L'application vit dans la barre de menus : une icône dans le Dock
  // laisserait croire qu'il y a une fenêtre à retrouver.
  app.dock?.hide()
  collage.preparer()
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
    if (currentSettings.autoPaste) collage.coller()
  })

  ipcMain.on('recording-cancelled', finirEnregistrement)

  ipcMain.on('open-settings', ouvrirParametres)

  ipcMain.on('perf', (_, marques: Record<string, number>) => {
    const depuisRaccourci = Date.now() - departDictee
    const detail = Object.entries(marques)
      .map(([nom, ms]) => `${nom}=${Math.round(ms)}ms`)
      .join(' ')
    noterPerf(`raccourci→micro ${depuisRaccourci}ms  ${detail}`)
  })

  ipcMain.handle('app-version', () => app.getVersion())

  // Le collage automatique passe par System Events sur macOS, qui exige que
  // l'application figure dans Confidentialité → Accessibilité. Sans ce
  // contrôle, la dictée semblerait marcher et ne collerait jamais rien.
  ipcMain.handle('accessibility-ok', () =>
    process.platform !== 'darwin' || systemPreferences.isTrustedAccessibilityClient(false)
  )
  ipcMain.on('accessibility-ask', () => {
    if (process.platform === 'darwin') systemPreferences.isTrustedAccessibilityClient(true)
  })
  ipcMain.handle('update-state', () => updates.currentState())
  ipcMain.handle('update-check', () => updates.verifier())
  ipcMain.on('update-download', () => void updates.telecharger())
  ipcMain.on('update-install', installerMaj)
})

app.on('second-instance', ouvrirParametres)

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  collage.arreter()
})

// Toutes les fenêtres peuvent être fermées : l'application continue dans la
// zone de notification. Un gestionnaire vide suffit à empêcher l'arrêt.
app.on('window-all-closed', () => {})
