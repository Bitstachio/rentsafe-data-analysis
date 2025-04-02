const map = L.map("map").setView([43.7, -79.4], 11);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

fetch("toronto_crs84.geojson")
    .then(res => res.json())
    .then(data => {
        L.geoJSON(data, {
            style: {
                color: "#555",
                weight: 1,
                fillOpacity: 0.1
            },
            onEachFeature: function (feature, layer) {
                const name = feature.properties.AREA_NAME || feature.properties.name;
                layer.bindPopup(`Neighbourhood: ${name}`);
            }
        }).addTo(map);
    });

const getColor = (score) => {
    console.log(score)
    return score >= 90 ? "green" :
        score >= 80 ? "orange" :
            "red";
}

function loadNeighbourhoodMap() {
    fetch('toronto_crs84.geojson')
        .then(res => res.json())
        .then(geoData => {
            L.geoJSON(geoData, {
                style: function (feature) {
                    const name = feature.properties.AREA_NAME;
                    const avgScore = avgScoresByNeighbourhood[name];
                    return {
                        color: '#333',
                        weight: 1,
                        fillColor: getColor(avgScore),
                        fillOpacity: 0.5
                    };
                },
                onEachFeature: function (feature, layer) {
                    const name = feature.properties.AREA_NAME;
                    const avg = avgScoresByNeighbourhood[name];
                    layer.bindPopup(`Neighbourhood: ${name}<br>Average Score: ${avg ? avg.toFixed(1) : 'N/A'}`);
                }
            }).addTo(map);
        });
}

let avgScoresByNeighbourhood = {};
let neighbourhoodGeoJSON = null;

fetch("toronto_crs84.geojson")
    .then(res => res.json())
    .then(geo => neighbourhoodGeoJSON = geo); // save it for later

const thresholdN = 10;
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

            const avgScoresByNeighbourhood = {};

            for (let name in scores) {
                if (counts[name] > thresholdN) {
                    const sum = scores[name].reduce((a, b) => a + b, 0);
                    avgScoresByNeighbourhood[name] = sum / scores[name].length;
                }
            }

            // Render filtered neighbourhoods
            L.geoJSON(geoData, {
                style: function (feature) {
                    const name = feature.properties.AREA_NAME;
                    const avgScore = avgScoresByNeighbourhood[name];
                    return avgScore ? {
                        color: "#333",
                        weight: 1,
                        fillColor: getColor(avgScore),
                        fillOpacity: 0.5
                    } : {
                        fillOpacity: 0 // hide if no score
                    };
                },
                onEachFeature: function (feature, layer) {
                    const name = feature.properties.AREA_NAME;
                    const avg = avgScoresByNeighbourhood[name];
                    if (avg !== undefined) {
                        layer.bindPopup(`Neighbourhood: ${name}<br>Average Score: ${avg.toFixed(1)}`);
                    }
                }
            }).addTo(map);
        }
    });
});
