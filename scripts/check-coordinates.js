import fs from 'fs';
import path from 'path';

const geojsonPath = path.resolve('src/data/sectors.geojson');

function checkCoordinates() {
  console.log(`Loading GeoJSON from: ${geojsonPath}`);
  if (!fs.existsSync(geojsonPath)) {
    console.error('Error: sectors.geojson not found!');
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(geojsonPath, 'utf8'));
  let hasErrors = false;

  console.log('\n--- Checking Latitude Limits ---');
  data.features.forEach((feature) => {
    const name = feature.properties.name;
    const coordinates = feature.geometry.coordinates[0]; // Assuming Polygon (single ring)

    coordinates.forEach(([lng, lat]) => {
      // Check absolute maximum
      if (lat > 10.627) {
        console.error(`[ERROR] ${name}: Coordinate [${lng}, ${lat}] exceeds spec coastline limit (10.627)`);
        hasErrors = true;
      }
      if (lat > 10.623) {
        console.error(`[ERROR] ${name}: Coordinate [${lng}, ${lat}] exceeds user coastline limit (10.623)`);
        hasErrors = true;
      }

      // Center vs Sides checks
      const isCenter = lng >= -66.855 && lng <= -66.845;
      if (isCenter) {
        if (lat > 10.618) {
          console.error(`[ERROR] ${name}: Center coordinate [${lng}, ${lat}] exceeds center limit (10.618)`);
          hasErrors = true;
        }
      } else {
        if (lat > 10.615) {
          console.error(`[ERROR] ${name}: Side coordinate [${lng}, ${lat}] exceeds side limit (10.615)`);
          hasErrors = true;
        }
      }
    });
  });

  console.log('\n--- Checking Shared Vertices & Topology ---');
  // Helper to serialize a point
  const serializePoint = (p) => `${p[0].toFixed(6)},${p[1].toFixed(6)}`;

  // Helper to serialize an edge (normalized direction)
  const serializeEdge = (p1, p2) => {
    const s1 = serializePoint(p1);
    const s2 = serializePoint(p2);
    return s1 < s2 ? `${s1} -> ${s2}` : `${s2} -> ${s1}`;
  };

  const edgeCount = {};
  const edgeSectors = {};

  data.features.forEach((feature) => {
    const name = feature.properties.name;
    const coordinates = feature.geometry.coordinates[0];

    for (let i = 0; i < coordinates.length - 1; i++) {
      const p1 = coordinates[i];
      const p2 = coordinates[i + 1];
      const edgeKey = serializeEdge(p1, p2);

      edgeCount[edgeKey] = (edgeCount[edgeKey] || 0) + 1;
      if (!edgeSectors[edgeKey]) {
        edgeSectors[edgeKey] = [];
      }
      edgeSectors[edgeKey].push(name);
    }
  });

  // Find overlapping or mismatching edges
  let sharedCount = 0;
  let boundaryCount = 0;
  Object.entries(edgeCount).forEach(([edgeKey, count]) => {
    if (count > 2) {
      console.error(`[ERROR] Edge [${edgeKey}] is shared by more than 2 sectors: ${edgeSectors[edgeKey].join(', ')}`);
      hasErrors = true;
    } else if (count === 2) {
      sharedCount++;
    } else {
      boundaryCount++;
    }
  });

  console.log(`Verified ${Object.keys(edgeCount).length} unique edges:`);
  console.log(`- Shared internal boundaries: ${sharedCount}`);
  console.log(`- External boundaries: ${boundaryCount}`);

  // Check for near-duplicate vertices (potential topological gaps or slivers)
  const allPoints = [];
  data.features.forEach((feature) => {
    const name = feature.properties.name;
    const coordinates = feature.geometry.coordinates[0];
    coordinates.forEach(([lng, lat]) => {
      allPoints.push({ name, lng, lat });
    });
  });

  let nearMatches = 0;
  for (let i = 0; i < allPoints.length; i++) {
    for (let j = i + 1; j < allPoints.length; j++) {
      const p1 = allPoints[i];
      const p2 = allPoints[j];
      if (p1.name !== p2.name) {
        const distLng = Math.abs(p1.lng - p2.lng);
        const distLat = Math.abs(p1.lat - p2.lat);
        if (distLng < 0.0002 && distLat < 0.0002 && (distLng > 0 || distLat > 0)) {
          // They are very close but not identical
          console.warn(`[WARNING] Close but mismatched vertices between ${p1.name} and ${p2.name}: [${p1.lng}, ${p1.lat}] vs [${p2.lng}, ${p2.lat}]`);
          nearMatches++;
        }
      }
    }
  }

  if (nearMatches > 0) {
    console.log(`Found ${nearMatches} warning(s) of close but mismatched vertices.`);
  }

  if (hasErrors) {
    console.error('\n[RESULT] Validation FAILED!');
    process.exit(1);
  } else {
    console.log('\n[RESULT] Validation PASSED successfully.');
  }
}

checkCoordinates();
