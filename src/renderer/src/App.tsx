import Overlay from './pages/Overlay'
import Settings from './pages/Settings'

/**
 * Les deux fenêtres partagent le même paquet et se distinguent par l'URL.
 * La page est lue à l'import, pas dans un effet : passer par un état affichait
 * l'overlay une image avant les réglages.
 */
const page = new URLSearchParams(window.location.search).get('page')

export default function App(): JSX.Element {
  return page === 'settings' ? <Settings /> : <Overlay />
}
