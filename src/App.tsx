import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Home } from './pages/Home';
import { Start } from './pages/Start';
import { Running } from './pages/Running';
import { End } from './pages/End';
import { HowToModules } from './pages/HowToModules';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/start" element={<Start />} />
        <Route path="/running" element={<Running />} />
        <Route path="/end" element={<End />} />
        <Route path="/how-to-create-modules" element={<HowToModules />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;