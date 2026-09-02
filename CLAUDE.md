# VoiceType — repères pour travailler sur ce dépôt

Application Electron de dictée : un raccourci global ouvre un overlay, la voix
part chez Groq ou OpenAI, le texte revient dans le presse-papiers et se colle
tout seul dans la fenêtre active. Elle vit dans la zone de notification.

Le code et les commentaires sont **en français**. Les commentaires expliquent
*pourquoi*, pas *quoi*.

## Structure

| | |
|---|---|
| `src/main/` | fenêtres, tray, raccourci global, collage, mises à jour |
| `src/preload/` | pont IPC, seule surface exposée au renderer |
| `src/renderer/src/pages/Overlay.tsx` | la barre flottante pendant la dictée |
| `src/renderer/src/pages/Settings.tsx` | la fenêtre de réglages |
| `src/shared/settings.ts` | **la** définition des réglages, partagée par les trois process |

Les trois process avaient chacun leur copie du type `Settings`, et elles
avaient divergé (le preload annonçait encore un `whisperApiKey` disparu). Toute
évolution des réglages passe par `src/shared/settings.ts` et par
`normalizeSettings()`, qui ramène les anciens fichiers à la forme courante.

## Direction artistique

Reprise de Hublink : neutres en oklch, seconde famille `shell` pour les
surfaces, Segoe UI Variable Text à 13 px, glyphe blanc monochrome sur tuile
sombre. Les variables CSS ne portent que les composantes (`0.66 0.215 24`), pas
la fonction — c'est ce qui permet à Tailwind d'y injecter `<alpha-value>` et de
garder `bg-destructive/10`.

## Publier une version

**La numérotation reste en `0.x`**, comme Hublink : `0.1.0`, `0.1.1`, `0.2.0`…
Le dépôt a d'abord porté une série `1.x` (jusqu'à `1.3.1`) ; elle est passée en
pré-version pour sortir du chemin des mises à jour, et ne doit pas reprendre.
Repasser au-dessus de `1.0.0` obligerait tout le monde à réinstaller à la main,
`electron-updater` ne redescendant jamais d'un numéro.

Il n'y a pas de CI de test. `electron-updater` lit les releases de
`Luth-infinity/voicetype` : sans release publiée, la vérification échoue en
silence et l'application se croit à jour.

1. Bumper `version` dans `package.json`.
2. `npm run dist:win`.
3. Pousser le tag : le workflow construit les deux plateformes et publie.
4. Redéployer le site (`cd site && vercel --prod`) pour que le journal des
   versions soit à jour tout de suite — il se rattrape sinon en dix minutes.

L'installeur est en un clic (`oneClick: true`) : une mise à jour ne doit pas
rouvrir l'assistant d'installation.

## Ce qu'il ne faut pas casser

- **`whisper-large-v3-turbo` n'existe que chez Groq.** OpenAI répond 400 et
  veut `whisper-1`. Les deux modèles sont dans `PROVIDERS`, jamais en dur.
- **L'overlay ne prend jamais le focus** (`showInactive`) : c'est ce qui permet
  au Ctrl+V simulé d'atterrir dans la fenêtre visée. Il ne reçoit donc aucune
  touche — Échap passe par un `globalShortcut` posé le temps de la dictée.
- **Le renderer doit toujours répondre au main** (`recordingDone` ou
  `recordingCancelled`), y compris en erreur : sinon `isRecording` reste vrai
  et le raccourci ne déclenche plus rien.
- **Chaque dictée porte un numéro** (`dicteeRef`). Une réponse d'API qui revient
  après une annulation appartient à une dictée périmée et doit être ignorée,
  sinon le texte se colle alors qu'on venait d'annuler.
- **Le tray veut deux PNG, pas un ICO.** Electron ramène un ICO à 256 px avant
  de le rendre ; on fournit 16 et 32 via `addRepresentation`. L'icône
  d'application, elle, reste un ICO multi-tailles.
- **Tailwind et PostCSS résolvent leurs chemins depuis le dossier d'où la
  commande est lancée.** `postcss.config.js` et `tailwind.config.js` sont
  ancrés sur `__dirname` : sans ça, une build lancée depuis le dossier parent
  sort sans aucun style, sans la moindre erreur.

## Le site

`site/` est la vitrine, déployée sur Vercel (`voicetype-app.vercel.app`, projet
`voicetype`) par `vercel --prod` depuis ce dossier. Elle lit les liens de
téléchargement et le journal des versions sur les releases GitHub : rien n'y
est écrit à la main, une version publiée suffit à mettre la page à jour.

`vercel link` **réécrit `site/.gitignore`** en n'y laissant que ses propres
entrées — vérifier que `.next` y figure encore après avoir relié le projet,
sinon la sortie de build part dans le dépôt.

`vercel.json` fixe `framework: nextjs` : un projet créé à la main sur Vercel
n'a pas de préréglage détecté, et sert alors `public/` en statique — la page
répond 404 alors que la construction a réussi.

L'index qui réunit les applications est un autre projet,
`Documents/Apps/luth` → `luth-apps.vercel.app`. Ajouter une app = une entrée
dans son `app/apps.ts`.

## Vérifier l'interface sans lancer Electron

Servir `src/renderer` avec une config Vite jetable (root `src/renderer`,
`css.postcss` pointé sur la racine du projet, alias `@shared` et `@renderer`)
et injecter un `window.api` bouchonné via `transformIndexHtml`. Le micro se
simule avec un `OscillatorNode` relié à `createMediaStreamDestination()`, ce
qui fait vivre la courbe de niveau sans autorisation.
