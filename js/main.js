// Javascripts by Meiliu Wu, 2022

/* Map of GeoJSON data from crop_2021.geojson */

var curLayer;
var curMap;
var curResponse;
var curAttrs;
var curTileLayer;

var curLocation;
var curCrop;
var curYear;
var curMonth;
var curProperty;
var currentBaseMap = "OpenStreetMap";

let curFIPS;
let stateRange;
let curColorScale;
var defaultStartColor = "#ebf8b3";
var defaultEndColor = "#074359";
var customStartColor = defaultStartColor;
var customEndColor = defaultEndColor;
let statesData; //State boundaries

var curInfoVisible = true;


/**
 * Load all data needed for the application initialization.
 * @returns {Promise<{countyBoundaries: any, averagePred: [], statesData: any}>}
 */
const CACHE_VERSION = 2; // Increment this when your data structure changes

async function loadAllData() {
    try {
        // const cachedData = localStorage.getItem('mapDataCache');
        // if (cachedData) {
        //     const parsedCache = JSON.parse(cachedData);
        //     if (parsedCache.version === CACHE_VERSION) {
        //         console.log("Using cached data");
        //         return parsedCache.data;
        //     }
        // }

        console.log("Fetching fresh data");
        const [statesResponse, countiesResponse, averagePredResponse,cornYieldResponse] = await Promise.all([
            fetch("data/gz_2010_us_040_00_20m.json"),
            fetch("data/gz_2010_us_050_00_20m.json"),
            fetch("data/average_pred.csv"),
            fetch("data/corn_yield_US.csv"),
        ]);

        const statesData = await statesResponse.json();
        const countyBoundaries = await countiesResponse.json();
        const averagePredText = await averagePredResponse.text();
        const averagePred = d3.csvParse(averagePredText);
        const cornYieldText = await cornYieldResponse.text();
        const allCornYieldData = d3.csvParse(cornYieldText)

        const data = { statesData, countyBoundaries, averagePred, allCornYieldData };

        // Cache the data
        // localStorage.setItem('mapDataCache', JSON.stringify({
        //     version: CACHE_VERSION,
        //     timestamp: new Date().getTime(),
        //     data: data
        // }));

        return data;
    } catch (error) {
        console.error("Error loading data:", error);
        throw error;
    }
}

var curDate = {
    "0": "05/13",
    "1": "05/29",
    "2": "06/14",
    "3": "06/30",
    "4": "07/16",
    "5": "08/01",
    "6": "08/17",
    "7": "09/02",
    "8": "09/18",
    "9": "10/04"
}

let avePred;
let drawControl;
let drawnFeatures = new L.FeatureGroup();
let drawnFeaturesDict = {};
let markerDrawHandler;
function DrawnFeature(id,layer,type,intersectCounty,intersectFIPS){
    this.id = id;
    this.layer = layer;
    this.type = type;
    this.intersectCounty = intersectCounty;
    this.intersectFIPS = intersectFIPS;
}

let cornYieldData;
//function to instantiate the Leaflet map
async function createMap(){

    const data = await loadAllData();
    console.log("Data loaded:", data);
    cornYieldData = data.allCornYieldData;
    //create the map
    var map = L.map('map', {
        center: [43,-93],
        zoom: 5.5,
        zoomDelta: 0.5,
        zoomSnap: 0,
        zoomControl: false,
        maxBounds: [[20,-130],[52,-60]],
        maxBoundsViscosity: 1.0,
        // preferCanvas: true
        inertia: true,
        inertiaDeceleration: 3000,
    });

    map.doubleClickZoom.disable();

    curMap = map;

    // zoomControl = L.control.zoom({
    //     position: 'topright'
    //
    // }).addTo(map);
    //add OSM base tilelayer
    curTileLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
    })
    curTileLayer.addTo(curMap);

    const scaleControl = L.control.scale()
        .setPosition('bottomright')
        .addTo(map);

    curCrop = 'corn'; // or 'soybean'
    curYear = '2021'; // 2010-2021
    curMonth = '0'; // 0-9
    curProperty = 'pred'; // or 'yield', 'error'- color scheme should be different
    curLocation = '';

    // Use the loaded data

    statesData = data.statesData;
    countyBoundaries = data.countyBoundaries;
    avePred = data.averagePred;

    //call getData function
    getData(curMap, curCrop, curYear, curMonth, curLocation);


// Add custom zoom controls
    var zoomInBtn = document.getElementById('zoomInBtn');
    var zoomOutBtn = document.getElementById('zoomOutBtn');

    zoomInBtn.addEventListener('click', function(e) {
        e.preventDefault();
        curMap.zoomIn();
    });

    zoomOutBtn.addEventListener('click', function(e) {
        e.preventDefault();
        curMap.zoomOut();
    });

// Update zoom buttons state based on current zoom level
    function updateZoomButtonsState() {
        zoomInBtn.classList.toggle('disabled', curMap.getZoom() === curMap.getMaxZoom());
        zoomOutBtn.classList.toggle('disabled', curMap.getZoom() === curMap.getMinZoom());
    }

    curMap.on('zoomend', updateZoomButtonsState);
    updateZoomButtonsState();  // Initial state update

    // leaflet draw control
    map.addLayer(drawnFeatures);
    L.EditToolbar.Delete.include({
        removeAllLayers: true
    });
    drawControl = new L.Control.Draw({
        edit: {
            featureGroup: drawnFeatures,
            remove: true},
        position: 'bottomright',
        draw: {
            polygon: {
                shapeOptions: {
                    color: 'purple'
                },
                //  allowIntersection: false,
                //  drawError: {
                //   color: 'orange',
                //   timeout: 1000
                //  },
            },
            polyline: {
                shapeOptions: {
                    color: 'red'
                },
            },
            rect: {
                shapeOptions: {
                    color: 'green'
                },
            },
            // circle: {
            //     shapeOptions: {
            //         color: 'steelblue'
            //     },
            // },
        },
    });
    map.addControl(drawControl);
    // console.log("drawControl");

    markerDrawHandler = new L.Draw.Marker(map, drawControl.options.draw.marker);

    // Add click event listener to the Add Marker button
    document.getElementById('addMarkerBtn').addEventListener('click', function() {
        // If marker mode is already active, disable it
        if (markerDrawHandler.enabled()) {
            markerDrawHandler.disable();
        } else {
            // Enable marker placement mode
            markerDrawHandler.enable();
        }
    });

    map.on('draw:created', function (e) {
        if (drawFlag === 'run') {
            removeAllDrawn();
        }

        var type = e.layerType;
        var layer = e.layer;
        // console.log(type);
        drawnFeatures.addLayer(layer);
        // $("#drawnFeaturesList").append("<li>Drawn Feature</li>");

        let drawnPolygon = layer.toGeoJSON(); // not necessarily polygon
        let intersectCounty = [];
        let intersectFIPS = [];
        // Iterate over the GeoJSON polygon layers
        curLayer.eachLayer(function (layer) {

            if(turf.booleanIntersects(layer.toGeoJSON(), drawnPolygon)){
                highlightHelper(layer,'#68da4c','layer')
              intersectCounty.push(layer.feature.properties.NAMELSAD);
              intersectFIPS.push(layer.feature.properties.FIPS);
            }
        })
        drawnFeaturesDict[layer._leaflet_id] = new DrawnFeature(layer._leaflet_id,layer,type,intersectCounty,intersectFIPS);
        updateDrawnFeaturesDict()
    });

    map.on('draw:edit', function (e) {
        updateDrawnFeaturesDict()
    });

    map.on('draw:deleted', function (e) {
        // layer groups
        let removedIDs = []
        e.layers.eachLayer( (layer)=>removedIDs.push(layer._leaflet_id) );
        removedIDs.forEach(id=>delete drawnFeaturesDict[id]);
        drawnFeatures.removeLayer(e.layers);
        updateDrawnFeaturesDict()
    })
}

// Call createMap when the document is ready
document.addEventListener('DOMContentLoaded', createMap);

function removeAllDrawn(){
    drawnFeatures.clearLayers();
    drawnFeaturesDict = {};
    document.getElementById("drawnFeaturesList").innerHTML = "";
    document.getElementById("modelDrawnFeatures").innerHTML = "";
    updateDrawnFeaturesDict()
}

function updateDrawnFeaturesDict(){

    function upperInitial(str) {if (str.length === 0) {return str;} const firstChar = str.charAt(0).toUpperCase();const restOfString = str.slice(1);return firstChar + restOfString;}
    num = 1;
    $("#drawnFeaturesList").empty();
    $("#modelDrawnFeatures").empty();

    for (const [key, value] of Object.entries(drawnFeaturesDict)) {
        let msg = "<li>" +num+". "+ upperInitial(value.type) +"     <button onclick='fitBoundsByID("+key.toString()+")'"  +">GO</button>"  +"</li>";
        msg+= "<ul>";
        msg += "Selected Counties: ";
        msg += value.intersectCounty.join(", ");
        $("#drawnFeaturesList").append(msg);
        document.getElementById("modelDrawnFeatures").innerHTML = "<h3 style=\"margin-bottom:0px;margin-top: 15px;margin-left: 0px;\">\n" +
            "                        Selected Counties:\n" +
            "                    </h3>"+ value.intersectCounty.join(", ");
        msg = "<button onclick='downloadByDrawnFeature("+key.toString()+")'"  +">Download</button>";
        $("#drawnFeaturesList").append(msg);
        num++;
    }

}

function downloadByDrawnFeature(id){
    FIPS = drawnFeaturesDict[id].intersectFIPS;
    if(FIPS.length === 0){
        alert("No county selected");
        return;
    }
    let data = curResponse.features.filter(d=>FIPS.includes(d.properties.FIPS));

    let t = data.map(d=>
        d={NAME:d.properties.NAME,
            FIPS:d.properties.FIPS,
            YIELD:d.properties.yield,
            PREDICTION:d.properties.pred,
            ERROR:d.properties.error})
    let csvRows = [];
    const headers = Object.keys(t[0]);
    csvRows.push(headers.join(','));
    for (const row of t) {
        const values = headers.map(e => {
            return row[e]
        })
        csvRows.push(values.join(','))
    }
    csvRows = csvRows.join('\n')

    blob = new Blob([csvRows], { type: 'text/csv' });
    url = window.URL.createObjectURL(blob)
    var link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "prediction_"+curCrop+"_"+curYear+"_"+curMonth+".csv");
    document.body.appendChild(link); // Required for FF

    link.click();
    link.remove();

}

function fitBoundsByID(id){
    layer = drawnFeatures.getLayer(id)
    curMap.fitBounds(layer.getBounds())
}

function changeBaseMap(selectedBaseMap) {
    if (selectedBaseMap === undefined) {
    selectedBaseMap=$('#basemapInput').val()
    }

    if (curTileLayer) {
        curMap.removeLayer(curTileLayer);
    }

    var basemaps = {
        'OpenStreetMap': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap contributors'
        }),
        'CartoDB Positron': L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© CartoDB'
        }),
        'Esri WorldTerrain': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Terrain_Base/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles &copy; Esri &mdash; Source: USGS, Esri, TANA, DeLorme, and NPS',
            maxZoom: 13
        }),
        'Esri WorldShadedRelief': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles &copy; Esri &mdash; Source: Esri',
            maxZoom: 13
        }),
        'Esri NatGeoWorldMap': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles &copy; Esri &mdash; National Geographic, Esri, DeLorme, NAVTEQ, UNEP-WCMC, USGS, NASA, ESA, METI, NRCAN, GEBCO, NOAA, iPC',
            maxZoom: 16
        }),
        'USGS USTopo': L.tileLayer('https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 20,
            attribution: 'Tiles courtesy of the <a href="https://usgs.gov/">U.S. Geological Survey</a>'
        })
    };

    curTileLayer = basemaps[selectedBaseMap];
    curTileLayer.addTo(curMap);
}

//function to retrieve the data and place it on the map
function getData(map, crop, year, month, location){
    //load the data
    // var jsonPath = "data/" + crop + "/" + year + "/" + month + ".json";
    var jsonPath = `data/${crop}/${year}/${month}.json`;

    fetch(jsonPath)
        .then(response => response.json())
        .then(response => {
            // Create an attributes array
            var attributes = processData(response);

            // Update global variables
            curAttrs = attributes;
            curResponse = response;

            stateRange = {}
            curResponse.features.forEach(a=>{
                let temp = a.properties.FIPS.toString();
                if (temp.length=== 4) {
                    temp = '0'+ temp;
                }
                temp = temp.slice(0,2);

                stateRange[temp] = stateFIPS[temp];
                a.properties.STATE = stateFIPS[temp];
            })

            if (curProperty === "pred") {
                curColorScale = d3.scaleLinear()
                    .domain([d3.min(curResponse.features, function(d) { return d.properties.pred; }),
                        d3.max(curResponse.features, function(d) { return d.properties.pred; })])
                    .range([customStartColor, customEndColor]);
            } else if (curProperty === "yield") {
                curColorScale = d3.scaleLinear()
                    .domain([d3.min(curResponse.features, function(d) { return d.properties.yield; }),
                        d3.max(curResponse.features, function(d) { return d.properties.yield; })])
                    .range([customStartColor, customEndColor]);
            } else if (curProperty === "error") {
                var errorExtent = d3.extent(curResponse.features, function(d) { return d.properties.error; });
                var maxAbsError = Math.max(Math.abs(errorExtent[0]), Math.abs(errorExtent[1]));
                curColorScale = d3.scaleLinear()
                    .domain([-maxAbsError, 0, maxAbsError])
                    .range([customStartColor, "#FFFFFF", customEndColor]);
            }

            populateDropdowns();

            updateTable();

            curLayer = createChoropleth(response, map, attributes, 0);
            map.addLayer(curLayer);

            // Use the loaded state and county data
            L.geoJson(countyBoundaries, {
                'type': 'Feature',
                style: {
                    weight: 1,
                    fill: false,
                    color: 'gray',
                    dashArray: '3',
                }
            }).addTo(curMap);

            L.geoJson(statesData, {
                'type': 'Feature',
                style: {
                    weight: 3,
                    fill: false,
                    color: 'grey',
                    dashArray: '3',
                }
            }).addTo(curMap);

            // update map extent
            if (location != '') {
                // update map extent
                curLayer.eachLayer(function (layer) {
                    if (layer.feature.properties.NAMELSAD === location) {
                        // Zoom to that layer.
                        map.fitBounds(layer.getBounds());
                    }
                });
            } else {
                map.setView({lat:43, lng:-93}, 5.5)
            }

            // create control
            createHoverControl(response, map, attributes);

            createLegend(map); // legend
            createSideMenu(map);
            createMenu(map); // top menu

        })
        .catch(error => {
            console.error("Error fetching data:", error);
            // Handle the error appropriately
        });

}

function processData(data){
    //empty array to hold attributes
    //var attrs = [];

    //properties of the first feature in the dataset
    var properties = data.features[0].properties;

    return properties;
}

function createChoropleth(data, map, attrs, idx){
    // remove current layer if exists
    if (curLayer){
        map.removeLayer(curLayer);
    }

    document.getElementById("userTitle").value = curCrop.charAt(0).toUpperCase() + curCrop.slice(1) + " "
        + (curProperty==="pred"?"Prediction":curProperty==="yield"?"Yield":"Error") + " for US in "  + curYear;

    var geoJsonLayer = L.geoJson(data, {
        style: style,
        onEachFeature: onEachFeature
    });

    return geoJsonLayer;
}


function waitForElement(){
    if(typeof curMap !== "undefined"){
        // Debounce the moveend event
        let moveEndTimeout;
        curMap.on('moveend', function() {
            clearTimeout(moveEndTimeout);
            moveEndTimeout = setTimeout(function() {
                // Only perform necessary operations here
                // For example, update some UI based on new bounds
                let bounds = curMap.getBounds();
                // Use the bounds to update something...
            }, 1000); // Wait for 250ms of inactivity before running
        });
    }
    else{
        setTimeout(waitForElement, 1000);
    }
}
waitForElement()


// color scheme referring https://leafletjs.com/examples/choropleth/
function getColor(d) {
    return curColorScale(d);
}

function style(feature) {
    return {
        fillColor: getColor(feature.properties[curProperty]),
        weight: 0,
        opacity: 1,
        color: 'white',
        dashArray: '3',
        fillOpacity: parseFloat(document.getElementById("choroplethOpacity").value)
    };
}


let curMouserOverFIPS = null;
let lastUpdatedFIPS = null;
let highlightedLayers = new Set();
function resetAllHighlight(){
    if (highlightedLayers.size > 0) {
        highlightedLayers.forEach(layer => {
            curLayer.resetStyle(layer)
        })
        highlightedLayers.clear();
    }
}

// TODO : Fix curInfo Bug
function highlightHelper(e,color='#68da4c',type='e') {
    var layer;
    if (type ==='layer'){
        layer = e;
    } else if (type === 'e'){
        layer = e.target;
    } else if (type === 'FIPS'){

        layer = curLayer.getLayers().filter(d=>{
            if (d.hasOwnProperty('feature') && d.feature.hasOwnProperty('properties') && d.feature.properties.hasOwnProperty('FIPS')) {
            return d.feature.properties.FIPS === e} else {return false}
        })[0]
    }

    curMouserOverFIPS = layer.feature.properties.FIPS;
    layer.setStyle({
        weight: 5,
        color: color==="default"?'#666':color,
        dashArray: '',
        fillOpacity: 0.7
    });

    layer.bringToFront();

    if(highlightedLayers.size>0 && color==='default'){return} //default color means not clicked
    var content = '<h4>Crop Yield Information</h4>' +
                '<b>' + layer.feature.properties.NAMELSAD + '</b><br />' +
                'Crop type: ' + curCrop + '<br />' +
                'Date: ' + curDate[curMonth] + "/" + curYear + '<br />' +
                'Yield: ' + Number(layer.feature.properties.yield).toFixed(2) + ' unit / mi<sup>2</sup><br />' +
                'Prediction: ' + Number(layer.feature.properties.pred).toFixed(2) + ' unit / mi<sup>2</sup><br />' +
                'Error: ' + Number(layer.feature.properties.error).toFixed(2) + ' unit / mi<sup>2</sup>';
    if(highlightedLayers.size===0||color!=='default') {
        // if(type==='e') {
            debouncedDelayedUpdateTemporalInfo(content);
        // } else {
        //     console.log("over")
        //     updateTemporalInfo(content);
        // }
    }
    d3.select("#temporal-info").selectAll("svg").remove();
    debouncedDelayedScatterGen("temporal-info",layer.feature.properties.FIPS,'append')
}

function highlightFeature(e,type='e') {
    if(doubleClicked) return
    if(highlightedLayers.has(e.target)) return;
    highlightHelper(e)
}

function resetHighlight(e,type='e') {
    if(doubleClicked) return

    let layer;
    if (type ==='e'){
        layer = e.target;
    } if (type==='FIPS'){
        layer = curLayer.getLayers().filter(d=>{
            if (d.hasOwnProperty('feature') && d.feature.hasOwnProperty('properties') && d.feature.properties.hasOwnProperty('FIPS')) {
                return d.feature.properties.FIPS === e
            } else {return false}
        })[0]
    }

    if (highlightedLayers.has(layer)) return;
    curLayer.resetStyle(layer);
    layer.bringToBack()
    var content = "<h4>Crop Yield Information</h4>" + "Hover over a county";

    if(highlightedLayers.size>0) return;
    // updateTemporalInfo(content);
    debouncedDelayedUpdateTemporalInfo(content);
}

// too large, use zoomToState instead
function zoomToFeature(e) {
    curMap.fitBounds(e.target.getBounds());
    updateClicked(e);
}

function zoomToState(e) {
    setTimeout(function() {
        if(highlightedLayers.has(e.target)){
            highlightedLayers.delete(e.target)
            resetHighlight(e)
            if(ctrlKeyDown){
                multiChoice = multiChoice.filter(d=>d!==e.target.feature.properties.FIPS)
            }
            return
        }

        if (ctrlKeyDown) {
            highlightHelper(e, '#68da4c')
            highlightedLayers.add(e.target)
        } else {
            resetAllHighlight()
            highlightedLayers.add(e.target)
            highlightHelper(e, '#68da4c')
        }
        if (!doubleClicked){
            updateClicked(e,true)
        } else {
            updateClicked(e,false)
        }
    },300)
}

function updateClicked(e,fitBounds=true){

    curLocation = e.target.feature.properties.NAMELSAD;
    curFIPS = e.target.feature.properties.FIPS;
    document.getElementById("plotCountyIn")
        .setAttribute('value',curLocation)
    let tempfips = String(e.target.feature.properties.FIPS)
    if(ctrlKeyDown) multiChoice.push(tempfips)
    else {multiChoice = [];multiChoice.push(tempfips)}
    tempfips = tempfips.length===4?"0"+tempfips[0]:tempfips.slice(0,2)

    let feature = statesData.features.filter(d=>d.properties.STATE===tempfips)
    let bounds = L.geoJSON(feature).getBounds()
    if(fitBounds)curMap.fitBounds(bounds)

    let options = '<option value="'+tempfips+'">'+stateFIPS[tempfips]+'</option>'
    // $("#plotStateIn").html(options)
    // console.log(multiChoice)
    if(multiChoice.length>1){
        plotFunc('update')
    }else{
        plotFunc()
    }

}

let ctrlKeyDown = false;
let multiChoice = [];

function handleKeyDown(event) {
    if(event.key === "Control") {
        ctrlKeyDown = true;
    }
}

function handleKeyUp(event) {
    if(event.key === "Control") {
        ctrlKeyDown = false;
    }
}

let listenersAdded = false;

function addControlKeyListeners() {
    if (!listenersAdded) {
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('keyup', handleKeyUp);
        listenersAdded = true;
    }
}

function removeControlKeyListeners() {
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('keyup', handleKeyUp);
}

// Add listeners when needed
addControlKeyListeners();

// Debounce function
function debounce(func, wait, immediate) {
    let timeout;
    return function() {
        const context = this, args = arguments;
        const later = function() {
            timeout = null;
            if (!immediate) func.apply(context, args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(context, args);
    };
}

function debouncedDelay(func, wait, delay) {
    let timeout;
    let delayTimeout;
    return function() {
        const context = this;
        const args = arguments;
        const later = function() {
            timeout = null;
            delayTimeout = setTimeout(() => {
                func.apply(context, args);
            }, delay);
        };
        clearTimeout(timeout);
        clearTimeout(delayTimeout);
        timeout = setTimeout(later, wait);
    };
}


let doubleClicked = false;
document.addEventListener('dblclick', function(event) {
    doubleClicked = !doubleClicked;

})
function onEachFeature(feature, layer) {
    layer.on({
        mouseover: highlightFeature,
        mouseout: resetHighlight,
        click: zoomToState,
    });
}

var curInfo;
var curLegend;

var curInfoAdded = false;
function createHoverControl(response, map, attrs){
    const info = L.control();

    info.onAdd = function (map) {
        curInfoAdded = true;
        const container = L.DomUtil.create('div', 'info');
        $(container).append('<div id="temporal-info">');
        const content = "<h4>Crop Yield Information</h4>" + "Hover over a county";
        $(container).find('#temporal-info').html(content);
        return container;
    };

    info.onRemove = function(map) {
        curInfoAdded = false;
    }

    curInfo = info;

    curInfo.addTo(map);
    makeDraggable(curInfo)

}

function toggleInfo() {
    if (curInfoAdded){
        curInfo.remove();
    } else {
        curInfo.addTo(curMap);
        makeDraggable(curInfo)
    }
}

function updateTemporalInfo(content, update=false){
        $('#temporal-info').html(content);
}

const debouncedDelayedUpdateTemporalInfo = debouncedDelay(function(content) {
        $('#temporal-info').html(content);
}, 100, 500); // 100ms debounce, 500ms delay

function createLegend(map){
    var legend = L.control({position: 'bottomleft'});

    legend.onAdd = function (map) {

        var div = L.DomUtil.create('div', 'info legend');

        div.innerHTML = ''; // Clear existing content

        // Set the title based on the current property
        let title = '';
        if (curProperty === "pred") {
            title = "Crop Prediction";
        } else if (curProperty === "yield") {
            title = "Crop Yield";
        } else if (curProperty === "error") {
            title = "Crop Prediction Errors";
        }

        div.innerHTML += `<strong>${title}</strong><br>`;

        // Create SVG for the gradient legend
        const svgWidth = 120;
        const svgHeight = 12;
        const svg = d3.create("svg")
            .attr("width", svgWidth)
            .attr("height", svgHeight);

        // Create gradient
        const gradient = svg.append("defs")
            .append("linearGradient")
            .attr("id", "legend-gradient")
            .attr("x1", "0%")
            .attr("y1", "0%")
            .attr("x2", "100%")
            .attr("y2", "0%");

        // Add color stops to the gradient
        const domain = curColorScale.domain();
        const colorRange = curColorScale.range();
        colorRange.forEach((color, i) => {
            gradient.append("stop")
                .attr("offset", `${i * 100 / (colorRange.length - 1)}%`)
                .attr("stop-color", color);
        });

        // Add the gradient rect
        svg.append("rect")
            .attr("width", svgWidth)
            .attr("height", svgHeight)
            .style("fill", "url(#legend-gradient)");

        // Add the SVG to the div
        div.appendChild(svg.node());

        // Add labels for min and max values
        const labelDiv = document.createElement('div');
        labelDiv.style.display = 'flex';
        labelDiv.style.justifyContent = 'space-between';
        labelDiv.style.width = `${svgWidth}px`;
        labelDiv.innerHTML = `
        <span>${domain[0].toFixed(2)}</span>
        <span>${domain[domain.length - 1].toFixed(2)}</span>
    `;
        div.appendChild(labelDiv);

        return div;
    };

    curLegend = legend;
    curLegend.addTo(map);
    makeDraggable(curLegend)
}

window.onresize = function(event) {
    var windowWidth = window.innerWidth;
    var windowHeight = window.innerHeight;

    const legendDiv = document.getElementsByClassName('info legend')[0]
    const curInfoDiv = document.getElementsByClassName('info')[0]

    function checkOverlap(control1, control2) {
        var rect1 = control1.getContainer().getBoundingClientRect();
        var rect2 = control2.getContainer().getBoundingClientRect();

        var overlap = !(
            rect1.right < rect2.left ||
            rect1.left > rect2.right ||
            rect1.bottom < rect2.top ||
            rect1.top > rect2.bottom
        );
        return overlap;
    }


    if (checkOverlap(curLegend, curInfo)) {
        curLegend.getContainer().style.display = 'none';
        // console.log(legendDiv)
    } else {
        curLegend.getContainer().style.display = 'block';
        if(checkOverlap(curLegend, curInfo)){
            curLegend.getContainer().style.display = 'none';
        }
    }

}

let curTable;
let tableDiv;

function toggleTable() {
    if (!tableDiv) {
        // Create the table div if it doesn't exist
        tableDiv = document.createElement('div');
        tableDiv.id = 'tablePop';
        tableDiv.style.width = '500px';
        tableDiv.style.height = '500px';
        tableDiv.style.overflow = 'hidden';
        tableDiv.style.position = 'fixed';
        tableDiv.style.top = '50px';
        tableDiv.style.left = '50px';
        tableDiv.style.backgroundColor = 'white';
        tableDiv.style.border = '1px solid #ccc';
        tableDiv.style.zIndex = '9999';
        tableDiv.style.display = 'none';
        tableDiv.style.flexDirection = 'column';
        document.body.appendChild(tableDiv);

        // Add a header for dragging and title
        const header = document.createElement('div');
        header.id = 'tableHeader';
        header.style.padding = '10px';
        header.style.backgroundColor = '#f1f1f1';
        header.style.cursor = 'move';
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        header.innerHTML = '<span>Data Table</span><span class="close-btn" style="cursor:pointer;">×</span>';
        tableDiv.appendChild(header);

        // Add a container for filters
        const filterContainer = document.createElement('div');
        filterContainer.id = 'filterContainer';
        filterContainer.style.padding = '10px';
        filterContainer.innerHTML = `
            <div>
                <label for="yieldMin">Yield Min:</label>
                <input type="number" id="yieldMin" placeholder="Min Yield">
                <label for="yieldMax">Yield Max:</label>
                <input type="number" id="yieldMax" placeholder="Max Yield">
            </div>
            <div>
                <label for="predictionMin">Prediction Min:</label>
                <input type="number" id="predictionMin" placeholder="Min Prediction">
                <label for="predictionMax">Prediction Max:</label>
                <input type="number" id="predictionMax" placeholder="Max Prediction">
            </div>
            <button id="applyFilters">Apply Filters</button>
        `;
        tableDiv.appendChild(filterContainer);

        // Add a container for the Tabulator table
        const tableContainer = document.createElement('div');
        tableContainer.id = 'tableContainer';
        tableContainer.style.height = 'calc(100% - 100px)';
        tableContainer.style.overflow = 'auto';
        tableDiv.appendChild(tableContainer);

        // Make the div draggable and resizable
        $(tableDiv).draggable({
            handle: '#tableHeader',
            containment: 'window'
        }).resizable({
            minHeight: 200,
            minWidth: 200,
            handles: 'all',
            resize: function(event, ui) {
                if (curTable) {
                    curTable.setHeight(ui.size.height - 100);
                }
            }
        });

        // Add close functionality
        header.querySelector('.close-btn').addEventListener('click', () => {
            tableDiv.style.display = 'none';
        });

        // Add filter functionality
        document.getElementById('applyFilters').addEventListener('click', applyFilters);
    }

    // Toggle the visibility of the table
    if (tableDiv.style.display === 'none') {
        tableDiv.style.display = 'flex';
        updateTableContent();
    } else {
        tableDiv.style.display = 'none';
    }
}

function updateTableContent() {
    const tableContainer = document.getElementById('tableContainer');

    // Clear existing table if any
    if (curTable) {
        curTable.destroy();
    }

    // Check if data is available
    if (curResponse && curResponse.features && curResponse.features.length > 0) {
        // Create the Tabulator table
        curTable = new Tabulator("#tableContainer", {
            data: curResponse.features.map(d => ({
                NAME: d.properties.NAME,
                FIPS: d.properties.FIPS,
                YIELD: d.properties.yield,
                PREDICTION: d.properties.pred,
                ERROR: d.properties.error
            })),
            columns: [
                {title: "Name", field: "NAME", headerFilter: "input"},
                {title: "FIPS", field: "FIPS", headerFilter: "input"},
                {title: "Yield", field: "YIELD", headerFilter: "input"},
                {title: "Prediction", field: "PREDICTION", headerFilter: "input"},
                {title: "Error", field: "ERROR", headerFilter: "input"}
            ],
            layout: "fitColumns",
            height: "100%"
        });
    } else {
        tableContainer.innerHTML = '<p style="padding: 20px;">No data available. Please load data first.</p>';
    }
}

function applyFilters() {
    if (curTable) {
        const yieldMin = parseFloat(document.getElementById('yieldMin').value);
        const yieldMax = parseFloat(document.getElementById('yieldMax').value);
        const predictionMin = parseFloat(document.getElementById('predictionMin').value);
        const predictionMax = parseFloat(document.getElementById('predictionMax').value);

        curTable.setFilter([
            {field: "YIELD", type: ">=", value: yieldMin || 0},
            {field: "YIELD", type: "<=", value: yieldMax || Number.MAX_VALUE},
            {field: "PREDICTION", type: ">=", value: predictionMin || 0},
            {field: "PREDICTION", type: "<=", value: predictionMax || Number.MAX_VALUE}
        ]);
    }
}

// Add event listener to the button
document.getElementById('tablePopupButton').addEventListener('click', toggleTable);

let sidebar;
let drawFlag = 'normal';

function hideCurInfo() {
    curInfoVisible = false;
    if (curInfo) {
        curMap.removeControl(curInfo);
    }
}

function showCurInfo() {
    curInfoVisible = true;
    if (curInfo) {
        curInfo.addTo(curMap);
    }
}

/*
This function overrides the original _onClick function in the sidebar.js file.
We check if the tab clicked is the 'run' tab, if so, all the behaviors will be different.
We do so by setting a global variable drawFlag to 'run'.
 */
function createSideMenu(map) {

    L.Control.Sidebar.prototype._onClick = function() {
        var tabId = this.querySelector('a').hash.slice(1);

            // Call the original _onClick function for other tabs
            if (L.DomUtil.hasClass(this, 'active')) {
                this._sidebar.close();
            } else if (!L.DomUtil.hasClass(this, 'disabled')) {
                this._sidebar.open(tabId);
                if (tabId === 'run') {
                    curTileLayer.remove()
                    curLayer.remove()
                    curLegend.remove()
                    curInfo.remove()
                    drawFlag = 'run';
                } else {
                    curTileLayer.addTo(curMap);
                    curLayer.addTo(curMap);
                    curLegend.addTo(curMap);
                    curInfo.addTo(curMap);
                    drawFlag = 'normal';
                }
            }
    };

    sidebar = L.control.sidebar('sidebar').addTo(map);

    sidebar.on('opening', function() {
        console.log("Sidebar is opening");
        // Add your custom code here for when the sidebar opens
        addControlKeyListeners()
        hideCurInfo()
    });

    sidebar.on('closing', function() {
        console.log("Sidebar is closing");
        // Add your custom code here for when the sidebar closes
        removeControlKeyListeners()
        showCurInfo()
    });

}

function createMenu(map){
    var controlBar = L.control.bar('bar',{
        position:'topcenter',
        visible:true
    });
    map.addControl(controlBar);
}

var locations = ['Cuming County', 'Lancaster County', 'Nuckolls County', 'Minnehaha County', 'Hancock County', 'Allen County', 'Sauk County', 'Stone County', 'Henry County', 'Lake County', 'Barton County', 'Keith County', 'Phelps County', 'Menominee County', 'Jasper County', 'Steuben County', 'Fayette County', 'Greenwood County', 'Alpena County', 'Doniphan County', 'Clare County', 'Republic County', 'Webster County', 'Hancock County', 'Hutchinson County', 'Marquette County', 'Clay County', 'Knox County', 'Livingston County', 'Dakota County', 'Leelanau County', 'Butler County', 'Ohio County', 'Moody County', 'Decatur County', 'Perry County', 'Boyd County', 'Mille Lacs County', 'Walsh County', 'Morgan County', 'Portage County', 'Polk County', 'Benton County', 'Douglas County', 'Wabash County', 'Huntington County', 'Decatur County', 'Wabash County', 'Allen County', 'Marshall County', 'Thomas County', 'Sioux County', 'Fillmore County', 'Lac qui Parle County', 'Pierce County', 'McLean County', 'Phillips County', 'Holt County', 'Johnson County', 'La Crosse County', 'Bond County', 'Brown County', 'McLeod County', 'Dunn County', 'Madison County', 'Jackson County', 'Cedar County', 'Orange County', 'Brown County', 'Lyon County', 'Carroll County', 'Hamilton County', 'Pocahontas County', 'Independence County', 'Lonoke County', 'Newton County', 'Clark County', 'Schoolcraft County', 'Jersey County', 'Wallace County', 'Alger County', 'Fulton County', 'Newaygo County', 'Todd County', 'Logan County', 'Miller County', 'Riley County', 'Warrick County', 'Ellis County', 'Pratt County', 'Lane County', 'Piatt County', 'Kossuth County', 'Burke County', 'Harrison County', 'Keya Paha County', 'Webster County', 'Pope County', 'Jefferson County', 'Deuel County', 'Banner County', 'Madison County', 'Sanilac County', 'Wayne County', 'Nobles County', 'Aitkin County', 'Ramsey County', 'Trego County', 'Maries County', 'Arkansas County', 'Lawrence County', 'Bureau County', 'Scioto County', 'Vinton County', 'Howard County', 'Carroll County', 'Hubbard County', 'Sargent County', 'Reynolds County', 'Paulding County', 'Wells County', 'Palo Alto County', 'Ringgold County', 'Warren County', 'Greeley County', 'Jefferson County', 'Saline County', 'Clinton County', 'Jackson County', 'Dodge County', 'Freeborn County', 'Lake County', 'Coles County', 'Van Buren County', 'Mercer County', 'Effingham County', 'Clark County', 'Tippecanoe County', 'Dundy County', 'Grand Forks County', 'LaPorte County', 'Hamilton County', 'Greeley County', 'Henry County', 'Newton County', 'Posey County', 'Cumberland County', 'Pope County', 'Crawford County', 'Calhoun County', 'McPherson County', 'Fulton County', 'Miner County', 'Jerauld County', 'Decatur County', 'Dubois County', 'Worth County', 'Scott County', 'Christian County', 'Ripley County', 'Mercer County', 'Green Lake County', 'Walworth County', 'Fulton County', 'Union County', 'McDonald County', 'Scotts Bluff County', 'Dickey County', 'Barnes County', 'Sibley County', 'Chippewa County', 'Clinton County', 'Montgomery County', 'Atchison County', 'Macon County', 'St. Joseph County', 'Franklin County', 'Adams County', 'Olmsted County', 'McCook County', 'Franklin County', 'Burleigh County', 'Iron County', 'Kandiyohi County', 'Lawrence County', 'Ontonagon County', 'Rock County', 'Ziebach County', 'Baraga County', 'Boone County', 'Van Buren County', 'Cowley County', 'Johnson County', 'Harrison County', 'Bartholomew County', 'Brown County', 'Ward County', 'Logan County', 'Cass County', 'Douglas County', 'Bottineau County', 'Alcona County', 'Searcy County', 'Otoe County', 'Waseca County', 'Brule County', 'Clark County', 'Garland County', 'Osage County', 'Trumbull County', 'Marion County', 'Webster County', 'Cottonwood County', 'Black Hawk County', 'Pike County', 'Kearney County', 'Hitchcock County', 'Rock Island County', 'Sevier County', 'Cass County', 'Carroll County', 'Jefferson County', 'Lincoln County', 'Vernon County', 'Iron County', 'Monroe County', 'Rush County', 'Montgomery County', 'Stanton County', 'Koochiching County', 'Watonwan County', 'Sully County', 'Gibson County', 'Kimball County', 'Kendall County', 'Wright County', 'Kenosha County', 'Grundy County', 'Lake County', 'Ottawa County', 'Cook County', 'Gallatin County', 'Franklin County', 'Clay County', 'Benson County', 'Pike County', 'Lawrence County', 'Scott County', 'Adams County', 'Crawford County', 'Guernsey County', 'Barry County', 'Stone County', 'Clarke County', 'Fayette County', 'Warren County', 'Van Wert County', 'Adair County', 'Howard County', 'Milwaukee County', 'Scott County', 'Pickaway County', 'Antrim County', 'Lee County', 'Nemaha County', 'Pottawatomie County', 'Jackson County', 'Vermillion County', 'Roscommon County', 'Muskingum County', 'Custer County', 'Chickasaw County', 'DeKalb County', 'Hancock County', 'Stark County', 'Luce County', 'Bowman County', 'Stark County', 'Walworth County', 'Washington County', 'Dubuque County', 'Sherman County', 'Richland County', 'Adams County', 'Champaign County', 'Iroquois County', 'Poweshiek County', 'Wayne County', 'Cass County', 'Kingsbury County', 'Logan County', 'Gogebic County', 'Becker County', 'Ashland County', 'Ford County', 'Emmons County', 'Randolph County', 'Oneida County', 'Allen County', 'Douglas County', 'Waushara County', 'Izard County', 'Miller County', 'Platte County', 'Buchanan County', 'Henry County', 'Polk County', 'Ottawa County', 'Norman County', 'Shelby County', 'Benton County', 'Chisago County', 'Cole County', 'Berrien County', 'Dawes County', 'Montmorency County', 'Oscoda County', 'St. Clair County', 'Washington County', 'Scott County', 'Labette County', 'Harrison County', 'Marshall County', 'Scott County', 'Ogemaw County', 'Richland County', 'Ralls County', 'Menard County', 'Sheridan County', 'Fulton County', 'Johnson County', 'Washburn County', 'Winona County', 'Andrew County', 'Montgomery County', 'Cherokee County', 'Lafayette County', 'Waupaca County', 'Ozark County', 'Traill County', 'Vilas County', 'Beltrami County', 'Clark County', 'McHenry County', 'Wayne County', 'LaMoure County', 'Kidder County', 'Porter County', 'Hamilton County', 'Perry County', 'Cheyenne County', 'Wayne County', 'Marion County', 'Jackson County', 'Nelson County', 'Ray County', 'Hocking County', 'Linn County', 'Atchison County', 'Miami County', 'Ozaukee County', 'Sheboygan County', 'Cloud County', 'Dickinson County', 'Geary County', 'Lyon County', 'Butler County', 'Greene County', 'Rush County', 'Washington County', 'Laclede County', 'Craighead County', 'Saline County', 'White County', 'De Witt County', 'Goodhue County', 'Steele County', 'Vanderburgh County', 'Franklin County', 'Bayfield County', 'Portage County', 'Fond du Lac County', 'Kewaunee County', 'Chariton County', 'Russell County', 'Putnam County', 'Haakon County', 'Cleburne County', 'Wells County', 'Hot Spring County', 'Schuyler County', 'Columbia County', 'Griggs County', 'Clayton County', 'Barton County', 'Slope County', 'Garfield County', 'Ingham County', 'Shawnee County', 'Hanson County', 'Itasca County', 'Johnson County', 'Langlade County', 'Buena Vista County', 'Mills County', 'Delaware County', 'Dallas County', 'Wayne County', 'Stephenson County', 'Lapeer County', 'Kalkaska County', 'Divide County', 'Marion County', 'Douglas County', 'Cedar County', 'Ouachita County', 'Darke County', 'Dewey County', 'Owen County', 'Bollinger County', 'Pierce County', 'Union County', 'Kankakee County', 'McIntosh County', 'Platte County', 'Clay County', 'Randolph County', 'Butler County', 'Mason County', 'Yankton County', 'Rock County', 'Clinton County', 'Clinton County', 'Shiawassee County', 'Jewell County', 'Mitchell County', 'Jo Daviess County', 'Hancock County', 'Scott County', 'Williamson County', 'Stevens County', 'Brown County', 'Box Butte County', 'St. Clair County', 'Thurston County', 'Randolph County', 'Crawford County', 'Mahaska County', 'Douglas County', 'Jasper County', 'Adams County', 'Livingston County', 'Yell County', 'Comanche County', 'Lake County', 'Greene County', 'Appanoose County', 'Jefferson County', 'Boone County', 'Oregon County', 'Vigo County', 'Elkhart County', 'Meeker County', 'Ashland County', 'Madison County', 'Monroe County', 'Dallas County', 'Pawnee County', 'Wyandotte County', 'Tuscola County', 'Graham County', 'Lucas County', 'Mississippi County', 'Floyd County', 'Morton County', 'McPherson County', 'Red Willow County', 'Rock County', 'Mason County', 'Washington County', 'Eau Claire County', 'Sumner County', 'Oceana County', 'Kanabec County', 'Ashtabula County', 'Livingston County', 'Preble County', 'Jackson County', 'Miami County', 'Washtenaw County', 'LaGrange County', 'Oconto County', 'Forest County', 'Sawyer County', 'Stark County', 'Van Buren County', 'Gosper County', 'Mahoning County', 'Wayne County', 'Osage County', 'Kane County', 'Newton County', 'Cavalier County', 'Gove County', 'Gage County', 'Harrison County', 'Tuscarawas County', 'Highland County', 'Lake of the Woods County', 'Lyman County', 'Trempealeau County', 'Jackson County', 'Knox County', 'Dawson County', 'Ford County', 'Williams County', 'Cass County', 'Hardin County', 'Arthur County', 'Johnson County', 'Neosho County', 'Linn County', 'Hayes County', 'Calhoun County', 'Hillsdale County', 'Custer County', 'Beadle County', 'Johnson County', 'Jones County', 'Billings County', 'Antelope County', 'Gasconade County', 'Cross County', 'Phillips County', 'Pulaski County', 'Benzie County', 'St. Charles County', 'Brown County', 'Holt County', 'Mountrail County', 'Sioux County', 'Brown County', 'Clark County', 'Grundy County', 'Lincoln County', 'Polk County', 'Green County', 'Franklin County', 'McLean County', 'Wright County', 'Crawford County', 'Otter Tail County', 'Cass County', 'Outagamie County', 'Lafayette County', 'Morrow County', 'Foster County', 'Crawford County', 'Ste. Genevieve County', 'McDonough County', 'Montgomery County', 'Jackson County', 'Lincoln County', 'Dakota County', 'Adams County', 'Clark County', 'Worth County', 'Sherman County', 'Campbell County', 'Harding County', 'Gratiot County', 'Union County', 'Massac County', 'Logan County', 'Merrick County', 'Sheridan County', 'Morgan County', 'Grant County', 'Henry County', 'Codington County', 'Clay County', 'Faulkner County', 'Keokuk County', 'Greene County', 'Lake County', 'Anoka County', 'Bon Homme County', 'St. Joseph County', 'Pembina County', 'Bennett County', 'Baxter County', 'Story County', 'Bourbon County', 'Taylor County', 'Mower County', 'Murray County', 'Phelps County', 'Starke County', 'Mitchell County', 'Pawnee County', 'Marathon County', 'Wexford County', 'Hickory County', 'Barry County', 'Ramsey County', 'Little River County', 'Sarpy County', 'Wilkin County', 'Randolph County', 'Marion County', 'Pike County', 'Woodford County', 'Perry County', 'Grundy County', 'Johnson County', 'Isanti County', 'Benton County', 'Fountain County', 'Shelby County', 'Fayette County', 'Perry County', 'Polk County', 'Winneshiek County', 'Florence County', 'Wadena County', 'Winnebago County', 'Pennington County', 'Boone County', 'Genesee County', 'Roberts County', 'Ogle County', 'Richland County', 'Barron County', 'Iron County', 'Wabasha County', 'Presque Isle County', 'Tipton County', 'Clay County', 'Ashley County', 'Desha County', 'Washington County', 'Caldwell County', 'Crawford County', 'Lewis County', 'Grant County', 'Moultrie County', 'Crow Wing County', 'St. Francis County', 'Lincoln County', 'Smith County', 'Montgomery County', 'Calhoun County', 'Polk County', 'Traverse County', 'Cass County', 'Burt County', 'Sangamon County', 'Otsego County', 'Sac County', 'Yellow Medicine County', 'Mecosta County', 'Ripley County', 'Tazewell County', 'Sharp County', 'Rice County', 'Warren County', 'Todd County', 'Marshall County', 'Switzerland County', 'LaSalle County', 'Delaware County', 'Morris County', 'Davis County', 'Monroe County', 'Delaware County', 'Jackson County', 'Floyd County', 'Turner County', 'Stoddard County', 'Stearns County', 'Saunders County', 'Sherburne County', 'Davison County', 'Racine County', 'Shawano County', 'Audubon County', 'Le Sueur County', 'Dodge County', 'Jones County', 'Barber County', 'Pulaski County', 'Logan County', 'Gentry County', 'Blaine County', 'Adair County', 'Erie County', 'Vermilion County', 'St. Louis County', 'Boone County', 'Dane County', 'Morgan County', 'Marshall County', 'Huron County', 'Iosco County', 'Grant County', 'Hardin County', 'Clinton County', 'St. Louis County', 'Lorain County', 'Boone County', 'Dixon County', 'Calumet County', 'Ionia County', 'Cook County', 'Kent County', 'Stanton County', 'Jasper County', 'Plymouth County', 'Pottawattamie County', 'Wright County', 'Audrain County', 'Jefferson County', 'Greene County', 'Burnett County', 'Stanley County', 'Wheeler County', 'Grant County', 'Chase County', 'Aurora County', 'Franklin County', 'Crawford County', 'Chippewa County', 'Pennington County', 'Lincoln County', 'Chippewa County', 'Woodson County', 'Macomb County', 'Jasper County', 'Spencer County', 'McKenzie County', 'Calhoun County', 'Kosciusko County', 'Woodruff County', 'Perkins County', 'Taylor County', 'Defiance County', 'Marion County', 'Warren County', 'Page County', 'Jefferson County', 'Faribault County', 'Rawlins County', 'Thomas County', 'Cherokee County', 'White County', 'Cooper County', 'Dickinson County', 'Will County', 'Brookings County', 'Clay County', 'Boone County', 'Des Moines County', 'Scott County', 'Ottawa County', 'Carlton County', 'Athens County', 'Jefferson County', 'Douglas County', 'Jay County', 'Montcalm County', 'Lee County', 'Rice County', 'Sandusky County', 'Pulaski County', 'Saginaw County', 'Madison County', 'Dodge County', 'Marquette County', 'Sullivan County', 'Ness County', 'Chase County', 'Montgomery County', 'Conway County', 'Nodaway County', 'Ransom County', 'Bay County', 'Pine County', 'Brown County', 'Wilson County', 'Arenac County', 'Lee County', 'Osborne County', 'Emmet County', 'Fremont County', 'Taney County', 'Linn County', 'Buffalo County', 'Mellette County', 'Stevens County', 'Monroe County', 'Clark County', 'Haskell County', 'Iowa County', 'Buffalo County', 'Butler County', 'Moniteau County', 'Howard County', 'Nevada County', 'Auglaize County', 'Emmet County', 'Saline County', 'Callaway County', 'Cheboygan County', 'Gladwin County', 'Woodbury County', 'Alexander County', 'Jefferson County', 'Lincoln County', 'Clay County', 'Potter County', 'Kingman County', 'Texas County', 'Pulaski County', 'Crawford County', 'Geauga County', 'Towner County', 'Hamilton County', 'Buchanan County', 'DuPage County', 'Fall River County', 'Kittson County', 'Fillmore County', 'Sullivan County', 'Stafford County', 'Monroe County', 'White County', 'Noble County', 'York County', 'Clay County', 'Morgan County', 'Holmes County', 'Osceola County', 'Jennings County', 'Saline County', 'Kalamazoo County', 'Daviess County', 'Grand Traverse County', 'Hughes County', 'Hyde County', 'Greene County', 'Seward County', 'Columbiana County', 'Grant County', 'Benton County', 'Dickinson County', 'Richland County', 'Madison County', 'Crawford County', 'Carroll County', 'Lake County', 'Dallas County', 'Wood County', 'Belmont County', 'Carter County', 'Clay County', 'Cerro Gordo County', 'Greene County', 'Cape Girardeau County', 'Mississippi County', 'Cleveland County', 'DeKalb County', 'Schuyler County', 'Mackinac County', 'Finney County', 'Montgomery County', 'Cheyenne County', 'Martin County', 'Garden County', 'Macoupin County', 'Ross County', 'Whiteside County', 'Washington County', 'Howell County', 'Edwards County', 'Logan County', 'Winnebago County', 'Harvey County', 'Midland County', 'Jefferson County', 'Hamlin County', 'Lincoln County', 'Lawrence County', 'Howard County', 'Pike County', 'Eaton County', 'Wapello County', 'Cass County', 'Sheridan County', 'Edmunds County', 'Dearborn County', 'Jackson County', 'Crittenden County', 'Renville County', 'Henry County', 'Harlan County', 'Pepin County', 'Macon County', 'Kiowa County', 'Daviess County', 'Manistee County', 'Lyon County', 'Adams County', 'Harper County', 'Monona County', 'Peoria County', 'Humboldt County', 'Washington County', 'Iowa County', 'Morrison County', 'Shelby County', 'Madison County', 'Washington County', 'Champaign County', 'Edgar County', 'Hardin County', 'Missaukee County', 'Stutsman County', 'Shannon County', 'Oakland County', 'Golden Valley County', 'Pipestone County', 'Renville County', 'Hooker County', 'Hand County', 'Lafayette County', 'Clermont County', 'Louisa County', 'Elk County', 'Noble County', 'Putnam County', 'Mahnomen County', 'Perry County', 'Hennepin County', 'Tama County', 'Seward County', 'Monroe County', 'Richardson County', 'Christian County', 'Oliver County', 'Osceola County', 'Dade County', 'Muscatine County', 'Martin County', 'Scotland County', 'Nemaha County', 'Norton County', 'Furnas County', 'Wayne County', 'Howard County', 'Dunn County', 'Coffey County', 'Branch County', 'Meigs County', 'Spink County', 'Valley County', 'Saline County', 'Rolette County', 'Allegan County', 'Brown County', 'Shelby County', 'Franklin County', 'Keweenaw County', 'Kearny County', 'Monroe County', 'Lucas County', 'Nicollet County', 'Marinette County', 'Price County', 'Miami County', 'Ellsworth County', 'Hodgeman County', 'Meade County', 'Faulk County', 'Houghton County', 'Butte County', 'Madison County', 'Putnam County', 'Putnam County', 'Grant County', 'Morton County', 'Meade County', 'Marion County', 'Chicot County', 'Pope County', 'Marion County', 'St. Francois County', 'Clinton County', 'Prairie County', 'Bradley County', 'Douglas County', 'Huron County', 'Wood County', 'Anderson County', 'Knox County', 'McPherson County', 'Charlevoix County', 'Swift County', 'Seneca County', 'Williams County', 'Union County', 'Cuyahoga County', 'Oglala Lakota County', 'Marshall County', 'Wichita County', 'Charles Mix County', 'Cedar County', 'McHenry County', 'Carroll County', 'Steele County', 'Thayer County', 'Hamilton County', 'Warren County', 'Vernon County', 'Parke County', 'Franklin County', 'Fairfield County', 'Pierce County', 'Carroll County', 'Red Lake County', 'Union County', 'Knox County', 'Bremer County', 'Deuel County', "O'Brien County", 'Grant County', 'Drew County', 'Morrill County', 'Benton County', 'Pike County', 'Dent County', 'Leavenworth County', 'Muskegon County', 'St. Clair County', 'Mercer County', 'Pettis County', 'Chautauqua County', 'Whitley County', 'Day County', 'DeKalb County', 'Edwards County', 'Licking County', 'Union County', 'Henderson County', 'Columbia County', 'Clearwater County', 'Rooks County', 'Fayette County', 'Hall County', 'Hamilton County', 'Loup County', 'Frontier County', 'Big Stone County', 'Blue Earth County', 'Delta County', 'Sebastian County', 'Dunklin County', 'Monroe County', 'Isabella County', 'Clark County', 'Adams County', 'Tripp County', 'Guthrie County', 'Washington County', 'Sanborn County', 'St. Croix County', 'Summit County', 'Washington County', 'Lawrence County', 'Eddy County', 'Juneau County', 'Corson County', 'Gregory County', 'Blackford County', 'Reno County', 'Rusk County', 'Waukesha County', 'Hendricks County', 'Jackson County', 'Hettinger County', 'Buffalo County', 'Polk County', 'Redwood County', 'Poinsett County', 'Shelby County', 'Lawrence County', 'Gray County', 'Pemiscot County', 'Nance County', 'Menominee County', 'Sioux County', 'St. Louis city', 'Grant County', 'Marshall County', 'Knox County', 'Allamakee County', 'Wabaunsee County', 'Houston County', 'Medina County', 'Manitowoc County', 'Door County', 'Gallia County', 'Coshocton County', 'Perkins County', 'Winnebago County', 'Wyandot County', 'Carver County', 'Colfax County', 'Bates County', 'Ida County', 'Sedgwick County', 'Butler County', 'Cass County', 'Mercer County', 'Jackson County', 'Cherry County', 'New Madrid County', 'Hempstead County', 'Camden County', 'Lenawee County', 'Roseau County']
/*initiate the autocomplete function on the "myInput" element, and pass along the countries array as possible autocomplete values:*/
// autocomplete(document.getElementById("locationInput"), locations);
// autocomplete(document.getElementById("modelLocationInput"), locations);
autocomplete(document.getElementById("plotCountyInput"), locations);
// autocomplete(document.getElementById("locationInput"), locations);

function autocomplete(inp, arr) {
    /*the autocomplete function takes two arguments,
    the text field element and an array of possible autocompleted values:*/
    var currentFocus;
    /*execute a function when someone writes in the text field:*/

    inp.addEventListener("input", function(e) {
        var a, b, i, val = this.value;
        /*close any already open lists of autocompleted values*/
        closeAllLists();
        if (!val) {
            return false;
        }
        currentFocus = -1;
        /*create a DIV element that will contain the items (values):*/
        a = document.createElement("DIV");
        a.setAttribute("id", this.id + "autocomplete-list");
        a.setAttribute("class", "autocomplete-items");
        /*append the DIV element as a child of the autocomplete container:*/
        this.parentNode.appendChild(a);
        /*for each item in the array...*/
        for (i = 0; i < arr.length; i++) {
            /*check if the item starts with the same letters as the text field value:*/
            if (arr[i].substr(0, val.length).toUpperCase() == val.toUpperCase()) {
                /*create a DIV element for each matching element:*/
                b = document.createElement("DIV");
                /*make the matching letters bold:*/
                b.innerHTML = "<strong>" + arr[i].substr(0, val.length) + "</strong>";
                b.innerHTML += arr[i].substr(val.length);
                /*insert a input field that will hold the current array item's value:*/
                b.innerHTML += "<input type='hidden' value='" + arr[i] + "'>";
                /*execute a function when someone clicks on the item value (DIV element):*/
                b.addEventListener("click", function(e) {
                    /*insert the value for the autocomplete text field:*/
                    inp.value = this.getElementsByTagName("input")[0].value;
                    $(inp).trigger("input")
                    /*close the list of autocompleted values,
                    (or any other open lists of autocompleted values:*/
                    closeAllLists();
                });
                a.appendChild(b);
            }
        }
    });
    /*execute a function presses a key on the keyboard:*/
    inp.addEventListener("keydown", function(e) {
        var x = document.getElementById(this.id + "autocomplete-list");
        if (x) x = x.getElementsByTagName("div");
        if (e.keyCode == 40) {
            /*If the arrow DOWN key is pressed,
            increase the currentFocus variable:*/
            currentFocus++;
            /*and and make the current item more visible:*/
            addActive(x);
        } else if (e.keyCode == 38) { //up
            /*If the arrow UP key is pressed,
            decrease the currentFocus variable:*/
            currentFocus--;
            /*and and make the current item more visible:*/
            addActive(x);
        } else if (e.keyCode == 13) {
            /*If the ENTER key is pressed, prevent the form from being submitted,*/
            e.preventDefault();
            if (currentFocus > -1) {
                /*and simulate a click on the "active" item:*/
                if (x) x[currentFocus].click();
            }
        }
    });

    function addActive(x) {
        /*a function to classify an item as "active":*/
        if (!x) return false;
        /*start by removing the "active" class on all items:*/
        removeActive(x);
        if (currentFocus >= x.length) currentFocus = 0;
        if (currentFocus < 0) currentFocus = (x.length - 1);
        /*add class "autocomplete-active":*/
        x[currentFocus].classList.add("autocomplete-active");
    }

    function removeActive(x) {
        /*a function to remove the "active" class from all autocomplete items:*/
        for (var i = 0; i < x.length; i++) {
            x[i].classList.remove("autocomplete-active");
        }
    }

    function closeAllLists(elmnt) {
        /*close all autocomplete lists in the document,
        except the one passed as an argument:*/
        var x = document.getElementsByClassName("autocomplete-items");
        for (var i = 0; i < x.length; i++) {
            if (elmnt != x[i] && elmnt != inp) {
                x[i].parentNode.removeChild(x[i]);
            }
        }
    }
    /*execute a function when someone clicks in the document:*/
    document.addEventListener("click", function(e) {
        closeAllLists(e.target);
    });
}

function applySetting() {

    // remove current layer(s) if exists
    if (curLayer) {
        curMap.removeLayer(curLayer);
    }

    if (curInfo) {
        curMap.removeControl(curInfo);
    }

    if (curLegend) {
        curMap.removeControl(curLegend);
    }

    // curLocation = document.getElementById("locationInput").value;
    curLocation = ''
    curCrop = document.getElementById("cropInput").value; // 'corn' or 'soybean'
    curYear = document.getElementById("yearInput").value; // 2010-2021
    curMonth = document.getElementById("monthInput").value; // 0-9
    curProperty = document.getElementById("propertyInput").value; // or 'yield', 'error'- color scheme should be different

    //call getData function
    getData(curMap, curCrop, curYear, curMonth, curLocation);

    // scatterGen("");

}

function updateTable(){
    let t = curResponse.features.map(d=>
        d={County:d.properties.NAME,
            State:d.properties.STATE,
            FIPS:d.properties.FIPS,
            Yield:(d.properties.yield).toFixed(2),
            Prediction:d.properties.pred.toFixed(2),
            Error:d.properties.error.toFixed(2),
            'Uncertainty(%)':(d.properties.error/d.properties.yield*100).toFixed(2)
    })

    if(highlightedLayers.size<=1){
        resetAllHighlight();
    }

    if ($('#filterStateIn').val() !== 'all') {
        t = t.filter(d=>d.State === $('#filterStateIn option:selected').text())
    }

    var table = new Tabulator("#table-view",{
        data:t.map(d=>d={County:d.County, Yield:d.Yield, Prediction:d.Prediction, Error:d.Error, 'Uncertainty(%)':d["Uncertainty(%)"], FIPS:d.FIPS}),
        autoColumns: true,
        height:"311px",
    })

    table.on("rowMouseOver", function(e, row){
        // get fips
        const fips = row.getData().FIPS
        highlightHelper(fips,"#68da4c","FIPS")
    })

    table.on("rowMouseOut", function(e, row){
        const fips = row.getData().FIPS
        resetHighlight(fips,"FIPS")
    })

    table.on("rowClick", function(e, row){
        let l = curLayer.getLayers().filter(d=>{
            if (d.hasOwnProperty('feature') && d.feature.hasOwnProperty('properties') && d.feature.properties.hasOwnProperty('FIPS')) {
                return d.feature.properties.FIPS === row.getData().FIPS} else {return false}
        })[0]
        l.fire("click");
    })

}


$(document).ready(createMap);

//Map download functions :
function filter(node) {
    if (node.classList) return ( !node.classList.contains("topnav") );
    return true;
}

function scaleBar(){
// Get the current zoom level of the map
    var zoomLevel = curMap.getZoom();
    // console.log(zoomLevel)
    // Define distance intervals and corresponding reference distances
    var distanceIntervals = [
        { minZoom: 0, maxZoom: 2, distance: 5000000 }, // 5000 km
        { minZoom: 2, maxZoom: 4, distance: 2500000 }, // 2500 km
        { minZoom: 4, maxZoom: 6, distance: 1250000 }, // 1250 km
        { minZoom: 6, maxZoom: 8, distance: 500000 },  // 500 km
        { minZoom: 8, maxZoom: 10, distance: 250000 }, // 250 km
        { minZoom: 10, maxZoom: 12, distance: 100000 },// 100 km
        { minZoom: 12, maxZoom: 14, distance: 50000 }, // 50 km
        { minZoom: 14, maxZoom: 16, distance: 25000 }, // 25 km
        { minZoom: 16, maxZoom: 22, distance: 10000 }, // 10 km
        // { minZoom: 19, maxZoom: 20, distance: 5000 },  // 5 km
        // { minZoom: 21, maxZoom: Infinity, distance: 1000 } // 1 km
    ];

// Function to get the reference distance based on the zoom level
    function getReferenceDistance(zoomLevel) {
        for (var i = 0; i < distanceIntervals.length; i++) {
            var interval = distanceIntervals[i];
            if (zoomLevel >= interval.minZoom && zoomLevel <= interval.maxZoom) {
                return interval.distance;
            }
        }
        return 10000; // Default to 1 km if no matching interval found
    }

// Get the reference distance based on the zoom level
    var referenceDistance = getReferenceDistance(zoomLevel);

// Calculate the scale based on the zoom level
    var scale = 256 * Math.pow(2, zoomLevel)/40075016.686;

// Calculate the pixel distance for the reference distance
    var pixelDistance = referenceDistance * scale;
    if(pixelDistance<500){
        referenceDistance*=2
        pixelDistance*=2
    }
    // Define a scaling factor to reduce the size of the scale bar
    var scalingFactor = 0.2;


    // Create an SVG element for the scale bar
    var svg = d3.create("svg")
        .attr("class", "scale-bar")
        .attr("width", pixelDistance * scalingFactor * +30)
        .attr("height", 50);

    // Draw the scale bar
    svg.append("rect")
        .attr("width", pixelDistance * scalingFactor)
        .attr("height", 5)
        .attr('x', 5)
        .attr('y', 10)
        .attr("fill", "black");

    // Add labels to the scale bar
    svg.append("text")
        .attr("x", pixelDistance * scalingFactor-8)
        .attr("y", 34)
        .attr("text-anchor", "right")
        .text(referenceDistance / 1000 * scalingFactor + " km");

    svg.append("text")
        .attr("x", 5)
        .attr("y", 34)
        .attr("text-anchor", "left")
        .text("0");

    // Add ticks to the scale bar
    var numTicks = 5;
    var tickSpacing = (pixelDistance * scalingFactor) / numTicks;
    for (var i = 0; i <= numTicks; i++) {
        svg.append("line")
            .attr("x1", 5 + i * tickSpacing)
            .attr("y1", 3)
            .attr("x2", 5+ i * tickSpacing)
            .attr("y2", 10)
            .attr("stroke", "black")
            .attr("stroke-width", 1);
    }

    return svg.node();
}

function northArrow(){
    const svg = d3.create("svg");

    svg.append("polygon")
        .attr("points", "20,20 8,50 20,42")
        .attr("fill", "white")
        .attr('stroke','black ')
        .attr("stroke-width",1)

    svg.append("polygon")
        .attr("points", "20,20 40,50 20,40")
        .attr("fill", "black")
        .attr('stroke','black ')
        .attr("stroke-width", 1)

    svg.append("text")
        .attr("x", 20)
        .attr("y", 18)
        .attr("text-anchor", "middle")
        .attr("font-size", "16px")
        .attr("fill", "black")
        .text("N");

    return svg.node()
}

function downloadFunc(divID){
    let heading;
    const mapdiv = document.getElementById('map');
    if (divID === 'mapid'){
        if (!(document.getElementById("baseMapOn").checked)){
            // console.log("baseMapOff")
            curTileLayer.remove()
        }


        const bigDiv = document.getElementById('mapid')

        heading = document.createElement("div")
        heading.className = "heading"

        userTitile = document.getElementById("userTitle").value
        console.log(userTitile)
        heading.innerHTML =  (userTitile===''?"<h3>Crop Yield Prediction Map</h3>":("<h3>"+userTitile+"</h3>") )+
            "Crop Type: "+(curCrop==="corn"?"Corn":"Soybean")+"&nbsp;&nbsp; Year: "+curYear+"  &nbsp;&nbsp;    Date: "+curDate[curMonth]+""
        +"<br> "+document.getElementById("userDescription").value

        heading.style.backgroundColor = document.getElementById("colorPicker").value;

        const leftSVG = northArrow()
        const rightSVG = scaleBar()
        // Position the SVG nodes using JavaScript
        leftSVG.style.position = "absolute";
        leftSVG.style.left = "30";
        leftSVG.style.top = "40";
        // leftSVG.style.transform = "translateY(-50%)";

        rightSVG.style.position = "absolute";
        // rightSVG.style.right = "-100";
        rightSVG.style.top = "60";
        rightSVG.style.left = (window.innerWidth-300)+"px";
        // rightSVG.style.transform = "translateY(-50%)";

        // Insert the SVG nodes into the heading container
        heading.insertBefore(leftSVG, heading.firstChild);
        heading.appendChild(rightSVG);

        var selectedFont = document.getElementById("fontSelect").value;

        switch (selectedFont) {
            case "Arial":
                heading.style.fontFamily = "Arial, sans-serif";
                break;
            case "Times New Roman":
                heading.style.fontFamily = "Times New Roman, serif";
                break;
            case "Verdana":
                heading.style.fontFamily = "Verdana, sans-serif";
                break;
            case "Helvetica":
                heading.style.fontFamily = "Helvetica, sans-serif";
                break;
            case "Georgia":
                heading.style.fontFamily = "Georgia, serif";
                break;
            default:
                heading.style.fontFamily = "Arial, sans-serif";
        }

        curInfo.remove()
        // zoomControl.remove()
        drawControl.remove()
        bigDiv.insertBefore(heading,bigDiv.firstChild)

        mapdiv.style.width = '100%'
        mapdiv.style.height = '100%'

    }

    domtoimage
        .toJpeg(document.getElementById(divID), { filter:filter })
        // .toJpeg(document.getElementById(divID))
        .then(function (dataUrl) {

            var link = document.createElement('a');
            link.download = 'download.jpeg';
            link.href = dataUrl;
            link.click();

            if(heading){
                heading.remove()
                // zoomControl.addTo(curMap)
                drawControl.addTo(curMap)
                curInfo.addTo(curMap)
                makeDraggable(curInfo)
                makeDraggable(curLegend)

            }
            curTileLayer.addTo(curMap)
            mapdiv.style.width = '100vw'
            mapdiv.style.height = '100vh'

        });
}

function previewFunc(divID){
    let heading;
    const mapdiv = document.getElementById('map');
    if (divID === 'mapid'){
        if (!(document.getElementById("baseMapOn").checked)){
            // console.log("baseMapOff")
            curTileLayer.remove()
        }

        const bigDiv = document.getElementById('mapid')

        heading = document.createElement("div")
        heading.className = "heading"

        userTitile = document.getElementById("userTitle").value
        heading.innerHTML =  (userTitile===''?"<h3>Crop Yield Prediction Map</h3>":("<h3>"+userTitile+"</h3>") )+
            "Crop Type: "+(curCrop==="corn"?"Corn":"Soybean")+"&nbsp;&nbsp; Year: "+curYear+"  &nbsp;&nbsp;    Date: "+curDate[curMonth]+""
            +"<br> "+document.getElementById("userDescription").value

        heading.style.backgroundColor = document.getElementById("colorPicker").value;

        const leftSVG = northArrow()
        const rightSVG = scaleBar()
        // Position the SVG nodes using JavaScript
        leftSVG.style.position = "absolute";
        leftSVG.style.left = "30";
        leftSVG.style.top = "40";
        // leftSVG.style.transform = "translateY(-50%)";

        rightSVG.style.position = "absolute";
        // rightSVG.style.right = "-100";
        rightSVG.style.top = "60";
        rightSVG.style.left = (window.innerWidth-300)+"px";
        // rightSVG.style.transform = "translateY(-50%)";

        // Insert the SVG nodes into the heading container
        heading.insertBefore(leftSVG, heading.firstChild);
        heading.appendChild(rightSVG);

        var selectedFont = document.getElementById("fontSelect").value;

        switch (selectedFont) {
            case "Arial":
                heading.style.fontFamily = "Arial, sans-serif";
                break;
            case "Times New Roman":
                heading.style.fontFamily = "Times New Roman, serif";
                break;
            case "Verdana":
                heading.style.fontFamily = "Verdana, sans-serif";
                break;
            case "Helvetica":
                heading.style.fontFamily = "Helvetica, sans-serif";
                break;
            case "Georgia":
                heading.style.fontFamily = "Georgia, serif";
                break;
            default:
                heading.style.fontFamily = "Arial, sans-serif";
        }

        curInfo.remove()
        // zoomControl.remove()
        drawControl.remove()

        bigDiv.insertBefore(heading,bigDiv.firstChild)


        mapdiv.style.width = '100%'
        mapdiv.style.height = '100vh'

    }

    domtoimage
        .toJpeg(document.getElementById(divID), { filter:filter })
        // .toJpeg(document.getElementById(divID))
        .then(function (dataUrl) {
            // in new page
            // var imgWindow = window.open("");
            // imgWindow.document.write('<img src="' + dataUrl + '" style="width:100%; height:auto;">');

            // Settings for the popup window
            var windowFeatures = "width=800,height=600,scrollbars=yes,resizable=yes,status=yes";

            // Open a new popup window with specified features
            var imgWindow = window.open("", "_blank", windowFeatures);
            imgWindow.document.write('<img src="' + dataUrl + '" style="width:100%; height:auto; display:block; margin:auto;">');
            imgWindow.document.title = "Image Preview"; // Setting the title of the new window
            imgWindow.document.close(); // Ensure proper loading and rendering


            if(heading){
                heading.remove()

                // zoomControl.addTo(curMap)
                drawControl.addTo(curMap)
                curInfo.addTo(curMap)
                makeDraggable(curInfo)
                makeDraggable(curLegend)
            }
            curTileLayer.addTo(curMap)
            mapdiv.style.width = '100vw'
            mapdiv.style.height = '100vh'

        });
}

function downloadData(){
    applySetting()
    switch( document.getElementById("dataDownFormat").value ){
        case 'csv':
            let t = curResponse.features.map(d=>
                d={NAME:d.properties.NAME,
                    FIPS:d.properties.FIPS,
                    YIELD:d.properties.yield,
                    PREDICTION:d.properties.pred,
                    ERROR:d.properties.error})
            let csvRows = [];
            const headers = Object.keys(t[0]);
            csvRows.push(headers.join(','));
            for (const row of t) {
                const values = headers.map(e => {
                    return row[e]
                })
                csvRows.push(values.join(','))
            }
            csvRows = csvRows.join('\n')

            blob = new Blob([csvRows], { type: 'text/csv' });
            url = window.URL.createObjectURL(blob)
            var link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", "prediction_"+curCrop+"_"+curYear+"_"+curMonth+".csv");
            document.body.appendChild(link); // Required for FF

            link.click();
            link.remove();
            break;

        case 'json':
            var link = document.createElement("a");
            // If you don't know the name or want to use
            // the webserver default set name = ''
            link.setAttribute('download', name);
            link.href = "data/corn/2021/1.json";
            link.download = "crop_year_date"
            document.body.appendChild(link);
            link.click();
            link.remove();
            break;
        case 'shp':
        // shpwrite.download(curResponse)
        default:

    }
}

// FIPS of States as dictionary
const stateFIPS = {'01': 'ALABAMA', '02': 'ALASKA', '04': 'ARIZONA', '05': 'ARKANSAS', '06': 'CALIFORNIA', '08': 'COLORADO', '09': 'CONNECTICUT', '10': 'DELAWARE', '11': 'DISTRICT OF COLUMBIA', '12': 'FLORIDA', '13': 'GEORGIA', '15': 'HAWAII', '16': 'IDAHO', '17': 'ILLINOIS', '18': 'INDIANA', '19': 'IOWA', '20': 'KANSAS', '21': 'KENTUCKY', '22': 'LOUISIANA', '23': 'MAINE', '24': 'MARYLAND', '25': 'MASSACHUSETTS', '26': 'MICHIGAN', '27': 'MINNESOTA', '28': 'MISSISSIPPI', '29': 'MISSOURI', '30': 'MONTANA', '31': 'NEBRASKA', '32': 'NEVADA', '33': 'NEW HAMPSHIRE', '34': 'NEW JERSEY', '35': 'NEW MEXICO', '36': 'NEW YORK', '37': 'NORTH CAROLINA', '38': 'NORTH DAKOTA', '39': 'OHIO', '40': 'OKLAHOMA', '41': 'OREGON', '42': 'PENNSYLVANIA', '44': 'RHODE ISLAND', '45': 'SOUTH CAROLINA', '46': 'SOUTH DAKOTA', '47': 'TENNESSEE', '48': 'TEXAS', '49': 'UTAH', '50': 'VERMONT', '51': 'VIRGINIA', '53': 'WASHINGTON', '54': 'WEST VIRGINIA', '55': 'WISCONSIN', '56': 'WYOMING'}
let countyData;
d3.csv("data/county.csv",function (data) {
    countyData=data;
})


function populateDropdowns(){
    const stateDropdown = document.getElementById("runModelStateIn")
    const filterDropdown = document.getElementById("filterStateIn")
    const visDropdown = document.getElementById("plotStateIn")

    stateDropdown.innerHTML = '<option value="">Select a state</option>'
    visDropdown.innerHTML = '<option value="">Select a state</option>'
    filterDropdown.innerHTML = '<option value="all">All</option>'

    for (const [fips, stateName] of Object.entries(stateRange)) {
        const option = document.createElement('option');
        option.value = fips;
        option.textContent = stateName;
        stateDropdown.appendChild(option);
        visDropdown.appendChild(option.cloneNode(true));
        filterDropdown.appendChild(option.cloneNode(true));
    }

    stateDropdown.addEventListener('change', (event) => {
        let tempFIPS =  event.target.value;
        let countyDropdown = document.getElementById("runModelCountyIn")
        countyDropdown.innerHTML = ""
        for (const [_, countyInfo] of Object.entries(curResponse.features)) {
            let countyFIPS = countyInfo.properties.FIPS.toString();
            if (countyFIPS.length===4){
                countyFIPS = "0"+countyFIPS
            }
            if (countyFIPS.slice(0,2) === tempFIPS){
                const option = document.createElement('option');
                option.value = countyFIPS;
                option.textContent = countyInfo.properties.NAME;
                countyDropdown.appendChild(option);
            }
        }
    });


    visDropdown.addEventListener('change', (event) => {
        let tempFIPS =  event.target.value;
        let countyDropdown = document.getElementById("plotCountyIn")
        countyDropdown.innerHTML = ""
        for (const [_, countyInfo] of Object.entries(curResponse.features)) {
            let countyFIPS = countyInfo.properties.FIPS.toString();
            if (countyFIPS.length===4){
                countyFIPS = "0"+countyFIPS
            }
            if (countyFIPS.slice(0,2) === tempFIPS){
                const option = document.createElement('option');
                option.value = countyFIPS;
                option.textContent = countyInfo.properties.NAME;
                countyDropdown.appendChild(option);
            }
        }
    });
}

/**
 *
 * @param mode 'new' or 'update'
 */
function plotFunc(mode='new'){


    var thisFIPS;
    var d = d3.csv("data/county.csv", function (data){
        thisFIPS = data.filter(function (row) {
            // if (Number(row["STATEFP"]) === Number($("#plotStateIn").val()) && row["NAMELSAD"]===$("#plotCountyIn").val() ) {
            if (document.getElementById("plotCountyInput").value === '' && $("#plotCountyIn").val()!=null && Number(row["GEOID"]) === Number($("#plotCountyIn").val()) ) {
                curFIPS = row.GEOID
                curLocation = row["NAMELSAD"]
                document.getElementById("reportTitle").innerHTML = "Historical Yield of "+curLocation
                scatterGen("scatterP",Number(row.GEOID),mode)
                return row.GEOID;
            } else if (row["NAMELSAD"]===$("#plotCountyInput").val() ) {
                curFIPS = row.GEOID
                curLocation = row["NAMELSAD"]
                document.getElementById("reportTitle").innerHTML = "Historical Yield of "+curLocation
                scatterGen("scatterP",Number(row.GEOID),mode)
                return row.GEOID;
            }
    })
        console.log(curFIPS)
        if(highlightedLayers.size===0){
            curMap.eachLayer(function (layer) {
                if (Object.hasOwn(layer, "feature")
                    && Object.hasOwn(layer.feature, "properties")) {
                    // console.log(layer.feature.properties.FIPS)
                    if (layer.feature.properties.FIPS !== undefined
                        && (layer.feature.properties.FIPS).toString() ===  (curFIPS).toString()) {
                        layer.fireEvent('click')
                        console.log("clicked")
                    }
                }
            })
        }
    return thisFIPS
    })

}

const debouncedDelayedScatterGen = (function() {
    let timeout;
    let delayTimeout;

    return function(plotDivID, fipsIn, mode='new') {
        clearTimeout(timeout);
        clearTimeout(delayTimeout);

        timeout = setTimeout(() => {
            // Show loading indicator
            d3.select("#" + plotDivID).html("<p>Loading...</p>");

            delayTimeout = setTimeout(() => {
                scatterGen(plotDivID, fipsIn, mode);
            }, 500); // 500ms delay
        }, 100); // 100ms debounce
    };
})();

/**
 * Generates scatter plot under certain div with county and crop chosen
 *
 * @param plotDivID the DIV element ID (e.g., "scatterP") that plot append to. It will clear previous plots upon calling
 * @param fispIn FIPS code (as number) of the county
 */
function scatterGen(plotDivID,fipsIn,mode='new'){
    // var cornYield = cornYieldData.filter(function(row) {
        // var cornYield = d3.csv("data/corn_yield_US.csv", function(data) {
        var county = cornYieldData.filter(function (row) {
            if (Number(row["FIPS"]) === fipsIn) {
                return row;
            }
        });

        var ymax = Math.max.apply(Math, county.map(function (o) {
            return o.yield;
        }))
        var ymin = Math.min.apply(Math, county.map(function (o) {
            return o.yield;
        }))

        var xmax = Math.max.apply(Math, county.map(function (o) {
            return o.year;
        }))
        var xmin = Math.min.apply(Math, county.map(function (o) {
            return o.year;
        }))


        const statDiv = document.getElementById("statistics")
        let yieldMean = (county.reduce((a,b)=>a.yield+b.yield,0)/county.length)||0

        yieldMean = county.reduce(function(p,c,i){return p+(c.yield-p)/(i+1)},0).toFixed(2);


        let statText = "Maximum yield: "+ymax.toFixed(2).toString()+"<br>"+
            "Minimum yield: "+ymin.toFixed(2).toString()+"<br>"+
            "Average yearly yield: "+yieldMean+""

        // set the dimensions and margins of the graph
        var margin = {
                top: 10,
                right: 50,
                bottom: 10,
                left: 50
            },
            width = 325 - margin.left - margin.right,
            height = 220 - margin.top - margin.bottom;
        if(mode==='new'){
            document.getElementById(plotDivID).innerHTML = ""
            statDiv.innerHTML=statText
        }else {
            const a = document.createElement('div')
            a.innerHTML= statText
            document.getElementById(plotDivID).appendChild(a)
        }


        // append the svg object to the body of the page
        var svg = d3.select("#"+plotDivID)
            .append("svg")
            .attr("preserveAspectRatio", "xMinYMin meet")
            .attr("viewBox", "0 0 350 250")
            .style("background-color", 'white')
            .append("g")
            .attr("transform",
                "translate(" + margin.left + "," + margin.top + ")")
            .style("background-color", 'white');

        // Add X axis --> it is a date format
        var x = d3.scaleLinear()
            .domain([xmin - 5, xmax + 5])
            .range([0, width]);

        svg.append("g")
            .attr("transform", "translate(0," + height + ")")
            .attr("class", "axisBlack")
            .call(d3.axisBottom(x).tickSizeOuter(0))
            .call(d3.axisBottom(x).tickValues(d3.range(xmin, xmax, 10)))
        //     .selectAll("text").remove()

        svg.append("text")
            .attr("x",80)
            .attr("y",10)
            .attr("fill", "black")
            .style("text-anchor", "middle")
            .style("font", "16px verdana")
            .text(curLocation)

        // text label for the x axis
        svg.append("text")
            .attr("transform",
                "translate(" + (width / 2) + " ," +
                (height + margin.top + 25) + ")")
            .attr("fill", "black")
            .style("text-anchor", "middle")
            .style("font", "12px verdana")
            .text("Year")
            .style("background-color", 'white')

        // Add Y axis
        var y = d3.scaleLinear()
            .domain([ymin - 10, ymax + 10])
            .range([height, 0]);

        svg.append("g")
            .attr("class", "axisBlack")
            .call(d3.axisLeft(y).tickSizeOuter(0));

        // text label for the y axis
        svg.append("text")
            .attr("transform", "rotate(-90)")
            .attr("y", margin.left - 95)
            .attr("x", 0 - (height / 2))
            .attr("dy", "1em")
            .attr("fill", "black")
            .style("text-anchor", "middle")
            .style("font", "12px verdana")
            .text("Corn Yield");


        // Add dots
        svg.append('g')
            .selectAll("dot")
            .data(county)
            .enter()
            .append("circle")
            .attr("cx", function (d) {
                return x(d.year);
            })
            .attr("cy", function (d) {
                return y(d.yield);
            })
            .attr("r", 4)
            .style("fill", "#69b3a2")

            .append("title")
            .text(d=>d.year+": "+d.yield)

            .exit()

        svg.append('g')
            .selectAll("dot")
            .data(avePred.filter(function(d) { return d.CROP ===(curCrop=='corn'?'c':'s') && d.FIPS==curFIPS }))
            .enter()
            .append("circle")
            .attr("cx", function (d) {
                return x(d.YEAR);
            })
            .attr("cy", function (d) {
                return y(d.PRED);
            })
            .attr("r", 4)
            .style("fill", "#15559f")

            .append("title")
            .text(d=>"Prediction: \n"+d.YEAR+": "+d.PRED)



        d3.selectAll("circle")
            .on("mouseover",function (d){
                d3.select(this).style("stroke", "black").style("stroke-width", 2)
            })
            .on("mouseout",function (d){
                d3.select(this).style("stroke", "none")
            })
}


async function runModel(){
    // alert("Model started running, it may take a while. Please check the progress later.")
    Toastify({
        text: "Model is running, it may take a while. Please check the progress later.",
        duration: 14000,
        newWindow: true,
        close: true,
        gravity: "top", // `top` or `bottom`
        position: "center", // `left`, `center` or `right`
        stopOnFocus: true, // Prevents dismissing of toast on hover
        offset:{y:"500%"},
        style: {
            background: "linear-gradient(to right, #00b09b, #96c93d)",
        },
        onClick: function(){} // Callback after click
    }).showToast();
    showPopup()
    await new Promise(r => setTimeout(r, 19000));

    Toastify({
        text: "Model finished running.",
        duration: 6000,
        newWindow: true,
        close: true,
        gravity: "top", // `top` or `bottom`
        position: "center", // `left`, `center` or `right`
        stopOnFocus: true, // Prevents dismissing of toast on hover
        offset:{y:"500%"},
        style: {
            background: "linear-gradient(to right, #00b09b, #96c93d)",
        },
        onClick: function(){} // Callback after click
    }).showToast();

}

function showPopup() {
    var progressBar = document.getElementById('progress-bar');
    progressBar.style.width = '0%';  // Reset the progress bar width to 0%
    document.getElementById('popup').style.display = 'block';
    // if (interval) {
    //     clearInterval(interval); // Clear any existing interval
    // }
    loadProgress();
}

function closePopup() {
    document.getElementById('popup').style.display = 'none';
    if (interval) {
        clearInterval(interval); // Clear interval when closing the popup
    }

}

function loadProgress() {
    var progressBar = document.getElementById('progress-bar');
    var width = 0;
    var interval = setInterval(frame, 180); // Update every 20ms

    function frame() {
        if (width >= 100) {
            clearInterval(interval);
        } else {
            width++;
            progressBar.style.width = width + '%';
        }
    }
}


// Below is for topnav bar functionallities
// Get the settings button
// Get the popup
document.addEventListener('DOMContentLoaded', function() {
    var settingsPopup = document.getElementById("settingsPopup");
    var startColorPicker = document.getElementById("startColorPicker");
    var endColorPicker = document.getElementById("endColorPicker");
    var legendPreview = document.getElementById("legendPreview");
    var resetColorSchemeBtn = document.getElementById("resetColorScheme");
    var baseMapSelector = document.getElementById("popupBaseMapSelector");

    var choroplethOpacitySlider = document.getElementById("choroplethOpacity");

    var choroplethOpacityValue = document.getElementById("choroplethOpacityValue");

    function updateOpacityValue(slider, valueSpan) {
        valueSpan.textContent = slider.value;
    }

    choroplethOpacitySlider.oninput = function() {
        updateOpacityValue(this, choroplethOpacityValue);
    };

    function updateLegendPreview() {
        var gradient = `linear-gradient(to right, ${startColorPicker.value}, ${endColorPicker.value})`;
        legendPreview.style.background = gradient;
    }

    window.openSettingsPopup = function() {
        if (settingsPopup) {
            startColorPicker.value = customStartColor;
            endColorPicker.value = customEndColor;
            baseMapSelector.value = currentBaseMap;
            settingsPopup.style.display = "block";
            updateLegendPreview();
        } else {
            console.error("Settings popup element not found");
        }
    }

    if (settingsPopup) {
        var closeBtn = settingsPopup.querySelector(".close");
        var applyBtn = document.getElementById("applySettings");
        var cancelBtn = document.getElementById("cancelSettings");

        function closePopup() {
            settingsPopup.style.display = "none";
        }

        if (closeBtn) {
            closeBtn.onclick = closePopup;
        }

        if (applyBtn) {
            applyBtn.onclick = function() {
                customStartColor = startColorPicker.value;
                customEndColor = endColorPicker.value;
                currentBaseMap = baseMapSelector.value;

                var choroplethOpacity = parseFloat(choroplethOpacitySlider.value);
                // var legendOpacity = parseFloat(legendOpacitySlider.value);
                // var controlBarOpacity = parseFloat(controlBarOpacitySlider.value);

                applyChoroplethOpacity(choroplethOpacity);

                updateColorScheme();
                changeBaseMap(currentBaseMap);
                closePopup();
            }
        }

        if (cancelBtn) {
            cancelBtn.onclick = closePopup;
        }

        if (resetColorSchemeBtn) {
            resetColorSchemeBtn.onclick = function() {
                startColorPicker.value = defaultStartColor;
                endColorPicker.value = defaultEndColor;
                updateLegendPreview();
            }
        }

        startColorPicker.addEventListener('input', updateLegendPreview);
        endColorPicker.addEventListener('input', updateLegendPreview);

        window.onclick = function(event) {
            if (event.target === settingsPopup) {
                closePopup();
            }
        }
    } else {
        console.error("Settings popup element not found");
    }
});

function updateColorScheme() {
    // Update the color scale
    if (curProperty === "pred" || curProperty === "yield") {
        curColorScale = d3.scaleLinear()
            .domain([d3.min(curResponse.features, function(d) { return d.properties[curProperty]; }),
                d3.max(curResponse.features, function(d) { return d.properties[curProperty]; })])
            .range([customStartColor, customEndColor]);
    } else if (curProperty === "error") {
        var errorExtent = d3.extent(curResponse.features, function(d) { return d.properties.error; });
        var maxAbsError = Math.max(Math.abs(errorExtent[0]), Math.abs(errorExtent[1]));
        curColorScale = d3.scaleLinear()
            .domain([-maxAbsError, 0, maxAbsError])
            .range([customStartColor, "#FFFFFF", customEndColor]);
    }

    // Update the map
    if (curLayer) {
        curLayer.eachLayer(function (layer) {
            if (layer.feature) {
                layer.setStyle({
                    fillColor: curColorScale(layer.feature.properties[curProperty])
                });
            }
        });
    }

    // Update the legend
    updateLegend();
}

function applyChoroplethOpacity(opacity) {
    if (curLayer) {
        curLayer.eachLayer(function (layer) {
            if (layer.setStyle) {
                layer.setStyle({fillOpacity: opacity});
            }
        });
    }
}

function applyLegendOpacity(opacity) {
    if (curLegend) {
        var legendContainer = curLegend.getContainer();
        if (legendContainer) {
            legendContainer.style.opacity = opacity;
        }
    }
}

function applyControlBarOpacity(opacity) {
    var controlBar = document.querySelector('.leaflet-control-bar');
    if (controlBar) {
        controlBar.style.opacity = opacity;
    }
}

function updateLegend() {
    if (curLegend) {
        curMap.removeControl(curLegend);
    }
    createLegend(curMap);
}

// tooltip
document.addEventListener('DOMContentLoaded', function() {
    // Function to create and manage tooltips
    function createTooltip(element, position) {
        if (!element.hasAttribute('data-tooltip')) return;

        const tooltip = document.createElement('div');
        tooltip.className = 'custom-tooltip';
        tooltip.textContent = element.getAttribute('data-tooltip');
        document.body.appendChild(tooltip);

        element.addEventListener('mouseenter', function(e) {
            const rect = this.getBoundingClientRect();
            if (position === 'right') {
                tooltip.style.left = `${rect.right + 10}px`;
                tooltip.style.top = `${rect.top + rect.height / 2}px`;
                tooltip.style.transform = 'translateY(-50%)';
            } else if (position === 'bottom') {
                tooltip.style.left = `${rect.left + rect.width / 2}px`;
                tooltip.style.top = `${rect.bottom + 10}px`;
                tooltip.style.transform = 'translateX(-50%)';
            }
            tooltip.style.opacity = '1';
        });

        element.addEventListener('mouseleave', function() {
            tooltip.style.opacity = '0';
        });
    }

    // Create tooltips for sidebar tabs
    const sidebarTabs = document.querySelectorAll('.sidebar-tabs > li > a');
    sidebarTabs.forEach(tab => createTooltip(tab, 'right'));

    // Create tooltips for top navigation bar items (excluding the first item)
    const topNavLinks = document.querySelectorAll('#bar.topnav > a:not(:first-child)');
    topNavLinks.forEach(link => createTooltip(link, 'bottom'));
});

function openReferencePopup() {
    document.getElementById('referencePopup').style.display = 'block';
}

function openProfilePopup() {
    document.getElementById('profilePopup').style.display = 'block';
}

function closePopup(popupId) {
    document.getElementById(popupId).style.display = 'none';
}


// Close popup when clicking outside of it
window.onclick = function(event) {
    if (event.target.className === 'popup') {
        event.target.style.display = 'none';
    }
}



function makeDraggable(control) {
    var controlContainer = control.getContainer();
    L.DomEvent.disableClickPropagation(controlContainer);
    L.DomEvent.disableScrollPropagation(controlContainer);

    // Prevent map drag when dragging the control
    L.DomEvent.on(controlContainer, 'mousedown', function (e) {
        L.DomEvent.stopPropagation(e);
    });

    $(controlContainer).draggable({
        start: function(event, ui) {
            // Disable pointer events on the map during drag
            $('.leaflet-container').css('pointer-events', 'none');
        },
        stop: function(event, ui) {
            // Re-enable pointer events on the map after drag
            $('.leaflet-container').css('pointer-events', 'auto');
        }
    });

    // Prevent click events from propagating to the map
    $(controlContainer).on('click dblclick', function(e) {
        e.stopPropagation();
    });
}