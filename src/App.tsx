import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import { MapPage } from './pages/Map';
import Thermal from './pages/Thermal';
import { HistoryPage } from './pages/History';

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/insights" element={<Home />} />
                <Route path="/dashboard" element={<Home />} />
                <Route path="/map" element={<MapPage />} />
                <Route path="/thermal" element={<Thermal />} />
                <Route path="/history" element={<HistoryPage />} />
                <Route path="/login" element={<Home />} />
                <Route path="/signup" element={<Home />} />
            </Routes>
        </Router>
    );
}

export default App;
