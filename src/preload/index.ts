import { contextBridge, ipcRenderer } from 'electron'
import type { Settings } from '../shared/settings'
import type { UpdateState } from '../main/updates'

/** Abonnement à un canal sans argument, avec sa fonction de retrait. */
function ecouter(canal: string, cb: () => void): () => void {
  const handler = (): void => cb()
  ipcRenderer.on(canal, handler)
  return () => ipcRenderer.removeListener(canal, handler)
}

const api = {
  getSettings: (): Promise<Settings> => ipcRenderer.invoke('get-settings'),

  saveSettings: (settings: Settings): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('save-settings', settings),

  appVersion: (): Promise<string> => ipcRenderer.invoke('app-version'),

  /** Le renderer adapte quelques textes : macOS ne sait pas s'auto-installer. */
  platform: process.platform as NodeJS.Platform,

  /** macOS : le collage automatique exige l'autorisation d'accessibilité. */
  accessibilityOk: (): Promise<boolean> => ipcRenderer.invoke('accessibility-ok'),
  accessibilityAsk: (): void => ipcRenderer.send('accessibility-ask'),

  openSettings: (): void => ipcRenderer.send('open-settings'),

  // ─── Enregistrement ───────────────────────────────────────────────────────

  /** Les réglages accompagnent l'ordre : le renderer n'a pas à les demander. */
  onStartRecording: (cb: (reglages: Settings) => void) => {
    const handler = (_e: unknown, reglages: Settings): void => cb(reglages)
    ipcRenderer.on('start-recording', handler)
    return () => ipcRenderer.removeListener('start-recording', handler)
  },
  onStopRecording: (cb: () => void) => ecouter('stop-recording', cb),
  onCancelRecording: (cb: () => void) => ecouter('cancel-recording', cb),

  /** Fin de dictée : texte vide = rien à coller, mais l'overlay se ferme. */
  recordingDone: (text: string): void => ipcRenderer.send('recording-done', text),
  recordingCancelled: (): void => ipcRenderer.send('recording-cancelled'),

  /** Jalons de démarrage, consignés dans userData/perf.log. */
  perf: (marques: Record<string, number>): void => ipcRenderer.send('perf', marques),

  // ─── Réglages ─────────────────────────────────────────────────────────────

  /** La fenêtre vient d'être montrée : moment choisi pour lister les micros. */
  onSettingsShown: (cb: () => void) => ecouter('settings-shown', cb),

  // ─── Mise à jour ──────────────────────────────────────────────────────────

  updateState: (): Promise<UpdateState> => ipcRenderer.invoke('update-state'),
  updateCheck: (): Promise<UpdateState> => ipcRenderer.invoke('update-check'),
  updateDownload: (): void => ipcRenderer.send('update-download'),
  updateInstall: (): void => ipcRenderer.send('update-install'),
  onUpdateState: (cb: (etat: UpdateState) => void) => {
    const handler = (_e: unknown, etat: UpdateState): void => cb(etat)
    ipcRenderer.on('update-state', handler)
    return () => ipcRenderer.removeListener('update-state', handler)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api

declare global {
  interface Window {
    api: Api
  }
}
