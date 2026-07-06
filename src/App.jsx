import React, { useState } from 'react';
import sectorsData from './data/sectors.geojson';
import InteractiveMap from './components/InteractiveMap';
import SectorSidebar from './components/SectorSidebar';

function App() {
  const [activeSector, setActiveSector] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter sectors list by name or patron saint (case-insensitive)
  const filteredSectors = sectorsData.features.filter((sector) => {
    const name = sector.properties.name.toLowerCase();
    const patronSaint = sector.properties.patronSaint.toLowerCase();
    const query = searchQuery.toLowerCase();
    return name.includes(query) || patronSaint.includes(query);
  });

  return (
    <div className="app-container">
      <InteractiveMap
        sectorsData={sectorsData}
        activeSector={activeSector}
        onSelectSector={setActiveSector}
      />
      <SectorSidebar
        sectors={filteredSectors}
        activeSector={activeSector}
        onSelectSector={setActiveSector}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
    </div>
  );
}

export default App;
