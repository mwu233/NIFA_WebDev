// Javascripts by Meiliu Wu, 2022

/* Map of GeoJSON data from crop_2021.geojson */

var curLayer;
var curMap;
var curResponse;
var curAttrs;
//function to instantiate the Leaflet map
function createMap(){
    //create the map
    var map = L.map('map', {
        center: [43,-93],
        zoom: 5.5,
        zoomControl: false
    });

    curMap = map;

    //add OSM base tilelayer
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19
    }).addTo(curMap);

    //call getData function
    getData(curMap);

};

//function to retrieve the data and place it on the map
function getData(map){
    //load the data
    $.ajax("data/crop_2020.json", {
        dataType: "json",
        success: function(response){
            // create an attributes array
            var attributes = processData(response);

            // update global variables curAttrs and curResponse
            curAttrs = attributes;
            curResponse = response;

            // create initial chart on the left panel with average data
            // createChart(response,attributes);

            // create proportional symbols, with initial index as 0, i.e., 2010
            curLayer = createChoropleth(response, map, attributes, 0);
            map.addLayer(curLayer);

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

};

function processData(data){
    //empty array to hold attributes
    var attrs = [];

    //properties of the first feature in the dataset
    var properties = data.features[0].properties;

    //push each attribute name into attributes array
    for (var attribute in properties){
        //only take attributes with population values
        if (attribute.indexOf("8") > -1){
            attrs.push(attribute);
        };
    };
    // return the pop attrs retrieved from the first feature
    return attrs;
};

function createChoropleth(data, map, attrs, idx){
    // remove current layer if exists
    if (curLayer){
        map.removeLayer(curLayer);
    };

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
};

// color scheme referring https://leafletjs.com/examples/choropleth/
function getColor(d) {
    return d > 190 ? '#800026' :
           d > 160  ? '#BD0026' :
           d > 130  ? '#FC4E2A' :
           d > 100   ? '#FEB24C' :
           '#FFEDA0';
}


function style(feature) {
    return {
        fillColor: getColor(feature.properties.pred),
        weight: 2,
        opacity: 1,
        color: 'white',
        dashArray: '3',
        fillOpacity: 0.65
    };
}

function highlightFeature(e) {
    var layer = e.target;

    layer.setStyle({
        weight: 5,
        color: '#666',
        dashArray: '',
        fillOpacity: 0.7
    });

    layer.bringToFront();

    var content = '<h4>Crop Yield Information in 2020</h4>' +
                '<b>' + layer.feature.properties.NAMELSAD + '</b><br />' +
                'Yield: ' + Number(layer.feature.properties.yield).toFixed(2) + ' unit / mi<sup>2</sup><br />' +
                'Prediction: ' + Number(layer.feature.properties.pred).toFixed(2) + ' unit / mi<sup>2</sup><br />' +
                'Error: ' + Number(layer.feature.properties.error).toFixed(2) + ' unit / mi<sup>2</sup>';
    updateHoverControl(content);
}

function resetHighlight(e) {
    curLayer.resetStyle(e.target);
    var content = "<h4>Crop Yield Information in 2020</h4>" + "Hover over a county";
    updateHoverControl(content);
}

function zoomToFeature(e) {
    curMap.fitBounds(e.target.getBounds());
}

function onEachFeature(feature, layer) {
    layer.on({
        mouseover: highlightFeature,
        mouseout: resetHighlight,
        click: zoomToFeature
    });
}

function createHoverControl(response, map, attrs){
    var info = L.control();

    info.onAdd = function (map) {
        var container = L.DomUtil.create('div', 'info'); // create a div with a class "info"

        //add temporal legend div to container
        $(container).append('<div id="temporal-info">');

        return container;
    };

    info.addTo(map);

    var content = "<h4>Crop Yield Information in 2020</h4>" + "Hover over a county";
    updateHoverControl(content);
}

function updateHoverControl(content){
    $('#temporal-info').html(content);
}

function createLegend(map){
    var legend = L.control({position: 'bottomright'});

    legend.onAdd = function (map) {

        var div = L.DomUtil.create('div', 'info legend'),
            grades = [64, 100, 130, 160, 190],
            labels = [];

        div.innerHTML += "Crop Prediction (2020)<br>"
        // loop through our density intervals and generate a label with a colored square for each interval
        for (var i = 0; i < grades.length; i++) {
            div.innerHTML +=
                '<i style="background:' + getColor(grades[i] + 1) + '"></i> ' +
                grades[i] + (grades[i + 1] ? '&ndash;' + grades[i + 1] + '<br>' : '+');
        }

        return div;
    };

    legend.addTo(map);
}

function createSideMenu(map) {
    var sidebar = L.control.sidebar('sidebar').addTo(map);
}

function createMenu(map){
    var controlBar = L.control.bar('bar',{
        position:'topcenter',
        visible:true
    });
    map.addControl(controlBar);
}

$(document).ready(createMap);