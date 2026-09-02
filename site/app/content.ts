/**
 * Les textes du site, dans les deux langues.
 *
 * Tout ce qui se lit est ici : la vitrine ne contient plus une seule phrase
 * en dur, sans quoi la version anglaise finit par prendre du retard sur la
 * française sans que personne ne s'en aperçoive.
 */

export type Langue = 'fr' | 'en';

export type Contenu = {
  meta: { title: string; description: string };
  nav: { fonctions: string; versions: string; telecharger: string; langue: string };
  hero: { titre: string; texte: string; mention: string };
  barre: { legende: string };
  etapes: { titre: string; items: [string, string][] };
  details: [string, string][];
  telecharger: {
    windows: string;
    mac: string;
    macIntel: string;
    toutes: string;
    version: string;
    titre: string;
    texte: string;
    signature: string;
  };
  changelog: { titre: string };
  pied: { suite: string; code: string; versions: string };
};

export const fr: Contenu = {
  meta: {
    title: 'VoiceType — dictez, le texte est déjà collé',
    description:
      "Un raccourci, vous parlez, le texte arrive dans la fenêtre où vous étiez. Pour Windows et macOS, avec votre propre clé Whisper."
  },
  nav: {
    fonctions: "Ce qu'il fait",
    versions: 'Versions',
    telecharger: 'Télécharger',
    langue: 'Langue'
  },
  hero: {
    titre: 'Parlez. Le texte est déjà là.',
    texte:
      "Un raccourci ouvre le micro, où que vous soyez. Vous dictez, et le texte se colle dans le champ où vous écriviez — un mail, un ticket, un message. La fenêtre ne perd jamais le focus.",
    mention: 'Windows et macOS · gratuit · votre propre clé de transcription'
  },
  barre: {
    legende:
      "C'est tout ce que l'application montre pendant que vous parlez : une barre au-dessus de votre travail, dont les niveaux suivent votre voix. Elle disparaît dès que le texte est posé."
  },
  etapes: {
    titre: "Trois secondes entre l'idée et le texte.",
    items: [
      [
        'Le raccourci',
        "Alt+Shift+R par défaut, ou celui que vous voulez. Il fonctionne par-dessus n'importe quelle application, y compris en plein écran."
      ],
      [
        'Vous parlez',
        'La barre apparaît sans voler le focus. Le raccourci à nouveau pour valider, Échap pour annuler — la requête est alors vraiment coupée.'
      ],
      [
        'Le texte arrive',
        'Whisper transcrit, le texte va dans le presse-papiers, et un Ctrl+V simulé le pose là où vous étiez. Rien à recopier.'
      ]
    ]
  },
  details: [
    [
      'Votre clé, votre facture',
      "VoiceType n'a pas de serveur et ne revend rien. Vous branchez une clé Groq — gratuite — ou OpenAI, et l'audio va directement chez le fournisseur choisi."
    ],
    [
      "Rien n'est conservé",
      "Ni l'audio ni le texte ne sont stockés : l'enregistrement part, la transcription revient, tout est oublié. Seuls vos réglages restent sur la machine."
    ],
    [
      'Neuf langues',
      'Français, anglais, espagnol, allemand, italien, portugais, néerlandais, japonais, chinois. La langue se choisit une fois pour toutes.'
    ],
    [
      'Elle se met à jour seule',
      "Sous Windows, la nouvelle version se télécharge et s'installe depuis les réglages. Sur macOS, faute de signature Apple, elle vous signale simplement la version."
    ]
  ],
  telecharger: {
    windows: 'Télécharger pour Windows',
    mac: 'Télécharger pour Mac',
    macIntel: 'Mac Intel',
    toutes: 'Toutes les versions',
    version: 'Version',
    titre: 'Essayez sur un mail.',
    texte:
      "L'installation prend quelques secondes et ne demande aucun droit administrateur. Il vous faudra une clé de transcription — celle de Groq est gratuite, l'application vous y emmène.",
    signature:
      "L'application n'est signée par aucun éditeur : Windows peut afficher un avertissement SmartScreen (« Informations complémentaires » puis « Exécuter quand même »), et sur macOS il faut l'ouvrir la première fois par un clic droit puis « Ouvrir »."
  },
  changelog: { titre: 'Ce qui a changé.' },
  pied: { suite: 'Les autres apps', code: 'Code source', versions: 'Versions' }
};

export const en: Contenu = {
  meta: {
    title: 'VoiceType — dictate, the text is already pasted',
    description:
      'One shortcut, you speak, the text lands in the window you were in. For Windows and macOS, with your own Whisper key.'
  },
  nav: {
    fonctions: 'What it does',
    versions: 'Releases',
    telecharger: 'Download',
    langue: 'Language'
  },
  hero: {
    titre: 'Speak. The text is already there.',
    texte:
      'A shortcut opens the mic, wherever you are. You dictate, and the text lands in the field you were typing in — an email, a ticket, a message. The window never loses focus.',
    mention: 'Windows and macOS · free · your own transcription key'
  },
  barre: {
    legende:
      'This is all the app shows while you talk: a bar above your work, with levels that follow your voice. It disappears the moment the text is placed.'
  },
  etapes: {
    titre: 'Three seconds between the thought and the text.',
    items: [
      [
        'The shortcut',
        'Alt+Shift+R by default, or whichever you prefer. It works over any application, full-screen ones included.'
      ],
      [
        'You speak',
        'The bar appears without stealing focus. Press the shortcut again to confirm, Esc to cancel — the request is genuinely aborted.'
      ],
      [
        'The text arrives',
        'Whisper transcribes, the text goes to the clipboard, and a simulated Ctrl+V drops it right where you were. Nothing to retype.'
      ]
    ]
  },
  details: [
    [
      'Your key, your bill',
      'VoiceType has no server and resells nothing. You plug in a Groq key — free — or an OpenAI one, and the audio goes straight to the provider you chose.'
    ],
    [
      'Nothing is kept',
      'Neither the audio nor the text is stored: the recording goes, the transcription comes back, everything is forgotten. Only your settings stay on the machine.'
    ],
    [
      'Nine languages',
      'French, English, Spanish, German, Italian, Portuguese, Dutch, Japanese, Chinese. You pick the language once and forget about it.'
    ],
    [
      'It updates itself',
      'On Windows, the new version downloads and installs from the settings. On macOS, without an Apple signature, it simply tells you a version is out.'
    ]
  ],
  telecharger: {
    windows: 'Download for Windows',
    mac: 'Download for Mac',
    macIntel: 'Mac Intel',
    toutes: 'All releases',
    version: 'Version',
    titre: 'Try it on an email.',
    texte:
      'Installing takes a few seconds and needs no administrator rights. You will need a transcription key — the Groq one is free, and the app takes you there.',
    signature:
      'The app is not signed by any publisher: Windows may show a SmartScreen warning ("More info" then "Run anyway"), and on macOS you need to open it the first time with a right click then "Open".'
  },
  changelog: { titre: 'What changed.' },
  pied: { suite: 'The other apps', code: 'Source code', versions: 'Releases' }
};
