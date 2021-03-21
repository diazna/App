mapboxgl.accessToken =
  "pk.eyJ1IjoicnlhbmJ1bGNoZXIiLCJhIjoiY2tsd2w3OTA3MDBmZzJ1azJrNzU2ZWd1eiJ9.VyczYMv752tJuJd4cjsKhg";
var loader = document.getElementById("loader");
var mapDiv = document.getElementById("map");

mapDiv.style.opacity = 0.25;

navigator.geolocation.getCurrentPosition(successLocation, errorLocation, {
  enableHighAccuracy: true,
});
var userLocation = [-84.74232, 39.51019];

function successLocation(position) {
  userLocation = [position.coords.longitude, position.coords.latitude];
  setupMap();
}

function errorLocation() {
  setupMap();
  alert(
    "Location services needs to be enabled to properly work. Defaulted to Oxford, Ohio"
  );
  //If browser declines location:
  //default location Oxford, Ohio
}
const map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/mapbox/streets-v11",
  zoom: 8,
  center: userLocation,
});

var canvas = map.getCanvasContainer();

function setupMap() {
  mapDiv.style.opacity = 1;
  loader.style.display = "none";
  map.flyTo({
    center: userLocation,
    zoom: 15,
  });

  const nav = new mapboxgl.NavigationControl();
  map.addControl(nav);

  var geolocate = new mapboxgl.GeolocateControl({
    positionOptions: {
      enableHighAccuracy: true,
    },
    trackUserLocation: true,
  });
  // Add the control to the map.
  map.addControl(geolocate);

  geolocate.on("geolocate", (e) => {
    console.log(e);
  });
}

function getRoute(end) {
  // make a directions request using driving profile
  // an arbitrary start will always be the userLocation
  // only the end or destination will change
  var url =
    "https://api.mapbox.com/directions/v5/mapbox/driving/" +
    userLocation[0] +
    "," +
    userLocation[1] +
    ";" +
    end[0] +
    "," +
    end[1] +
    "?steps=true&geometries=geojson&access_token=" +
    mapboxgl.accessToken;

  // make an XHR request https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest
  var req = new XMLHttpRequest();
  req.open("GET", url, true);
  req.onload = function () {
    var json = JSON.parse(req.response);
    var data = json.routes[0];
    var route = data.geometry.coordinates;
    var geojson = {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: route,
      },
    };
    // if the route already exists on the map, reset it using setData
    if (map.getSource("route")) {
      map.getSource("route").setData(geojson);
    } else {
      // otherwise, make a new request
      map.addLayer({
        id: "route",
        type: "line",
        source: {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: geojson,
            },
          },
        },
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "#3887be",
          "line-width": 5,
          "line-opacity": 0.75,
        },
      });
    }
    var instructions = document.getElementById("instructions");
    var steps = data.legs[0].steps;

    var tripInstructions = [];
    if (steps.length !== 0 && data.duration !== 0) {
      instructions.style.display = "block";
    }

    for (var i = 0; i < steps.length; i++) {
      tripInstructions.push("<br><li>" + steps[i].maneuver.instruction) +
        "</li>";
      instructions.innerHTML =
        '<span class="duration">Trip duration: ' +
        Math.floor(data.duration / 60) +
        " min  </span>" +
        tripInstructions;
    }
  };
  req.send();
}

map.on("load", function () {
  // make an initial directions request that
  // starts and ends at the same location
  getRoute(userLocation);

  // Add destination to the map
  map.addLayer({
    id: "point",
    type: "circle",
    source: {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {},
            geometry: {
              type: "Point",
              coordinates: userLocation,
            },
          },
        ],
      },
    },
    paint: {
      "circle-radius": 0,
    },
  });
});

function updateSuccess(position) {
  userLocation = [position.coords.longitude, position.coords.latitude];
}

function routeBuild(day) {
  mapDiv.style.height = "90vh";
  document.getElementById("nextRouteButton").style.display = "";
  const API_URL_MONDAY = "https://www.routeplan.xyz/api/logs/find" + day;

  const locations = getLocations(API_URL_MONDAY);

  var addresses = [];
  locations
    .then((data) => (addresses = data))
    .then(() => {
      var sortedAddresses = sortAddresses(addresses);

      document.getElementById("continue-button").onclick = () => {
        //get updated user location
        navigator.geolocation.getCurrentPosition(updateSuccess, errorLocation, {
          enableHighAccuracy: true,
        });
        
        document.getElementById("continue-button").value =
          day + ": Next Location";
        if (sortedAddresses.length <= 0) {
          alert("Finished Route");
          location.reload();
        } else {
          var latitude = sortedAddresses[0].location.latitude;
          var longitude = sortedAddresses[0].location.longitude;

          var latLong = [latitude, longitude];

          getRoute(latLong);
          sortedAddresses.shift();
          sortedAddresses = sortAddresses(sortedAddresses);
          console.log(sortedAddresses)
        }
      };
    });

  async function getLocations(API_URL) {
    var response = await fetch(API_URL);
    return response.json();
  }
}

function sortAddresses(addresses) {
  var allDistancesAndAddress = [];

  for (var i = 0; i < addresses.length; i++) {
    var currentAddress = addresses[i];
    var lat = currentAddress.location.latitude;
    var lon = currentAddress.location.longitude;

    var distanceFromUser = getDistanceFromLatLonInKm(
      userLocation[0],
      userLocation[1],
      lat,
      lon
    );
    allDistancesAndAddress.push({
      distanceFromUser,
      currentAddress,
    });
  }

  var sorted = allDistancesAndAddress.sort((a, b) => {
    return a.distanceFromUser - b.distanceFromUser;
  });

  var sortedAddressObjects = [];
  sorted.forEach((obj) => {
    sortedAddressObjects.push(obj.currentAddress);
  });
  return sortedAddressObjects;
}

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  var R = 6371; // Radius of the earth in km
  var dLat = deg2rad(lat2 - lat1); // deg2rad below
  var dLon = deg2rad(lon2 - lon1);
  var a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  var d = R * c; // Distance in km
  return d; // distance returned
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}
