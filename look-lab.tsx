import { createRoot } from 'react-dom/client';
import { MiniPortrait } from './src/MiniPortrait';
createRoot(document.getElementById('root')!).render(
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <MiniPortrait look={Number(new URLSearchParams(location.search).get('look') || 3)} size={380} />
    </div>
);
