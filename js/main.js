// Javascripts by Meiliu Wu, 2022

/* Map of GeoJSON data from crop_2021.geojson */

var curLayer;
var curMap;
var curResponse;
var curAttrs;

var curLocation;
var curCrop;
var curYear;
var curMonth;
var curProperty;

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

    curCrop = 'corn'; // or 'soybean'
    curYear = '2021'; // 2010-2021
    curMonth = '0'; // 0-9
    curProperty = 'pred'; // or 'yield', 'error'- color scheme should be different
    curLocation = '';

    //call getData function
    getData(curMap, curCrop, curYear, curMonth, curLocation);

};

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

            // create initial chart on the left panel with average data
            // createChart(response,attributes);

            // create proportional symbols, with initial index as 0, i.e., 2010
            curLayer = createChoropleth(response, map, attributes, 0);
            map.addLayer(curLayer);

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

};

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

    var content = '<h4>Crop Yield Information</h4>' +
                '<b>' + layer.feature.properties.NAMELSAD + '</b><br />' +
                'Crop type: ' + curCrop + '<br />' +
                'Date: ' + curDate[curMonth] + "/" + curYear + '<br />' +
                'Yield: ' + Number(layer.feature.properties.yield).toFixed(2) + ' unit / mi<sup>2</sup><br />' +
                'Prediction: ' + Number(layer.feature.properties.pred).toFixed(2) + ' unit / mi<sup>2</sup><br />' +
                'Error: ' + Number(layer.feature.properties.error).toFixed(2) + ' unit / mi<sup>2</sup>';
    updateHoverControl(content);

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
        var svg = d3.select("#temporal-info")
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
                "translate(" + (width/2) + " ," +
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
            .attr("x",0 - (height / 2))
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
            .attr("cx", function (d) { return x(d.year); } )
            .attr("cy", function (d) { return y(d.yield); } )
            .attr("r", 4)
            .style("fill", "#69b3a2")
    });
}

function resetHighlight(e) {
    curLayer.resetStyle(e.target);
    var content = "<h4>Crop Yield Information</h4>" + "Hover over a county";
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
    updateHoverControl(content);
}

function updateHoverControl(content){
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

var locations = ['Cuming County', 'Lancaster County', 'Nuckolls County', 'Minnehaha County', 'Hancock County', 'Allen County', 'Sauk County', 'Stone County', 'Henry County', 'Lake County', 'Barton County', 'Keith County', 'Phelps County', 'Menominee County', 'Jasper County', 'Steuben County', 'Fayette County', 'Greenwood County', 'Alpena County', 'Doniphan County', 'Clare County', 'Republic County', 'Webster County', 'Hancock County', 'Hutchinson County', 'Marquette County', 'Clay County', 'Knox County', 'Livingston County', 'Dakota County', 'Leelanau County', 'Butler County', 'Ohio County', 'Moody County', 'Decatur County', 'Perry County', 'Boyd County', 'Mille Lacs County', 'Walsh County', 'Morgan County', 'Portage County', 'Polk County', 'Benton County', 'Douglas County', 'Wabash County', 'Huntington County', 'Decatur County', 'Wabash County', 'Allen County', 'Marshall County', 'Thomas County', 'Sioux County', 'Fillmore County', 'Lac qui Parle County', 'Pierce County', 'McLean County', 'Phillips County', 'Holt County', 'Johnson County', 'La Crosse County', 'Bond County', 'Brown County', 'McLeod County', 'Dunn County', 'Madison County', 'Jackson County', 'Cedar County', 'Orange County', 'Brown County', 'Lyon County', 'Carroll County', 'Hamilton County', 'Pocahontas County', 'Independence County', 'Lonoke County', 'Newton County', 'Clark County', 'Schoolcraft County', 'Jersey County', 'Wallace County', 'Alger County', 'Fulton County', 'Newaygo County', 'Todd County', 'Logan County', 'Miller County', 'Riley County', 'Warrick County', 'Ellis County', 'Pratt County', 'Lane County', 'Piatt County', 'Kossuth County', 'Burke County', 'Harrison County', 'Keya Paha County', 'Webster County', 'Pope County', 'Jefferson County', 'Deuel County', 'Banner County', 'Madison County', 'Sanilac County', 'Wayne County', 'Nobles County', 'Aitkin County', 'Ramsey County', 'Trego County', 'Maries County', 'Arkansas County', 'Lawrence County', 'Bureau County', 'Scioto County', 'Vinton County', 'Howard County', 'Carroll County', 'Hubbard County', 'Sargent County', 'Reynolds County', 'Paulding County', 'Wells County', 'Palo Alto County', 'Ringgold County', 'Warren County', 'Greeley County', 'Jefferson County', 'Saline County', 'Clinton County', 'Jackson County', 'Dodge County', 'Freeborn County', 'Lake County', 'Coles County', 'Van Buren County', 'Mercer County', 'Effingham County', 'Clark County', 'Tippecanoe County', 'Dundy County', 'Grand Forks County', 'LaPorte County', 'Hamilton County', 'Greeley County', 'Henry County', 'Newton County', 'Posey County', 'Cumberland County', 'Pope County', 'Crawford County', 'Calhoun County', 'McPherson County', 'Fulton County', 'Miner County', 'Jerauld County', 'Decatur County', 'Dubois County', 'Worth County', 'Scott County', 'Christian County', 'Ripley County', 'Mercer County', 'Green Lake County', 'Walworth County', 'Fulton County', 'Union County', 'McDonald County', 'Scotts Bluff County', 'Dickey County', 'Barnes County', 'Sibley County', 'Chippewa County', 'Clinton County', 'Montgomery County', 'Atchison County', 'Macon County', 'St. Joseph County', 'Franklin County', 'Adams County', 'Olmsted County', 'McCook County', 'Franklin County', 'Burleigh County', 'Iron County', 'Kandiyohi County', 'Lawrence County', 'Ontonagon County', 'Rock County', 'Ziebach County', 'Baraga County', 'Boone County', 'Van Buren County', 'Cowley County', 'Johnson County', 'Harrison County', 'Bartholomew County', 'Brown County', 'Ward County', 'Logan County', 'Cass County', 'Douglas County', 'Bottineau County', 'Alcona County', 'Searcy County', 'Otoe County', 'Waseca County', 'Brule County', 'Clark County', 'Garland County', 'Osage County', 'Trumbull County', 'Marion County', 'Webster County', 'Cottonwood County', 'Black Hawk County', 'Pike County', 'Kearney County', 'Hitchcock County', 'Rock Island County', 'Sevier County', 'Cass County', 'Carroll County', 'Jefferson County', 'Lincoln County', 'Vernon County', 'Iron County', 'Monroe County', 'Rush County', 'Montgomery County', 'Stanton County', 'Koochiching County', 'Watonwan County', 'Sully County', 'Gibson County', 'Kimball County', 'Kendall County', 'Wright County', 'Kenosha County', 'Grundy County', 'Lake County', 'Ottawa County', 'Cook County', 'Gallatin County', 'Franklin County', 'Clay County', 'Benson County', 'Pike County', 'Lawrence County', 'Scott County', 'Adams County', 'Crawford County', 'Guernsey County', 'Barry County', 'Stone County', 'Clarke County', 'Fayette County', 'Warren County', 'Van Wert County', 'Adair County', 'Howard County', 'Milwaukee County', 'Scott County', 'Pickaway County', 'Antrim County', 'Lee County', 'Nemaha County', 'Pottawatomie County', 'Jackson County', 'Vermillion County', 'Roscommon County', 'Muskingum County', 'Custer County', 'Chickasaw County', 'DeKalb County', 'Hancock County', 'Stark County', 'Luce County', 'Bowman County', 'Stark County', 'Walworth County', 'Washington County', 'Dubuque County', 'Sherman County', 'Richland County', 'Adams County', 'Champaign County', 'Iroquois County', 'Poweshiek County', 'Wayne County', 'Cass County', 'Kingsbury County', 'Logan County', 'Gogebic County', 'Becker County', 'Ashland County', 'Ford County', 'Emmons County', 'Randolph County', 'Oneida County', 'Allen County', 'Douglas County', 'Waushara County', 'Izard County', 'Miller County', 'Platte County', 'Buchanan County', 'Henry County', 'Polk County', 'Ottawa County', 'Norman County', 'Shelby County', 'Benton County', 'Chisago County', 'Cole County', 'Berrien County', 'Dawes County', 'Montmorency County', 'Oscoda County', 'St. Clair County', 'Washington County', 'Scott County', 'Labette County', 'Harrison County', 'Marshall County', 'Scott County', 'Ogemaw County', 'Richland County', 'Ralls County', 'Menard County', 'Sheridan County', 'Fulton County', 'Johnson County', 'Washburn County', 'Winona County', 'Andrew County', 'Montgomery County', 'Cherokee County', 'Lafayette County', 'Waupaca County', 'Ozark County', 'Traill County', 'Vilas County', 'Beltrami County', 'Clark County', 'McHenry County', 'Wayne County', 'LaMoure County', 'Kidder County', 'Porter County', 'Hamilton County', 'Perry County', 'Cheyenne County', 'Wayne County', 'Marion County', 'Jackson County', 'Nelson County', 'Ray County', 'Hocking County', 'Linn County', 'Atchison County', 'Miami County', 'Ozaukee County', 'Sheboygan County', 'Cloud County', 'Dickinson County', 'Geary County', 'Lyon County', 'Butler County', 'Greene County', 'Rush County', 'Washington County', 'Laclede County', 'Craighead County', 'Saline County', 'White County', 'De Witt County', 'Goodhue County', 'Steele County', 'Vanderburgh County', 'Franklin County', 'Bayfield County', 'Portage County', 'Fond du Lac County', 'Kewaunee County', 'Chariton County', 'Russell County', 'Putnam County', 'Haakon County', 'Cleburne County', 'Wells County', 'Hot Spring County', 'Schuyler County', 'Columbia County', 'Griggs County', 'Clayton County', 'Barton County', 'Slope County', 'Garfield County', 'Ingham County', 'Shawnee County', 'Hanson County', 'Itasca County', 'Johnson County', 'Langlade County', 'Buena Vista County', 'Mills County', 'Delaware County', 'Dallas County', 'Wayne County', 'Stephenson County', 'Lapeer County', 'Kalkaska County', 'Divide County', 'Marion County', 'Douglas County', 'Cedar County', 'Ouachita County', 'Darke County', 'Dewey County', 'Owen County', 'Bollinger County', 'Pierce County', 'Union County', 'Kankakee County', 'McIntosh County', 'Platte County', 'Clay County', 'Randolph County', 'Butler County', 'Mason County', 'Yankton County', 'Rock County', 'Clinton County', 'Clinton County', 'Shiawassee County', 'Jewell County', 'Mitchell County', 'Jo Daviess County', 'Hancock County', 'Scott County', 'Williamson County', 'Stevens County', 'Brown County', 'Box Butte County', 'St. Clair County', 'Thurston County', 'Randolph County', 'Crawford County', 'Mahaska County', 'Douglas County', 'Jasper County', 'Adams County', 'Livingston County', 'Yell County', 'Comanche County', 'Lake County', 'Greene County', 'Appanoose County', 'Jefferson County', 'Boone County', 'Oregon County', 'Vigo County', 'Elkhart County', 'Meeker County', 'Ashland County', 'Madison County', 'Monroe County', 'Dallas County', 'Pawnee County', 'Wyandotte County', 'Tuscola County', 'Graham County', 'Lucas County', 'Mississippi County', 'Floyd County', 'Morton County', 'McPherson County', 'Red Willow County', 'Rock County', 'Mason County', 'Washington County', 'Eau Claire County', 'Sumner County', 'Oceana County', 'Kanabec County', 'Ashtabula County', 'Livingston County', 'Preble County', 'Jackson County', 'Miami County', 'Washtenaw County', 'LaGrange County', 'Oconto County', 'Forest County', 'Sawyer County', 'Stark County', 'Van Buren County', 'Gosper County', 'Mahoning County', 'Wayne County', 'Osage County', 'Kane County', 'Newton County', 'Cavalier County', 'Gove County', 'Gage County', 'Harrison County', 'Tuscarawas County', 'Highland County', 'Lake of the Woods County', 'Lyman County', 'Trempealeau County', 'Jackson County', 'Knox County', 'Dawson County', 'Ford County', 'Williams County', 'Cass County', 'Hardin County', 'Arthur County', 'Johnson County', 'Neosho County', 'Linn County', 'Hayes County', 'Calhoun County', 'Hillsdale County', 'Custer County', 'Beadle County', 'Johnson County', 'Jones County', 'Billings County', 'Antelope County', 'Gasconade County', 'Cross County', 'Phillips County', 'Pulaski County', 'Benzie County', 'St. Charles County', 'Brown County', 'Holt County', 'Mountrail County', 'Sioux County', 'Brown County', 'Clark County', 'Grundy County', 'Lincoln County', 'Polk County', 'Green County', 'Franklin County', 'McLean County', 'Wright County', 'Crawford County', 'Otter Tail County', 'Cass County', 'Outagamie County', 'Lafayette County', 'Morrow County', 'Foster County', 'Crawford County', 'Ste. Genevieve County', 'McDonough County', 'Montgomery County', 'Jackson County', 'Lincoln County', 'Dakota County', 'Adams County', 'Clark County', 'Worth County', 'Sherman County', 'Campbell County', 'Harding County', 'Gratiot County', 'Union County', 'Massac County', 'Logan County', 'Merrick County', 'Sheridan County', 'Morgan County', 'Grant County', 'Henry County', 'Codington County', 'Clay County', 'Faulkner County', 'Keokuk County', 'Greene County', 'Lake County', 'Anoka County', 'Bon Homme County', 'St. Joseph County', 'Pembina County', 'Bennett County', 'Baxter County', 'Story County', 'Bourbon County', 'Taylor County', 'Mower County', 'Murray County', 'Phelps County', 'Starke County', 'Mitchell County', 'Pawnee County', 'Marathon County', 'Wexford County', 'Hickory County', 'Barry County', 'Ramsey County', 'Little River County', 'Sarpy County', 'Wilkin County', 'Randolph County', 'Marion County', 'Pike County', 'Woodford County', 'Perry County', 'Grundy County', 'Johnson County', 'Isanti County', 'Benton County', 'Fountain County', 'Shelby County', 'Fayette County', 'Perry County', 'Polk County', 'Winneshiek County', 'Florence County', 'Wadena County', 'Winnebago County', 'Pennington County', 'Boone County', 'Genesee County', 'Roberts County', 'Ogle County', 'Richland County', 'Barron County', 'Iron County', 'Wabasha County', 'Presque Isle County', 'Tipton County', 'Clay County', 'Ashley County', 'Desha County', 'Washington County', 'Caldwell County', 'Crawford County', 'Lewis County', 'Grant County', 'Moultrie County', 'Crow Wing County', 'St. Francis County', 'Lincoln County', 'Smith County', 'Montgomery County', 'Calhoun County', 'Polk County', 'Traverse County', 'Cass County', 'Burt County', 'Sangamon County', 'Otsego County', 'Sac County', 'Yellow Medicine County', 'Mecosta County', 'Ripley County', 'Tazewell County', 'Sharp County', 'Rice County', 'Warren County', 'Todd County', 'Marshall County', 'Switzerland County', 'LaSalle County', 'Delaware County', 'Morris County', 'Davis County', 'Monroe County', 'Delaware County', 'Jackson County', 'Floyd County', 'Turner County', 'Stoddard County', 'Stearns County', 'Saunders County', 'Sherburne County', 'Davison County', 'Racine County', 'Shawano County', 'Audubon County', 'Le Sueur County', 'Dodge County', 'Jones County', 'Barber County', 'Pulaski County', 'Logan County', 'Gentry County', 'Blaine County', 'Adair County', 'Erie County', 'Vermilion County', 'St. Louis County', 'Boone County', 'Dane County', 'Morgan County', 'Marshall County', 'Huron County', 'Iosco County', 'Grant County', 'Hardin County', 'Clinton County', 'St. Louis County', 'Lorain County', 'Boone County', 'Dixon County', 'Calumet County', 'Ionia County', 'Cook County', 'Kent County', 'Stanton County', 'Jasper County', 'Plymouth County', 'Pottawattamie County', 'Wright County', 'Audrain County', 'Jefferson County', 'Greene County', 'Burnett County', 'Stanley County', 'Wheeler County', 'Grant County', 'Chase County', 'Aurora County', 'Franklin County', 'Crawford County', 'Chippewa County', 'Pennington County', 'Lincoln County', 'Chippewa County', 'Woodson County', 'Macomb County', 'Jasper County', 'Spencer County', 'McKenzie County', 'Calhoun County', 'Kosciusko County', 'Woodruff County', 'Perkins County', 'Taylor County', 'Defiance County', 'Marion County', 'Warren County', 'Page County', 'Jefferson County', 'Faribault County', 'Rawlins County', 'Thomas County', 'Cherokee County', 'White County', 'Cooper County', 'Dickinson County', 'Will County', 'Brookings County', 'Clay County', 'Boone County', 'Des Moines County', 'Scott County', 'Ottawa County', 'Carlton County', 'Athens County', 'Jefferson County', 'Douglas County', 'Jay County', 'Montcalm County', 'Lee County', 'Rice County', 'Sandusky County', 'Pulaski County', 'Saginaw County', 'Madison County', 'Dodge County', 'Marquette County', 'Sullivan County', 'Ness County', 'Chase County', 'Montgomery County', 'Conway County', 'Nodaway County', 'Ransom County', 'Bay County', 'Pine County', 'Brown County', 'Wilson County', 'Arenac County', 'Lee County', 'Osborne County', 'Emmet County', 'Fremont County', 'Taney County', 'Linn County', 'Buffalo County', 'Mellette County', 'Stevens County', 'Monroe County', 'Clark County', 'Haskell County', 'Iowa County', 'Buffalo County', 'Butler County', 'Moniteau County', 'Howard County', 'Nevada County', 'Auglaize County', 'Emmet County', 'Saline County', 'Callaway County', 'Cheboygan County', 'Gladwin County', 'Woodbury County', 'Alexander County', 'Jefferson County', 'Lincoln County', 'Clay County', 'Potter County', 'Kingman County', 'Texas County', 'Pulaski County', 'Crawford County', 'Geauga County', 'Towner County', 'Hamilton County', 'Buchanan County', 'DuPage County', 'Fall River County', 'Kittson County', 'Fillmore County', 'Sullivan County', 'Stafford County', 'Monroe County', 'White County', 'Noble County', 'York County', 'Clay County', 'Morgan County', 'Holmes County', 'Osceola County', 'Jennings County', 'Saline County', 'Kalamazoo County', 'Daviess County', 'Grand Traverse County', 'Hughes County', 'Hyde County', 'Greene County', 'Seward County', 'Columbiana County', 'Grant County', 'Benton County', 'Dickinson County', 'Richland County', 'Madison County', 'Crawford County', 'Carroll County', 'Lake County', 'Dallas County', 'Wood County', 'Belmont County', 'Carter County', 'Clay County', 'Cerro Gordo County', 'Greene County', 'Cape Girardeau County', 'Mississippi County', 'Cleveland County', 'DeKalb County', 'Schuyler County', 'Mackinac County', 'Finney County', 'Montgomery County', 'Cheyenne County', 'Martin County', 'Garden County', 'Macoupin County', 'Ross County', 'Whiteside County', 'Washington County', 'Howell County', 'Edwards County', 'Logan County', 'Winnebago County', 'Harvey County', 'Midland County', 'Jefferson County', 'Hamlin County', 'Lincoln County', 'Lawrence County', 'Howard County', 'Pike County', 'Eaton County', 'Wapello County', 'Cass County', 'Sheridan County', 'Edmunds County', 'Dearborn County', 'Jackson County', 'Crittenden County', 'Renville County', 'Henry County', 'Harlan County', 'Pepin County', 'Macon County', 'Kiowa County', 'Daviess County', 'Manistee County', 'Lyon County', 'Adams County', 'Harper County', 'Monona County', 'Peoria County', 'Humboldt County', 'Washington County', 'Iowa County', 'Morrison County', 'Shelby County', 'Madison County', 'Washington County', 'Champaign County', 'Edgar County', 'Hardin County', 'Missaukee County', 'Stutsman County', 'Shannon County', 'Oakland County', 'Golden Valley County', 'Pipestone County', 'Renville County', 'Hooker County', 'Hand County', 'Lafayette County', 'Clermont County', 'Louisa County', 'Elk County', 'Noble County', 'Putnam County', 'Mahnomen County', 'Perry County', 'Hennepin County', 'Tama County', 'Seward County', 'Monroe County', 'Richardson County', 'Christian County', 'Oliver County', 'Osceola County', 'Dade County', 'Muscatine County', 'Martin County', 'Scotland County', 'Nemaha County', 'Norton County', 'Furnas County', 'Wayne County', 'Howard County', 'Dunn County', 'Coffey County', 'Branch County', 'Meigs County', 'Spink County', 'Valley County', 'Saline County', 'Rolette County', 'Allegan County', 'Brown County', 'Shelby County', 'Franklin County', 'Keweenaw County', 'Kearny County', 'Monroe County', 'Lucas County', 'Nicollet County', 'Marinette County', 'Price County', 'Miami County', 'Ellsworth County', 'Hodgeman County', 'Meade County', 'Faulk County', 'Houghton County', 'Butte County', 'Madison County', 'Putnam County', 'Putnam County', 'Grant County', 'Morton County', 'Meade County', 'Marion County', 'Chicot County', 'Pope County', 'Marion County', 'St. Francois County', 'Clinton County', 'Prairie County', 'Bradley County', 'Douglas County', 'Huron County', 'Wood County', 'Anderson County', 'Knox County', 'McPherson County', 'Charlevoix County', 'Swift County', 'Seneca County', 'Williams County', 'Union County', 'Cuyahoga County', 'Oglala Lakota County', 'Marshall County', 'Wichita County', 'Charles Mix County', 'Cedar County', 'McHenry County', 'Carroll County', 'Steele County', 'Thayer County', 'Hamilton County', 'Warren County', 'Vernon County', 'Parke County', 'Franklin County', 'Fairfield County', 'Pierce County', 'Carroll County', 'Red Lake County', 'Union County', 'Knox County', 'Bremer County', 'Deuel County', "O'Brien County", 'Grant County', 'Drew County', 'Morrill County', 'Benton County', 'Pike County', 'Dent County', 'Leavenworth County', 'Muskegon County', 'St. Clair County', 'Mercer County', 'Pettis County', 'Chautauqua County', 'Whitley County', 'Day County', 'DeKalb County', 'Edwards County', 'Licking County', 'Union County', 'Henderson County', 'Columbia County', 'Clearwater County', 'Rooks County', 'Fayette County', 'Hall County', 'Hamilton County', 'Loup County', 'Frontier County', 'Big Stone County', 'Blue Earth County', 'Delta County', 'Sebastian County', 'Dunklin County', 'Monroe County', 'Isabella County', 'Clark County', 'Adams County', 'Tripp County', 'Guthrie County', 'Washington County', 'Sanborn County', 'St. Croix County', 'Summit County', 'Washington County', 'Lawrence County', 'Eddy County', 'Juneau County', 'Corson County', 'Gregory County', 'Blackford County', 'Reno County', 'Rusk County', 'Waukesha County', 'Hendricks County', 'Jackson County', 'Hettinger County', 'Buffalo County', 'Polk County', 'Redwood County', 'Poinsett County', 'Shelby County', 'Lawrence County', 'Gray County', 'Pemiscot County', 'Nance County', 'Menominee County', 'Sioux County', 'St. Louis city', 'Grant County', 'Marshall County', 'Knox County', 'Allamakee County', 'Wabaunsee County', 'Houston County', 'Medina County', 'Manitowoc County', 'Door County', 'Gallia County', 'Coshocton County', 'Perkins County', 'Winnebago County', 'Wyandot County', 'Carver County', 'Colfax County', 'Bates County', 'Ida County', 'Sedgwick County', 'Butler County', 'Cass County', 'Mercer County', 'Jackson County', 'Cherry County', 'New Madrid County', 'Hempstead County', 'Camden County', 'Lenawee County', 'Roseau County']
/*initiate the autocomplete function on the "myInput" element, and pass along the countries array as possible autocomplete values:*/
autocomplete(document.getElementById("locationInput"), locations);

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

    curLocation = document.getElementById("locationInput").value;
    curCrop = document.getElementById("cropInput").value; // 'corn' or 'soybean'
    curYear = document.getElementById("yearInput").value; // 2010-2021
    curMonth = document.getElementById("monthInput").value; // 0-9
    curProperty = document.getElementById("propertyInput").value; // or 'yield', 'error'- color scheme should be different

    //call getData function
    getData(curMap, curCrop, curYear, curMonth, curLocation);
}

$(document).ready(createMap);