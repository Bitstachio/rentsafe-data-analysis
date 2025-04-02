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

document.getElementById("csvFileInput").addEventListener("change", function (e) {
    Papa.parse(e.target.files[0], {
        header: true,
        skipEmptyLines: true,
        complete: function (results) {
            const scores = {};

            results.data.forEach(row => {
                const lat = parseFloat(row['LATITUDE']);
                const lon = parseFloat(row['LONGITUDE']);
                const score = parseFloat(row['CURRENT BUILDING EVAL SCORE']);

                if (!isNaN(lat) && !isNaN(lon) && !isNaN(score)) {
                    const point = turf.point([lon, lat]);

                    for (const feature of neighbourhoodGeoJSON.features) {
                        if (turf.booleanPointInPolygon(point, feature)) {
                            const name = feature.properties.AREA_NAME;

                            if (!scores[name]) scores[name] = [];
                            scores[name].push(score);
                            break;
                        }
                    }
                }
            });

            // Calculate averages
            for (let name in scores) {
                const sum = scores[name].reduce((a, b) => a + b, 0);
                avgScoresByNeighbourhood[name] = sum / scores[name].length;
            }

            loadNeighbourhoodMap();
        }
    });
});
