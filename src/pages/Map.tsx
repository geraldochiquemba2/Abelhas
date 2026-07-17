import React, { useEffect, useRef } from 'react';
import { Layout } from '../components/Layout';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export const MapPage: React.FC = () => {
    const mapRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!mapRef.current) return;

        const map = L.map(mapRef.current, {
            center: [-11.2, 17.9],
            zoom: 7,
            scrollWheelZoom: true,
        });

        L.tileLayer(
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            { maxZoom: 19, attribution: 'Tiles &copy; Esri' }
        ).addTo(map);

        L.tileLayer(
            'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
            { maxZoom: 19, attribution: '' }
        ).addTo(map);

        return () => {
            map.remove();
        };
    }, []);

    return (
        <Layout>
            <div className="flex items-center gap-4 sm:gap-6 mb-6 sm:mb-12">
                <div>
                    <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-slate-900 leading-tight">
                        Mapa <span className="text-primary-dark">Global</span>
                    </h1>
                    <p className="text-slate-700 font-medium text-base sm:text-lg">Localização em tempo real das colmeias monitoradas.</p>
                </div>
            </div>
            <div className="glass-card rounded-2xl lg:rounded-[3rem] p-4 sm:p-8 h-[400px] sm:h-[500px] lg:h-[600px] overflow-hidden">
                <div ref={mapRef} className="w-full h-full rounded-2xl z-0" />
            </div>
        </Layout>
    );
};
