// Walk HUD entry: mounts over the 3D pane and switches first-person building on.
import { createRoot } from 'react-dom/client';
import './hud.css';
import App from './App.jsx';

const I = window.interior;
if (I) {
  const pane = document.getElementById('pane3d');
  const el = Object.assign(document.createElement('div'), { id: 'walkhud' });
  el.className = 'absolute inset-0 pointer-events-none z-10';
  pane.append(el);
  I.sandbox.enableSandbox(true);
  createRoot(el).render(<App I={I} pane={pane} />);
}
