import { HashRouter, Routes, Route } from 'react-router-dom';
import { Home } from './pages/Home';
import { Start } from './pages/Start';
import { Running } from './pages/Running';
import { End } from './pages/End';

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/start" element={<Start />} />
        <Route path="/running" element={<Running />} />
        <Route path="/end" element={<End />} />
      </Routes>
    </HashRouter>
  );
}

export default App;