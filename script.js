const inputMinBuildings = document.getElementById("input-min-buildings");
const inputColorHigh = document.getElementById("input-color-high");
const inputColorMedium = document.getElementById("input-color-medium");
const inputColorLow = document.getElementById("input-color-low");
const inputHighThreshold = document.getElementById("input-high-threshold");
const inputMediumThreshold = document.getElementById("input-medium-threshold");
const interactiveInputs = document.querySelectorAll("input.interactive");
const displayMode = document.getElementById("select-display-mode");

const map = L.map("map").setView([43.7, -79.4], 11);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

const getColor = (score) => {
    return score >= inputHighThreshold.value ? inputColorHigh.value :
        score >= inputMediumThreshold.value ? inputColorMedium.value :
            inputColorLow.value;
};

let statsByNeighbourhood = {};
let neighbourhoodGeoJSON = null;
const getMinBuildings = () => parseInt(inputMinBuildings.value) || 0;

// Preload GeoJSONs for later use
// Neighborhoods
fetch("toronto_crs84.geojson")
    .then(res => res.json())
    .then(geo => neighbourhoodGeoJSON = geo);
// Wards
fetch("City_Wards.geojson")
    .then(res => res.json())
    .then(ward => wardGeoJSON = ward);
// Former Municipality Boundaries
fetch("Former_Municipality_Boundaries.geojson")
    .then(res => res.json())
    .then(oldcitybounds => oldcityboundsGeoJSON = oldcitybounds);

// CSV upload and processing
let uploadedFile = null;
let currentLayer = null;

// display mode selection
let currDisplay = displayMode.value;

const processCSV = (file) => {
    switch (currDisplay) {
        case 'individual':
            processByIndividual(file)
            return;
        case 'ward':
            processByWard(file)
            return;
        case 'former-city-boundary':
            processByOldBound(file)
            return;
        case 'neighbourhood':
            break;
        default:
            console.error("Unsupported display mode:", currDisplay);
            return;
    }

    Papa.parse(file, {
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
                if (counts[name] >= getMinBuildings()) {
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
            if (currentLayer) {
                map.removeLayer(currentLayer);
            }

            currentLayer = L.geoJSON(geoData, {
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
                        layer.bindPopup(
                            `<strong>${name}</strong><br>
                Buildings: ${stats.count}<br>
                Mean: ${stats.mean.toFixed(1)}<br>
                Median: ${stats.median.toFixed(1)}<br>
                Std Dev: ${stats.std.toFixed(1)}<br>
                Min: ${stats.min}<br>
                Max: ${stats.max}`
                        );
                    }
                }
            }).addTo(map);
        }
    });
}



const processByWard = (file) => {
    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async function (results) {
            const buildings = results.data.map(row => ({
                ward: parseInt(row["WARD"]),
                score: parseFloat(row["CURRENT BUILDING EVAL SCORE"]),
            }));
            
            const geoData = await fetch("City_Wards.geojson").then(res => res.json());
            const scores = {};
            const counts = {};

            buildings.forEach(b => {
                if (!isNaN(b.score)) {
                    for (const feature of geoData.features) {
                        const ward = parseInt(feature.properties.AREA_SHORT_CODE);
                        if (ward == b.ward) {
                            if (!scores[ward]) scores[ward] = [];
                            scores[ward].push(b.score);
                            counts[ward] = (counts[ward] || 0) + 1;
                            break;
                        }
                    }
                }
            });

            // Compute stats
            statsByWard = {};
            for (let ward in scores) {
                if (counts[ward] >= getMinBuildings()) {
                    const values = scores[ward];
                    const count = values.length;
                    const mean = values.reduce((a, b) => a + b, 0) / count;
                    const std = Math.sqrt(values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / count);
                    const sorted = [...values].sort((a, b) => a - b);
                    const median = count % 2 === 0 ?
                        (sorted[count / 2 - 1] + sorted[count / 2]) / 2 :
                        sorted[Math.floor(count / 2)];
                    const min = sorted[0];
                    const max = sorted[sorted.length - 1];

                    statsByWard[ward] = {
                        count, mean, std, median, min, max
                    };
                }
            }
            console.log(statsByWard)
            // Render filtered wards with stats
            if (currentLayer) {
                map.removeLayer(currentLayer);
            }

            currentLayer = L.geoJSON(geoData, {
                style: function (feature) {
                    const ward = parseInt(feature.properties.AREA_SHORT_CODE);
                    const stats = statsByWard[ward];
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
                    const ward = parseInt(feature.properties.AREA_SHORT_CODE);
                    const stats = statsByWard[ward];
                    if (stats) {
                        layer.bindPopup(
                            `<strong>${name}</strong> ${ward}<br>
                            Buildings: ${stats.count}<br>
                            Mean: ${stats.mean.toFixed(1)}<br>
                            Median: ${stats.median.toFixed(1)}<br>
                            Std Dev: ${stats.std.toFixed(1)}<br>
                            Min: ${stats.min}<br>
                            Max: ${stats.max}`
                        );
                    }
                }
            }).addTo(map);
        }
    });
}



document.getElementById("csvFileInput").addEventListener("change", function (e) {
    uploadedFile = e.target.files[0];
    processCSV(uploadedFile);
});

interactiveInputs.forEach(input => {
    input.addEventListener("input", () => {
        if (uploadedFile) processCSV(uploadedFile);
    });
})

displayMode.addEventListener("change", (e) => { 
    currDisplay = e.target.value;
    if (uploadedFile) {
        processCSV(uploadedFile);
    }
});