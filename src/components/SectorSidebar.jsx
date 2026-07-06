import React from 'react';
import { Search } from 'lucide-react';

export default function SectorSidebar({
  sectors,
  activeSector,
  onSelectSector,
  searchQuery,
  onSearchChange
}) {
  return (
    <div className="sidebar-overlay glass-panel">
      <div className="sidebar-header">
        <h1>Mapa Eclesiástico</h1>
        <p>Sectores de Caraballeda</p>
      </div>

      <div className="search-container">
        <Search className="search-icon" size={16} />
        <input
          type="text"
          className="search-input"
          placeholder="Buscar sector o patrono..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className="sectors-list-container">
        {sectors.length === 0 ? (
          <div className="no-results">
            No sectors found matching search query
          </div>
        ) : (
          <ul className="sectors-list">
            {sectors.map((sector) => {
              const isActive = activeSector && activeSector.properties.id === sector.properties.id;
              return (
                <li
                  key={sector.properties.id}
                  className={`sector-item ${isActive ? 'active' : ''}`}
                  onClick={() => onSelectSector(sector)}
                >
                  <span className="sector-item-name">{sector.properties.name}</span>
                  <span className="sector-item-saint">{sector.properties.patronSaint}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
