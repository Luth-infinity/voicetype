# VoiceType

Dictée vocale de bureau : un raccourci ouvre le micro par-dessus n'importe quelle application,
vous parlez, et le texte se colle dans le champ où vous écriviez. Sans compte, sans serveur
intermédiaire, sans télémétrie.

La fenêtre visée **ne perd jamais le focus** : la barre s'affiche sans la voler, et le texte
arrive par une frappe `Ctrl+V` simulée dans l'application où vous étiez. Il n'y a rien à
recopier, rien à basculer.

La transcription passe par **Whisper**, chez Groq (gratuit) ou OpenAI, avec **votre** clé API.
L'audio va directement chez le fournisseur que vous choisissez.

## Fonctionnalités

- **Raccourci global** — `Alt+Shift+R` par défaut, remplaçable par n'importe quelle
  combinaison. Une pression lance la dictée, une seconde la valide, `Échap` l'annule. Il
  fonctionne par-dessus les applications en plein écran.
- **Niveau sonore réel** — les barres suivent le signal du micro, pas une animation. C'est le
  seul retour qui prouve que le bon périphérique est écouté.
- **Annulation franche** — `Échap` coupe la requête en vol. Une réponse qui reviendrait après
  est ignorée : le texte ne se colle jamais après coup.
- **Collage automatique** — la fenêtre visée est mémorisée au début de la dictée et remise au
  premier plan juste avant la frappe. À défaut, le texte reste dans le presse-papiers.
- **Deux fournisseurs** — Groq (`whisper-large-v3-turbo`, gratuit) ou OpenAI (`whisper-1`).
  Le modèle suit le fournisseur : `whisper-large-v3-turbo` n'existe pas chez OpenAI.
- **Formater** — le texte repasse par un modèle de langage qui ajoute paragraphes, listes à
  puces et gras sur l'essentiel, puis se colle en texte enrichi (Word, Gmail, Teams, Notion) avec
  une version brute pour les champs qui n'acceptent que du texte.
- **Traduire** — dictez dans votre langue, le texte arrive dans la langue choisie. Les deux
  options se basculent d'un clic dans la barre, pendant la dictée, et utilisent la même clé
  (`openai/gpt-oss-120b` chez Groq, `gpt-4.1-mini` chez OpenAI). Si le modèle ne répond pas,
  le texte brut est collé : une dictée ne se perd jamais.
- **Neuf langues** — français, anglais, espagnol, allemand, italien, portugais, néerlandais,
  japonais, chinois.
- **Choix du microphone** — la liste n'est lue qu'à l'ouverture des réglages : l'application
  n'allume jamais le témoin du micro au démarrage.
- **Thème clair / sombre** — suit le système, barre comprise.
- **Mise à jour automatique** sous Windows, depuis les releases GitHub.
- **Windows et macOS.**

## Ce qui se passe entre la pression et le texte

1. Le raccourci est capté par le process principal, qui mémorise la fenêtre au premier plan et
   montre la barre **sans lui donner le focus** (`showInactive`).
2. Le renderer ouvre le micro et démarre l'enregistrement — environ 150 ms.
3. Seconde pression : l'enregistrement s'arrête, l'audio part chez le fournisseur.
4. Le texte revient ; si Formater ou Traduire est allumé, il repasse chez le même fournisseur.
5. Il va dans le presse-papiers, et un `Ctrl+V` simulé le pose dans la fenêtre
   mémorisée.

Un enregistrement de moins de 2 Ko est abandonné sans appel à l'API : c'est un déclenchement
involontaire, et il serait facturé.

## Développement

```bash
npm install
npm run dev
```

```bash
npm run typecheck   # tsc --noEmit
npm run build       # typecheck + electron-vite build
```

Pour contrôler l'interface sans lancer Electron, voir la section correspondante de
[`CLAUDE.md`](CLAUDE.md) : le renderer se sert seul dans un navigateur avec un `window.api`
bouchonné, et le micro se simule avec un `OscillatorNode`.

## Packaging

```bash
npm run dist:win
```

```bash
npm run dist:mac
```

Les binaires arrivent dans `dist/`.

> **Le `.dmg` ne se construit que sur macOS** : `hdiutil` et `sips` sont des outils Apple non
> redistribuables, et electron-builder refuse explicitement la tentative depuis Windows. Un
> workflow GitHub Actions ([`.github/workflows/release.yml`](.github/workflows/release.yml))
> construit les deux plateformes à chaque tag `vX.Y.Z` et les joint à la release.

> **Signature** : les builds ne sont pas signés. Sur macOS, le premier lancement demande un
> clic droit → « Ouvrir » ; sur Windows, SmartScreen affiche un avertissement. C'est aussi la
> raison pour laquelle la mise à jour automatique n'existe que sous Windows : Squirrel.Mac
> exige une application signée et notariée.

## Architecture

```
src/
├── shared/settings.ts    la définition des réglages, partagée par les trois process
├── main/                 process principal (Node)
│   ├── index.ts          fenêtres, tray, raccourci global, IPC
│   ├── collage.ts        frappe clavier simulée, par plateforme
│   └── updates.ts        mise à jour depuis les releases GitHub
├── preload/index.ts      pont IPC, seule surface exposée au renderer
└── renderer/             React 18 + Tailwind
    ├── pages/Overlay.tsx   la barre pendant la dictée
    └── pages/Settings.tsx  la fenêtre de réglages
```

Les deux fenêtres partagent le même paquet et se distinguent par l'URL (`?page=overlay` ou
`?page=settings`).

**Le collage n'a pas la même prise selon le système.** Sous Windows, un PowerShell reste ouvert
en attente et injecte la frappe par `keybd_event` — en lancer un par dictée coûtait une
demi-seconde au pire moment. Sur macOS, la frappe passe par System Events, ce qui exige que
l'application figure dans *Réglages Système → Confidentialité et sécurité → Accessibilité* ;
les réglages le signalent quand ce n'est pas le cas.

## Réglages et données

Tout est local, dans `%APPDATA%\voice-type\` (Windows) ou
`~/Library/Application Support/voice-type/` (macOS) :

- `settings.json` — raccourci, fournisseur, clé API, langue, microphone, collage automatique
- `paste.ps1` — script de secours du collage, réécrit à chaque démarrage
- `perf.log` — les quarante dernières dictées, avec le temps d'ouverture du micro

**La clé API est stockée en clair** dans `settings.json`. Elle ne quitte la machine que vers le
fournisseur choisi, mais un autre programme du même compte utilisateur peut la lire.

Ni l'audio ni le texte ne sont conservés : l'enregistrement part, la transcription revient, tout
est oublié. Rien n'est envoyé ailleurs que chez le fournisseur de transcription.

## Limites connues

- **Le collage n'atteint pas une application élevée.** Windows interdit à un programme non
  élevé d'injecter des touches dans une fenêtre qui tourne en administrateur. Le texte reste
  alors dans le presse-papiers, à coller à la main — ou il faut lancer VoiceType élevé aussi.
- **Pas de mise à jour automatique sur macOS**, faute de signature Apple : les réglages
  signalent la nouvelle version et renvoient vers la page des releases.
- **La version macOS n'a pas été éprouvée** sur une machine réelle à ce jour : elle se
  construit et s'installe, mais le collage et la barre de menus n'ont été vérifiés que par le
  code.
- **Aucune vérification d'intégrité au lancement**, les builds n'étant pas signés.
