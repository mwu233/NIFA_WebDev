import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';

function MapController({ center, zoom }) {
    const map = useMap();

    useEffect(() => {
        if (map) {
            map.setView(center, zoom);
        }
    }, [center, zoom, map]);

    return null;
}

function CropYieldMap() {
    const [statesData, setStatesData] = useState(null);
    const [countyBoundaries, setCountyBoundaries] = useState(null);
    const [mapCenter, setMapCenter] = useState([43, -93]);
    const [mapZoom, setMapZoom] = useState(5.5);

    useEffect(() => {
        // Fetch data
        Promise.all([
            fetch("../data/gz_2010_us_040_00_20m.json").then(res => res.json()),
            fetch("../data/gz_2010_us_050_00_20m.json").then(res => res.json())
        ]).then(([states, counties]) => {
            setStatesData(states);
            setCountyBoundaries(counties);
        }).catch(error => console.error("Error fetching data:", error));
    }, []);

    return (
        <MapContainer center={mapCenter} zoom={mapZoom} style={{ height: '100vh', width: '100%' }}>
            <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
            />
            <MapController center={mapCenter} zoom={mapZoom} />
            {statesData && (
                <GeoJSON
                    data={statesData}
                    style={{
                        weight: 3,
                        fill: false,
                        color: 'grey',
                        dashArray: '3',
                    }}
                />
            )}
            {countyBoundaries && (
                <GeoJSON
                    data={countyBoundaries}
                    style={{
                        weight: 1,
                        fill: false,
                        color: 'gray',
                        dashArray: '3',
                    }}
                />
            )}
        </MapContainer>
    );
}

export default CropYieldMap;