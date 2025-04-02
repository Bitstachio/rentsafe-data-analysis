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
    return score >= 95 ? "green" :
        score >= 85 ? "orange" :
            "red";
}

document.getElementById("csvFileInput").addEventListener("change", function (e) {
    Papa.parse(e.target.files[0], {
        header: true,
        skipEmptyLines: true,
        complete: function (results) {
            const buildings = results.data.map(row => ({
                latitude: parseFloat(row["LATITUDE"]),
                longitude: parseFloat(row["LONGITUDE"]),
                score: parseInt(row["CURRENT BUILDING EVAL SCORE"]),
                address: row["SITE ADDRESS"]
            }));

            buildings.forEach(b => {
                if (!isNaN(b.latitude) && !isNaN(b.longitude) && !isNaN(b.score)) {
                    L.circleMarker([b.latitude, b.longitude], {
                        radius: 6,
                        fillColor: getColor(b.score),
                        color: "#000",
                        weight: 1,
                        fillOpacity: 0.8
                    }).bindPopup(`Address: ${b.address}<br>Score: ${b.score}`)
                        .addTo(map);
                }
            });
        }
    });
});
