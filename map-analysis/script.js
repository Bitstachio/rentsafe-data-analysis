const map = L.map("map").setView([43.7, -79.4], 11);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

const getColor = (score) => {
    return score >= 90 ? "green" :
        score >= 80 ? "orange" :
            "red";
};

let statsByNeighbourhood = {};
let neighbourhoodGeoJSON = null;
const thresholdN = 10;

// Preload GeoJSON for later use
fetch("toronto_crs84.geojson")
    .then(res => res.json())
    .then(geo => neighbourhoodGeoJSON = geo);

// CSV upload and processing
document.getElementById("csvFileInput").addEventListener("change", function (e) {
    Papa.parse(e.target.files[0], {
        header: true,
        skipEmptyLines: true,
        complete: async function (results) {
            const buildings = results.data.map(row => ({
                latitude: parseFloat(row["LATITUDE"]),
                longitude: parseFloat(row["LONGITUDE"]),
                score: parseFloat(row["CURRENT BUILDING EVAL SCORE"]),
                address: row["SITE ADDRESS"]
            }));

            const geoData = await fetch("toronto_crs84.geojson").then(res => res.json());
            const scores = {};
            const counts = {};

            buildings.forEach(b => {
                if (!isNaN(b.latitude) && !isNaN(b.longitude) && !isNaN(b.score)) {
                    const point = turf.point([b.longitude, b.latitude]);

                    for (const feature of geoData.features) {
                        const name = feature.properties.AREA_NAME;
                        if (turf.booleanPointInPolygon(point, feature)) {
                            if (!scores[name]) scores[name] = [];
                            scores[name].push(b.score);

                            counts[name] = (counts[name] || 0) + 1;
                            break;
                        }
                    }
                }
            });

            // Compute stats
            statsByNeighbourhood = {};
            for (let name in scores) {
                if (counts[name] > thresholdN) {
                    const values = scores[name];
                    const count = values.length;
                    const mean = values.reduce((a, b) => a + b, 0) / count;
                    const std = Math.sqrt(values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / count);
                    const sorted = [...values].sort((a, b) => a - b);
                    const median = count % 2 === 0 ?
                        (sorted[count / 2 - 1] + sorted[count / 2]) / 2 :
                        sorted[Math.floor(count / 2)];
                    const min = sorted[0];
                    const max = sorted[sorted.length - 1];

                    statsByNeighbourhood[name] = {
                        count, mean, std, median, min, max
                    };
                }
            }

            // Render filtered neighbourhoods with stats
            L.geoJSON(geoData, {
                style: function (feature) {
                    const name = feature.properties.AREA_NAME;
                    const stats = statsByNeighbourhood[name];
                    return stats ? {
                        color: "#333",
                        weight: 1,
                        fillColor: getColor(stats.mean),
                        fillOpacity: 0.5
                    } : {
                        fillOpacity: 0
                    };
                },
                onEachFeature: function (feature, layer) {
                    const name = feature.properties.AREA_NAME;
                    const stats = statsByNeighbourhood[name];
                    if (stats) {
                        layer.bindPopup(`
                            <strong>${name}</strong><br>
                            Buildings: ${stats.count}<br>
                            Mean: ${stats.mean.toFixed(1)}<br>
                            Median: ${stats.median.toFixed(1)}<br>
                            Std Dev: ${stats.std.toFixed(1)}<br>
                            Min: ${stats.min}<br>
                            Max: ${stats.max}
                        `);
                    }
                }
            }).addTo(map);
        }
    });
});
