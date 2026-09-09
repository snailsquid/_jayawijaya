import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Home } from './pages/Home';
import { Start } from './pages/Start';
import { Running } from './pages/Running';
import { End } from './pages/End';
import { HowToModules } from './pages/HowToModules';
import { AuthGate } from './components/AuthGate';
import { Pricing } from './pages/Pricing';
import { SharedModule } from './pages/SharedModule';
import { Account } from './pages/Account';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/start" element={<AuthGate>{user => <Start key={user.id} user={user} />}</AuthGate>} />
        <Route path="/running" element={<Running />} />
        <Route path="/end" element={<End />} />
        <Route path="/how-to-create-modules" element={<HowToModules />} />
        <Route path="/pricing" element={<AuthGate callbackURL="/pricing">{user => <Pricing key={user.id} user={user} />}</AuthGate>} />
        <Route path="/account" element={<AuthGate callbackURL="/account">{user => <Account key={user.id} user={user} />}</AuthGate>} />
        <Route path="/shared/:token" element={<AuthGate>{() => <SharedModule />}</AuthGate>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
