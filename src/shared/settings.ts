/**
 * Source unique des réglages : le main les persiste, le preload les fait
 * transiter, le renderer les édite. Avant, chacun avait sa propre copie du
 * type et elles avaient divergé — le preload annonçait encore un
 * `whisperApiKey` disparu depuis longtemps.
 */

export type Provider = 'groq' | 'openai'

export type Settings = {
  shortcut: string
  provider: Provider
  apiKey: string
  /** Code de langue à deux lettres ('fr'), pas une étiquette régionale. */
  language: string
  /** '' = microphone par défaut du système. */
  deviceId: string
  autoPaste: boolean
  /** Passe le texte par un modèle de langage qui ajoute puces, gras, paragraphes. */
  formater: boolean
  /** Traduit le texte dicté vers `langueCible` avant de le coller. */
  traduire: boolean
  langueCible: string
}

/** Les options qu'on bascule depuis la barre, sans ouvrir les réglages. */
export type Options = Pick<Settings, 'formater' | 'traduire'>

export const DEFAULT_SETTINGS: Settings = {
  // Alt + une seule lettre est avalé par les menus des autres applications :
  // le défaut ne doit pas tomber dans le piège que l'écran de réglages signale.
  shortcut: 'Alt+Shift+R',
  provider: 'groq',
  apiKey: '',
  language: 'fr',
  deviceId: '',
  autoPaste: true,
  formater: false,
  traduire: false,
  langueCible: 'en'
}

/**
 * Les deux fournisseurs parlent le même dialecte (l'API de transcription
 * d'OpenAI), mais **pas** avec les mêmes modèles : `whisper-large-v3-turbo`
 * n'existe que chez Groq et OpenAI répond 400 si on le lui demande.
 */
export const PROVIDERS: Record<
  Provider,
  {
    label: string
    model: string
    endpoint: string
    prefix: string
    url: string
    hint: string
    /**
     * Modèle de langage pour Formater et Traduire. Même clé, même fournisseur :
     * personne n'a à créer un second compte pour ces deux options.
     */
    chat: { model: string; endpoint: string; extra?: Record<string, unknown> }
  }
> = {
  groq: {
    label: 'Groq — Whisper large v3 turbo',
    model: 'whisper-large-v3-turbo',
    endpoint: 'https://api.groq.com/openai/v1/audio/transcriptions',
    prefix: 'gsk_',
    url: 'https://console.groq.com/keys',
    hint: 'Compte gratuit sur console.groq.com → API Keys.',
    chat: {
      // Llama 3.3 figure encore dans la doc de Groq mais n'est plus servi aux
      // nouvelles clés (404) : c'est la liste `/models` qui fait foi.
      model: 'openai/gpt-oss-120b',
      endpoint: 'https://api.groq.com/openai/v1/chat/completions',
      // Modèle à raisonnement : on le réduit au minimum, la tâche est simple
      // et chaque seconde s'ajoute avant le collage.
      extra: { reasoning_effort: 'low' }
    }
  },
  openai: {
    label: 'OpenAI — Whisper',
    model: 'whisper-1',
    endpoint: 'https://api.openai.com/v1/audio/transcriptions',
    prefix: 'sk-',
    url: 'https://platform.openai.com/api-keys',
    hint: 'Compte OpenAI approvisionné en crédits.',
    chat: {
      model: 'gpt-4.1-mini',
      endpoint: 'https://api.openai.com/v1/chat/completions'
    }
  }
}

export const LANGUAGES = [
  { value: 'fr', label: 'Français' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'de', label: 'Deutsch' },
  { value: 'it', label: 'Italiano' },
  { value: 'pt', label: 'Português' },
  { value: 'nl', label: 'Nederlands' },
  { value: 'ja', label: '日本語' },
  { value: 'zh', label: '中文' }
] as const

/**
 * Ramène n'importe quel contenu de `settings.json` à la forme courante : le
 * fichier survit aux versions, donc il contient des clés disparues et parfois
 * des valeurs devenues invalides (une langue `fr-FR` que la liste déroulante
 * ne sait plus sélectionner, par exemple).
 */
export function normalizeSettings(brut: unknown): Settings {
  const s = (brut ?? {}) as Partial<Record<keyof Settings, unknown>>
  const texte = (v: unknown, defaut: string): string =>
    typeof v === 'string' && v.trim() ? v : defaut

  const provider = s.provider === 'openai' ? 'openai' : 'groq'
  const language = texte(s.language, DEFAULT_SETTINGS.language).split(/[-_]/)[0].toLowerCase()

  return {
    shortcut: texte(s.shortcut, DEFAULT_SETTINGS.shortcut),
    provider,
    apiKey: typeof s.apiKey === 'string' ? s.apiKey : '',
    language: LANGUAGES.some((l) => l.value === language) ? language : DEFAULT_SETTINGS.language,
    // 'default' est l'identifiant que Chromium donne au micro système : on le
    // ramène à '' pour ne pas le contraindre nommément, il change de session.
    deviceId: typeof s.deviceId === 'string' && s.deviceId !== 'default' ? s.deviceId : '',
    autoPaste: typeof s.autoPaste === 'boolean' ? s.autoPaste : DEFAULT_SETTINGS.autoPaste,
    formater: s.formater === true,
    traduire: s.traduire === true,
    langueCible: LANGUAGES.some((l) => l.value === s.langueCible)
      ? (s.langueCible as string)
      : DEFAULT_SETTINGS.langueCible
  }
}
