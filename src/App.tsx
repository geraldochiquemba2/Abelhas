import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import { Insights } from './pages/Insights';
import { MapPage } from './pages/Map';
import Thermal from './pages/Thermal';
import { HistoryPage } from './pages/History';
import { AlertsPage } from './pages/Alerts';
import { ActivityPage } from './pages/Activity';
import { BeeRadarPage } from './pages/BeeRadarPage';

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/insights" element={<Insights />} />
                <Route path="/dashboard" element={<Insights />} />
                <Route path="/activity" element={<ActivityPage />} />
                <Route path="/bee-radar" element={<BeeRadarPage />} />
                <Route path="/map" element={<MapPage />} />
                <Route path="/thermal" element={<Thermal />} />
                <Route path="/history" element={<HistoryPage />} />
                <Route path="/alerts" element={<AlertsPage />} />
                <Route path="/login" element={<Home />} />
                <Route path="/signup" element={<Home />} />
            </Routes>
        </Router>
    );
}

export default App;
