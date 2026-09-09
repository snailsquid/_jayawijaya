import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Home } from './pages/Home';
import { Start } from './pages/Start';
import { Running } from './pages/Running';
import { End } from './pages/End';
import { HowToModules } from './pages/HowToModules';
import { AuthGate } from './components/AuthGate';
import { SharedModule } from './pages/SharedModule';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/start" element={<AuthGate>{user => <Start key={user.id} user={user} />}</AuthGate>} />
        <Route path="/running" element={<Running />} />
        <Route path="/end" element={<End />} />
        <Route path="/how-to-create-modules" element={<HowToModules />} />
        <Route path="/shared/:token" element={<AuthGate>{() => <SharedModule />}</AuthGate>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
