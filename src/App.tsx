import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Home } from './pages/Home';
import { Start } from './pages/Start';
import { Running } from './pages/Running';
import { End } from './pages/End';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/start" element={<Start />} />
        <Route path="/running" element={<Running />} />
        <Route path="/end" element={<End />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;