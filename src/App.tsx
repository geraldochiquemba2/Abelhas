import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import { Insights } from './pages/Insights';
import { MapPage } from './pages/Map';
import { Thermal } from './pages/Thermal';
import { HistoryPage } from './pages/History';

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/insights" element={<Insights />} />
                <Route path="/dashboard" element={<Insights />} /> {/* Link to primary dashboard view */}
                <Route path="/map" element={<MapPage />} />
                <Route path="/thermal" element={<Thermal />} />
                <Route path="/history" element={<HistoryPage />} />
                <Route path="/login" element={<Home />} /> {/* Temporary redirects to home */}
                <Route path="/signup" element={<Home />} />
            </Routes>
        </Router>
    );
}

export default App;
