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
let curFIPS;

let statesData; //State boundaries
$.ajax("data/gz_2010_us_040_00_20m.json", {
    dataType: "json",
    success: function(response){
        statesData = response;
    }
})
let countyBoundaries; //County boundaries
$.ajax("data/gz_2010_us_050_00_20m.json", {
    dataType: "json",
    success: function(response){
        countyBoundaries = response;
    }
})

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
function DrawnFeature(id,layer,type,intersectCounty,intersectFIPS){
    this.id = id;
    this.layer = layer;
    this.type = type;
    this.intersectCounty = intersectCounty;
    this.intersectFIPS = intersectFIPS;
}
d3.csv("data/average_pred.csv", function(data) {
    avePred= data;
})
//function to instantiate the Leaflet map
function createMap(){
    //create the map
    var map = L.map('map', {
        center: [43,-93],
        zoom: 5.5,
        zoomDelta: 0.25,
        zoomSnap: 0,
        zoomControl: false,
        maxBounds: [[20,-130],[52,-60]],
        maxBoundsViscosity: 1.0,
    });
    map.doubleClickZoom.disable();
    curMap = map;

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

    //call getData function
    getData(curMap, curCrop, curYear, curMonth, curLocation);

    // leaflet draw control
    map.addLayer(drawnFeatures);
    drawControl = new L.Control.Draw({
        edit: {
            featureGroup: drawnFeatures },
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

    map.on('draw:created', function (e) {
        var type = e.layerType;
        var layer = e.layer;
        console.log(type);
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

function removeAllDrawn(){
    drawnFeatures.clearLayers();
    drawnFeaturesDict = {};
    document.getElementById("drawnFeaturesList").innerHTML = "";


}

function updateDrawnFeaturesDict(){



    function upperInitial(str) {if (str.length === 0) {return str;} const firstChar = str.charAt(0).toUpperCase();const restOfString = str.slice(1);return firstChar + restOfString;}
    num = 1;
    $("#drawnFeaturesList").empty();
    for (const [key, value] of Object.entries(drawnFeaturesDict)) {
        let msg = "<li>" +num+". "+ upperInitial(value.type) +"     <button onclick='fitBoundsByID("+key.toString()+")'"  +">GO</button>"  +"</li>";
        msg+= "<ul>";
        msg += "Selected locations: ";
        msg += value.intersectCounty.join(", ");
        $("#drawnFeaturesList").append(msg);
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
    // let filename = "data_"+Date.now()+".json";
    // let dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data));
    // let downloadAnchorNode = document.createElement('a');
    // downloadAnchorNode.setAttribute("href", dataStr);
    // downloadAnchorNode.setAttribute("download", filename);
    // document.body.appendChild(downloadAnchorNode); // required for firefox
    // downloadAnchorNode.click();
    // downloadAnchorNode.remove();
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

function changeBaseMap(){
    var basemaps = {
        'OpenStreetMap': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap contributors'
        }),
        'CartoDB Positron': L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© CartoDB'
        }),
        'Esri WorldTerrain':  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Terrain_Base/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles &copy; Esri &mdash; Source: USGS, Esri, TANA, DeLorme, and NPS',
            maxZoom: 13
        }),
        'USGS USTopo': L.tileLayer('https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 20,
            attribution: 'Tiles courtesy of the <a href="https://usgs.gov/">U.S. Geological Survey</a>'
        }),
        'Esri WorldShadedRelief':L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles &copy; Esri &mdash; Source: Esri',
            maxZoom: 13
        }),
        'Esri NatGeoWorldMap': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles &copy; Esri &mdash; National Geographic, Esri, DeLorme, NAVTEQ, UNEP-WCMC, USGS, NASA, ESA, METI, NRCAN, GEBCO, NOAA, iPC',
            maxZoom: 16
        })
    };
    curTileLayer = basemaps[$('#basemapInput').val()]
        curTileLayer.addTo(curMap);

}

//function to retrieve the data and place it on the map
function getData(map, crop, year, month, location){
    //load the data
    var jsonPath = "data/" + crop + "/" + year + "/" + month + ".json";

    // $.ajax("data/crop_2020.json", {
    $.ajax(jsonPath, {
        dataType: "json",
        success: function(response){
            // create an attributes array
            var attributes = processData(response);

            // update global variables curAttrs and curResponse
            curAttrs = attributes;
            curResponse = response;
            updateTable();

            // create initial chart on the left panel with average data
            // createChart(response,attributes);

            // create proportional symbols, with initial index as 0, i.e., 2010


            curLayer = createChoropleth(response, map, attributes, 0);
            map.addLayer(curLayer);

            L.geoJson(countyBoundaries, {
                'type': 'Feature',
                style:{
                    weight: 1,
                    fill: false,
                    color: 'gray',
                    dashArray: '3',
                }}).addTo(curMap);
            //US States Boundary layer
            L.geoJson(statesData, {
                'type': 'Feature',
                style:{
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
            // createSequenceControls(response, map, attributes); //add response here

            // create legend
            createLegend(map);

            // // update legend
            // updateLegend(map, attributes[0]);

            createSideMenu(map);

            createMenu(map);

        }
    });
}

function processData(data){
    //empty array to hold attributes
    //var attrs = [];

    //properties of the first feature in the dataset
    var properties = data.features[0].properties;

    //push each attribute name into attributes array
    // for (var attribute in properties){
    //     //only take attributes with population values
    //     if (attribute.indexOf("8") > -1){
    //         attrs.push(attribute);
    //     };
    // };
    // // return the pop attrs retrieved from the first feature
    // return attrs;
    return properties;
}

function createChoropleth(data, map, attrs, idx){
    // remove current layer if exists
    if (curLayer){
        map.removeLayer(curLayer);
    }

    //create a new/updated Leaflet GeoJSON layer and return it to the map
    // var geoJsonLayer = L.geoJson(data, {
    //     // for filtering with min and max
    //     filter: function(feature, layer) {
    //         return filterMinMax(feature, layer, idx);
    //     },
    //     // create circle markers for the metro points
    //     pointToLayer: function(feature, latlng){
    //         return pointToLayer(feature, latlng, attrs, idx);
    //     }
    // });
    var geoJsonLayer = L.geoJson(data, {
        style: style,
        onEachFeature: onEachFeature
    });

    return geoJsonLayer;
}



function waitForElement(){
    if(typeof curMap !== "undefined"){
        //variable exists, do what you want
        curMap.on('moveend', function() {
            let bounds = curMap.getBounds()
        })
    }
    else{
        setTimeout(waitForElement, 250);
    }
}
waitForElement()

// color scheme referring https://leafletjs.com/examples/choropleth/
function getColor(d) {

    if (curProperty === "error") {
    // "#009392",
    // "#39b185",
    // "#9ccb86",
    //         "#e9e29c",
    //         "#eeb479",
    //         "#e88471",
    //         "#cf597e";
        return d < -2 ? "#009392" :
            d < -1 ? "#39b185" :
                d < 1 ? "#e9e29c":
                    d < 2 ? "#e88471":
                        "#cf597e";
    }
    else {
        if (curCrop === "corn") {
            return d > 190 ? '#800026' :
                d > 160  ? '#BD0026' :
                    d > 130  ? '#FC4E2A' :
                        d > 100   ? '#FEB24C' :
                            '#FFEDA0';
        }
        else { // soybean
            return d > 60 ? '#800026' :
                d > 55  ? '#BD0026' :
                    d > 50  ? '#FC4E2A' :
                        d > 45   ? '#FEB24C' :
                            '#FFEDA0';
        }
    }

}

function style(feature) {
    return {
        //fillColor: getColor(feature.properties.pred), // TODO: change to curProperty
        fillColor: getColor(feature.properties[curProperty]), // TODO: change to curProperty
        weight: 0,
        opacity: 1,
        color: 'white',
        dashArray: '3',
        fillOpacity: 0.65
    };
}

let curMouserOverFIPS = null;
let highlightedLayers = []
function resetAllHighlight(){
    if (highlightedLayers.length > 0) {
        highlightedLayers.forEach(layer => {
            curLayer.resetStyle(layer)
        })
        highlightedLayers = []
    }
}
function highlightHelper(e,color='#68da4c',type='e') {
    var layer;
    if (type ==='layer'){
        layer = e;
    } else{
        layer = e.target;
    }

    curMouserOverFIPS = layer.feature.properties.FIPS;
    layer.setStyle({
        weight: 5,
        color: color==="default"?'#666':color,
        dashArray: '',
        fillOpacity: 0.7
    });

    layer.bringToFront();

    if(highlightedLayers.length>0 && color==='default'){return} //default color means not clicked
    var content = '<h4>Crop Yield Information</h4>' +
                '<b>' + layer.feature.properties.NAMELSAD + '</b><br />' +
                'Crop type: ' + curCrop + '<br />' +
                'Date: ' + curDate[curMonth] + "/" + curYear + '<br />' +
                'Yield: ' + Number(layer.feature.properties.yield).toFixed(2) + ' unit / mi<sup>2</sup><br />' +
                'Prediction: ' + Number(layer.feature.properties.pred).toFixed(2) + ' unit / mi<sup>2</sup><br />' +
                'Error: ' + Number(layer.feature.properties.error).toFixed(2) + ' unit / mi<sup>2</sup>';
    if(highlightedLayers.length===0||color!=='default') {
        updateTemporalInfo(content);
    }
    // update a graph
    var cornYield = d3.csv("data/corn_yield_US.csv", function(data) {
        var county = data.filter(function(row) {
            if (Number(row["FIPS"]) === layer.feature.properties.FIPS)
            {
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

        // set the dimensions and margins of the graph
        var margin = {
                top: 10,
                right: 50,
                bottom: 10,
                left: 50
            },
            width = 325 - margin.left - margin.right,
            height = 220 - margin.top - margin.bottom;


        // append the svg object to the body of the page
        if(layer.feature.properties.FIPS===curMouserOverFIPS) {
            d3.select("#temporal-info").selectAll("svg").remove();
            const svg = d3.select("#temporal-info")
                .append("svg")
                .attr("preserveAspectRatio", "xMinYMin meet")
                .attr("viewBox", "0 0 300 250")
                .append("g")
                .attr("transform",
                    "translate(" + margin.left + "," + margin.top + ")");

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

            // text label for the x axis
            svg.append("text")
                .attr("transform",
                    "translate(" + (width / 2) + " ," +
                    (height + margin.top + 25) + ")")
                .attr("fill", "black")
                .style("text-anchor", "middle")
                .style("font", "12px verdana")
                .text("Year");

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

            //Add the line
            // svg.append("path")
            //     .datum(county)
            //     .attr("fill", "none")
            //     .attr("stroke", "black")
            //     .attr("class", "axisBlack")
            //     .attr("stroke-width", 1.25)
            //     .attr("d", d3.line()
            //         .curve(d3.curveBasis) // Just add that to have a curve instead of segments
            //         .x(function (d) {
            //             return x(d.year)
            //         })
            //         .y(function (d) {
            //             return y(d.yield)
            //         })
            //     )

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

        }
    });
}

function highlightFeature(e) {
    if(doubleClicked) return
    if(highlightedLayers.includes(e.target)) return;
    highlightHelper(e)
}

function resetHighlight(e) {
    if(doubleClicked) return

    if (highlightedLayers.includes(e.target)) return;
    curLayer.resetStyle(e.target);
    e.target.bringToBack()
    var content = "<h4>Crop Yield Information</h4>" + "Hover over a county";

    if(highlightedLayers.length>0) return;
    updateTemporalInfo(content);
}

// too large, use zoomToState instead
function zoomToFeature(e) {
    curMap.fitBounds(e.target.getBounds());
    updateClicked(e);
}

function zoomToState(e) {
    setTimeout(function() {
        if(highlightedLayers.includes(e.target)){
            highlightedLayers = highlightedLayers.filter(d=>d!==e.target)
            resetHighlight(e)
            if(ctrlKeyDown){
                multiChoice = multiChoice.filter(d=>d!==e.target.feature.properties.FIPS)
            }
            return
        }

        if (ctrlKeyDown) {
            highlightHelper(e, '#68da4c')
            highlightedLayers.push(e.target)
        } else {
            resetAllHighlight()
            highlightedLayers.push(e.target)
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
    $("#plotStateIn").html(options)
    console.log(multiChoice)
    if(multiChoice.length>1){
        plotFunc('update')
    }else{
        plotFunc()
    }

}

let ctrlKeyDown = false;
let multiChoice = [];
document.addEventListener('keydown', function(event) {
    if(event.key === "Control") {
        ctrlKeyDown = true;
        // console.log("Control key is pressed.");
    }
});
document.addEventListener('keyup', function(event) {
    if(event.key === "Control") {
        ctrlKeyDown = false;
        // console.log("Control key is released.");
    }
});

let doubleClicked = false;
document.addEventListener('dblclick', function(event) {
    doubleClicked = !doubleClicked;

    // if(doubleClicked){
    //     curMap.dragging.disable()
    //     curMap.scrollWheelZoom.disable()
    // }else {
    //     curMap.dragging.enable()
    //     curMap.scrollWheelZoom.enable()
    //     curLayer.resetStyle()
    // }

})
function onEachFeature(feature, layer) {
    layer.on({
        mouseover: highlightFeature,
        mouseout: resetHighlight,
        click:zoomToState,
    });
}

var curInfo;
var curLegend;

function createHoverControl(response, map, attrs){
    var info = L.control();

    info.onAdd = function (map) {
        var container = L.DomUtil.create('div', 'info'); // create a div with a class "info"

        //add temporal legend div to container
        $(container).append('<div id="temporal-info">');

        return container;
    };

    curInfo = info;
    curInfo.addTo(map);

    var content = "<h4>Crop Yield Information</h4>" + "Hover over a county";
    updateTemporalInfo(content);
}

function updateTemporalInfo(content,update=false){
    // if(highlightedLayers.length>0 ) return
    $('#temporal-info').html(content);
}

function createLegend(map){
    var legend = L.control({position: 'bottomright'});

    legend.onAdd = function (map) {

        var div = L.DomUtil.create('div', 'info legend');
        var grades; //  [64, 100, 130, 160, 190] [64, 100, 130, 160, 190]
        // var labels = [];

        // TODO: curProperty = 'pred' / 'yield' / 'error'- color scheme should be different
        if (curProperty === "pred") {
            div.innerHTML += "Crop Prediction<br>";
        }
        else if (curProperty === "yield") {
            div.innerHTML += "Crop Yield<br>";
        }

        if (curProperty === "error") {
            grades = [-15, -2, -1, 1, 2];
            div.innerHTML += "Crop Prediction Errors<br>"
            for (var i = 0; i < grades.length; i++) {
                div.innerHTML +=
                    '<i style="background:' + getColor(grades[i] + 0.001) + '"></i> ' +
                    grades[i] + (grades[i + 1] ? '&nbsp;&ndash;&nbsp;' + grades[i + 1] + '<br>' : '+');
            }
        }
        else {
            if (curCrop === "corn") {
                grades = [60, 100, 130, 160, 190];
            }
            else { // soybean
                grades = [20, 45, 50, 55, 60];
            }
            // loop through our density intervals and generate a label with a colored square for each interval
            for (var i = 0; i < grades.length; i++) {
                div.innerHTML +=
                    '<i style="background:' + getColor(grades[i] + 1) + '"></i> ' +
                    grades[i] + (grades[i + 1] ? '&ndash;' + grades[i + 1] + '<br>' : '+');
            }
        }

        return div;
    };

    curLegend = legend;
    curLegend.addTo(map);
}

window.onresize = function(event) {
    var windowWidth = window.innerWidth;
    var windowHeight = window.innerHeight;


    const legendDiv = document.getElementsByClassName('info legend')[0]
    const curInfoDiv = document.getElementsByClassName('info')[0]


    // 太丑了
    // var component1Width = windowWidth * 0.2; // 30% of window width
    // var component1Height = windowHeight * 0.2; // 20% of window height
    //
    // var component2Width = windowWidth * 0.2; // 40% of window width
    // var component2Height = windowHeight * 0.2; // 30% of window height
    //
    // legendDiv.style.width = component1Width + 'px';
    // legendDiv.style.height = component1Height + 'px';
    //
    // curInfoDiv.style.width = component2Width + 'px';
    // curInfoDiv.style.height = component2Height + 'px';

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
function toggleTable() {
    if(!curTable){

        let tableDiv = document.createElement('div');
        tableDiv.id = 'tablePop';
        tableDiv.style.width = '300px';
        tableDiv.style.height = '300px';
        tableDiv.style.overflow = 'auto';
        tableDiv.style.position = 'absolute';
        curTable = L.Draggable(tableDiv).addTo(curMap);
        curTable.enable();
        let t = curResponse.features.map(d=>
            d={NAME:d.properties.NAME,
                FIPS:d.properties.FIPS,
                YIELD:d.properties.yield,
                PREDICTION:d.properties.pred,
                ERROR:d.properties.error})

        var table = new Tabulator("#tablePop",{
            data:t,
            autoColumns: true,
            height:"280px",
        })


    }

    if(curTable.isOpen()){
        curTable.close();
    }
    else{
        curTable.open();
    }
}

var sidebar
function createSideMenu(map) {

    L.Control.Sidebar.prototype._onClick = function() {
        var tabId = this.querySelector('a').hash.slice(1);

            // Call the original _onClick function for other tabs
            if (L.DomUtil.hasClass(this, 'active')) {
                this._sidebar.close();
            } else if (!L.DomUtil.hasClass(this, 'disabled')) {
                this._sidebar.open(tabId);
                if (tabId === 'run') {
                    // console.log("change base map to none")
                    curTileLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Terrain_Base/MapServer/tile/{z}/{y}/{x}', {
                        attribution: 'Tiles &copy; Esri &mdash; Source: USGS, Esri, TANA, DeLorme, and NPS',
                        maxZoom: 13
                    })
                    curTileLayer.addTo(curMap);
                } else {
                    // console.log("change base map to osm")
                    changeBaseMap()
                }
            }

    };

    sidebar = L.control.sidebar('sidebar').addTo(map);

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
autocomplete(document.getElementById("modelLocationInput"), locations);
autocomplete(document.getElementById("plotCountyIn"), locations);

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
        d={NAME:d.properties.NAME,
            FIPS:d.properties.FIPS,
            YIELD:d.properties.yield,
            PREDICTION:d.properties.pred,
            ERROR:d.properties.error})

    var table = new Tabulator("#table-view",{
        data:t,
        autoColumns: true,
        height:"311px",
    })
}


$(document).ready(createMap);

//Map download functions :
function filter(node) {
    if (node.classList) return (  !node.classList.contains("leaflet-left") && !node.classList.contains("topnav") );
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
            curTileLayer.getContainer().style.display = 'none'
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

        curLegend.setPosition('topright')
        curInfo.setPosition('bottomleft')
        drawControl.setPosition('bottomleft')
        bigDiv.insertBefore(heading,bigDiv.firstChild)

        mapdiv.style.width = '100%'
        mapdiv.style.height = '100vh'

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
                drawControl.setPosition('bottomright')
                curLegend.setPosition('bottomright')
                curInfo.setPosition('topright')

            }
            curTileLayer.getContainer().style.display = 'block'
            mapdiv.style.width = '100vw'
            mapdiv.style.height = '100vh'

        });

}
/**
function downloadPDFFunc(divID){
    const doc = new jspdf.jsPDF()
    doc.html(document.getElementById('report'), {
        callback: function (doc) {

            let svgStr = serializer.serializeToString(document.getElementById('scatterP').innerHTML)
            doc.addSvgAsImage(document.getElementById('scatterP').innerHTML,
                0, 0, 210, 297)

            doc.save('a4.pdf')
        }
    })

}
**/

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

$(document).ready(function (){
    $("#plotCountyIn").on("input",function (){

        let inName = this.value

        let options=''
        countyData.forEach(d=>{
            if (inName===d.NAMELSAD){
                options += '<option value="'+String(d.STATEFP)+'">'+stateFIPS[d.STATEFP]+'</option>'
            }
        })
        $("#plotStateIn").html(options)

    })

    $("#modelLocationInput").on("input",function (){

        let inName = this.value

        let options=''
        countyData.forEach(d=>{
            if (inName===d.NAMELSAD){
                options += '<option value="'+String(d.STATEFP)+'">'+stateFIPS[d.STATEFP]+'</option>'
            }
        })
        $("#runModelStateIn").html(options)

    })

    $("#locationInput").on("input",function (){
        let inName = this.value

        let options=''
        countyData.forEach(d=>{
            if (inName===d.NAMELSAD){
                options += '<option value="'+String(d.STATEFP)+'">'+stateFIPS[d.STATEFP]+'</option>'
            }
        })
        $("#runModelStateIn").html(options)

    })

})




/**
 *
 * @param mode 'new' or 'update'
 */
function plotFunc(mode='new'){


    var thisFIPS;
    var d = d3.csv("data/county.csv", function (data){
        thisFIPS = data.filter(function (row) {
            if (Number(row["STATEFP"]) === Number($("#plotStateIn").val()) && row["NAMELSAD"]===$("#plotCountyIn").val() ) {
                curFIPS = row.GEOID
                curLocation = row["NAMELSAD"]
                document.getElementById("reportTitle").innerHTML = "Historical Yield of "+curLocation
                scatterGen("scatterP",Number(row.GEOID),mode)
                return row.GEOID;
            }
    })
        console.log(curFIPS)
        if(highlightedLayers.length===0){
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

/**
 * Generates scatter plot under certain div with county and crop chosen
 *
 * @param plotDivID the DIV element ID (e.g., "scatterP") that plot append to. It will clear previous plots upon calling
 * @param fispIn FIPS code (as number) of the county
 */
function scatterGen(plotDivID,fipsIn,mode='new'){
    var cornYield = d3.csv("data/corn_yield_US.csv", function(data) {
        var county = data.filter(function (row) {
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
    })
}

function plotPredicted(filename,variable){

}

function captureAndDownloadWindow() {

}

function runModel(){
    alert("Model started running, it may take a while. Please check the progress later.")
}