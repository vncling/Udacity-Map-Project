
function appViewModel() {
  'use strict';
  var self = this;
  var map, infowindow;
  var yelpLocations = [];
  var yelpReadableNames = [];

  this.yelpDeals = ko.observableArray([]); //initial list of deals
  this.filteredList = ko.observableArray([]); //list filtered by search keyword
  this.mapMarkers = ko.observableArray([]);  //holds all map markers
  this.dealStatus = ko.observable('Searching for deals nearby...');
  this.searchStatus = ko.observable();
  this.errormessage = ko.observable();
  this.searchLocation = ko.observable('Orlando FL');
  this.loadImg = ko.observable();
  this.numDeals = ko.computed(function() {
    return self.filteredList().length;
  });

  //Holds value for list togglings
  this.toggleSymbol = ko.observable('hide');

  //Hold the current location's lat & lng - useful for re-centering map
  this.currentLat = ko.observable(28.52169775);
  this.currentLng = ko.observable(-81.36873845);

  // When a deal on the list is clicked, go to corresponding marker and open its info window.
  this.goToMarker = function(clickedDeal) {
    var clickedDealName = clickedDeal.dealName;
    for(var key in self.mapMarkers()) {
      if(clickedDealName === self.mapMarkers()[key].marker.title) {
        map.panTo(self.mapMarkers()[key].marker.position);
        map.setZoom(12);
        infowindow.setContent(self.mapMarkers()[key].content);
        infowindow.open(map, self.mapMarkers()[key].marker);
        map.panBy(0, -150);
        self.mobileShow(false);
        self.searchStatus('');
      }
    }
  };

  // Handle the input given when user searches for deals in a location
  this.processLocationSearch = function() {
    //Need to use a jQuery selector instead of KO binding because this field is affected by the autocomplete plugin.  The value inputted does not seem to register via KO.
    self.searchStatus('');
    self.searchStatus('Searching...');
    var newAddress = self.searchLocation();

    //newYelpId will hold the Yelp-formatted ID of the inputted city.
    var newYelpId, newLat, newLng;
    for(var i = 0; i < 171; i++) {
      var name = yelpLocations.divisions[i].name;
      if(newAddress == name) {
        newYelpId = yelpLocations.divisions[i].id;
        self.currentLat(yelpLocations.divisions[i].lat);
        self.currentLng(yelpLocations.divisions[i].lng);
      }
    }
    //Form validation - if user enters an invalid location, return error.
    if(!newYelpId) {
      return self.searchStatus('Not a valid location, try again.');
    } else {
      //Replace current location with new (human-formatted) location for display in other KO bindings.
      self.searchLocation(newAddress);

      //clear our current deal and marker arrays
      clearMarkers();
      self.yelpDeals([]);
      self.filteredList([]);
      self.dealStatus('Loading...');
      self.loadImg('<img src="img/ajax-loader.gif">');
      //perform new yelp search and center map to new location
      getYelps(newYelpId);
      map.panTo({lat: self.currentLat(), lng: self.currentLng()});
    }
  };


  this.filterKeyword = ko.observable('');

  //Compare search keyword against names and dealTags of existing deals.  Return a filtered list and map markers of request.

  this.filterResults = ko.computed(function() {
  var searchWord = self.filterKeyword().toLowerCase();
  var array = self.yelpDeals();

  //first clear out all entries in the filteredList array
  self.filteredList([]);
  //Loop through the yelpDeals array and see if the search keyword matches 
  //with any venue name or dealTags in the list, if so push that object to the filteredList 
  //array and place the marker on the map.
  for(var i=0; i < array.length; i++) {

    if(array[i].dealName.toLowerCase().indexOf(searchWord) !== -1) {
      if (self.mapMarkers()[i]) {
        self.mapMarkers()[i].marker.setMap(map);
      }
      self.filteredList.push(array[i]);
    } else {
      for (var j = 0; j < array[i].dealTags.length; j++) {
        if(array[i].dealTags[j].toLowerCase().indexOf(searchWord) !== -1) {
          if (self.mapMarkers()[i]) {
            self.mapMarkers()[i].marker.setMap(map);
          }
          self.filteredList.push(array[i]);
        } else {
          if (self.mapMarkers()[i]) {
            self.mapMarkers()[i].marker.setMap(null);
          }
        }
      }
    }
    self.dealStatus(self.numDeals() + ' deals found for ' + self.filterKeyword());
  }
});


  //Clear keyword from filter and show all deals in current location again.
  this.clearFilter = function() {
    self.filteredList(self.yelpDeals());
    self.dealStatus(self.numDeals() + ' Top Rating food found near ' + self.searchLocation());
    self.filterKeyword('');
    for(var i = 0; i < self.mapMarkers().length; i++) {
      self.mapMarkers()[i].marker.setMap(map);
    }
  };

  //toggles the list view
  this.listToggle = function() {
    if(self.toggleSymbol() === 'hide') {
      self.toggleSymbol('show');
    } else {
      self.toggleSymbol('hide');
    }
  };
  
			  
//Error handling if Google Maps fails to load
 var mapRequestTimeout = setTimeout(function() {
    self.errormessage('We had trouble loading Google Maps. Please refresh your browser and try again.');
  }, 8000);

// Initialize Google map, perform initial deal search on a city.
function initMap() {
    map = new google.maps.Map(document.getElementById('map-canvas'), {
          center: {lat: 28.52169775, lng: -81.36873845},
          zoom: 12,
          zoomControlOptions: {
            position: google.maps.ControlPosition.LEFT_CENTER,
            style: google.maps.ZoomControlStyle.SMALL
          },
          streetViewControlOptions: {
            position: google.maps.ControlPosition.LEFT_BOTTOM
            },
          mapTypeControl: false,
          panControl: false
        });
   
    clearTimeout(mapRequestTimeout);

    google.maps.event.addDomListener(window, "resize", function() {
       var center = map.getCenter();
       google.maps.event.trigger(map, "resize");
       map.setCenter(center); 
    });

    infowindow = new google.maps.InfoWindow({maxWidth: 300});
    getYelps('Orlando FL');
    getYelpLocations();
  }


// Use API to get deal data and store the info as objects in an array
  function getYelps(location) {
    var auth = {
                //
                // Update with your auth tokens.
                //
                consumerKey : "Rx2sJPHsmKRbGh3bfU5z4A",
                consumerSecret : "rIdwbYrogcqeV3-Ldfxp2aQ_1e4",
                accessToken : "gNE3bfvK3TRhHtyMWqBfCmK2HqIHAzCE",
                // This example is a proof of concept, for how to use the Yelp v2 API with javascript.
                // You wouldn't actually want to expose your access token secret like this in a real application.
                accessTokenSecret : "ehDsJuZYO9gU6C8pI2gIqP4P4Hw",
                serviceProvider : {
                    signatureMethod : "HMAC-SHA1"
                }
            };
            // change category from Food to Restaurants to avoid food cart issue with no latitude and longitude.
            var filters = 'restaurants';
            var near = location;
            var parameters;
            var accessor = {
                consumerSecret : auth.consumerSecret,
                tokenSecret : auth.accessTokenSecret
            };
            parameters = [];
            parameters.push(['category_filter', filters]);
            parameters.push(['location', near]);
			parameters.push(['sort', 2]);
            parameters.push(['callback', 'cb']);
            parameters.push(['oauth_consumer_key', auth.consumerKey]);
            parameters.push(['oauth_consumer_secret', auth.consumerSecret]);
            parameters.push(['oauth_token', auth.accessToken]);
            parameters.push(['oauth_signature_method', 'HMAC-SHA1']);

            var message = {
                'action' : 'https://api.yelp.com/v2/search',
                'method' : 'GET',
                'parameters' : parameters
            };

            OAuth.setTimestampAndNonce(message);
            OAuth.SignatureMethod.sign(message, accessor);

            var parameterMap = OAuth.getParameterMap(message.parameters);
            var yelpRequestTimeout = setTimeout(function() {
               self.dealStatus('Oops, something went wrong, please refresh and try again later.');
             }, 8000);
    $.ajax({
      'url' : message.action,
      'data' : parameterMap,
      'dataType' : 'jsonp',
      'jsonpCallback' : 'cb',
      'success': function(data) {
        console.log(data);
        var len = data.businesses.length;
        for(var i = 0; i < len; i++) {

          var venueName = data.businesses[i].name,
              venueLat = data.businesses[i].location.coordinate.latitude,
              venueLon = data.businesses[i].location.coordinate.longitude,
              gLink = data.businesses[i].url,
              gImg = data.businesses[i].image_url,
              blurb = data.businesses[i].snippet_text,
              address = data.businesses[i].location.address,
              city = data.businesses[i].location.city,
              state = data.businesses[i].location.state_code,
              zip = data.businesses[i].location.postal_code,
              phone = data.businesses[i].phone,
			  rating = data.businesses[i].rating_img_url_small,
              tags = data.businesses[i].name;
		
		 clearTimeout(yelpRequestTimeout);
          // Some venues have a Yelp rating included. If there is no rating, 
          //function will stop running because the variable is undefined. 
          //This if statement handles that scenario by setting rating to an empty string.
        

          self.yelpDeals.push({
            dealName: venueName, 
            dealLat: venueLat, 
            dealLon: venueLon, 
            dealLink: gLink, 
            dealImg: gImg, 
            dealBlurb: blurb,
            dealAddress: address + "<br>" + city + ", " + state + " " + zip,
            dealPhone: phone,
            dealRating: rating,
            dealTags: tags
          });

        }
        self.filteredList(self.yelpDeals());
        mapMarkers(self.yelpDeals());
        self.searchStatus('');
        self.loadImg('');
      },
      error: function() {
        self.dealStatus('Oops, something went wrong, please refresh and try again.');
        self.loadImg('');
      }
    });
  }

// Create and place markers and info windows on the map based on data from API
  function mapMarkers(array) {
    $.each(array, function(index, value) {
      var latitude = value.dealLat,
          longitude = value.dealLon,
          geoLoc = new google.maps.LatLng(latitude, longitude),
          thisRestaurant = value.dealName;

      var contentString = '<div id="infowindow">' +
      '<img src="' + value.dealImg + '">' +
      '<h2>' + value.dealName + '</h2>' +
      '<p>' + value.dealAddress + '</p>' +
	  '<p>' + value.dealPhone + '</p>' +
      '<p class="rating"><img src="' + value.dealRating + '"></p>' +
      '<p><a href="' + value.dealLink + '" target="_blank">Click to view this place</a></p>' +
      '<p>' + value.dealBlurb + '</p></div>';

      var marker = new google.maps.Marker({
        position: geoLoc,
        title: thisRestaurant,
        map: map
      });

      self.mapMarkers.push({marker: marker, content: contentString});

      self.dealStatus(self.numDeals() + ' Top Rating restaurants found near ' + self.searchLocation());

      //generate infowindows for each deal
      google.maps.event.addListener(marker, 'click', function() {
        self.searchStatus('');
         infowindow.setContent(contentString);
         map.setZoom(12);
         map.setCenter(marker.position);
         infowindow.open(map, marker);
         map.panBy(0, -150);
		 marker.setAnimation(google.maps.Animation.BOUNCE);
		   window.setTimeout(function() {
           marker.setAnimation(null);
           }, 1900);
          
       });
    });
  }

// Clear markers from map and array
  function clearMarkers() {
    $.each(self.mapMarkers(), function(key, value) {
      value.marker.setMap(null);
    });
    self.mapMarkers([]);
  }

// Yelp's deal locations have a separate ID than the human-readable name 
//(eg washington-dc instead of Washington DC). This ajax call uses the Yelp 
//Division API to pull a list of IDs and their corresponding names to use for 
//validation in the search bar.




 function getYelpLocations() {
    $.ajax({
      url: 'http://vncling.github.io/Projects/cities.json',
      dataType: 'json',
      success: function(data) {
        yelpLocations = data;
        for(var i = 0; i < 171; i++) {
          var readableName = data.divisions[i].name;
          yelpReadableNames.push(readableName);
        }
		
       $('#autocomplete').autocomplete({
          lookup: yelpReadableNames,
          showNoSuggestionNotice: true,
          noSuggestionNotice: 'Sorry, no matching results',
          onSelect: function (suggestion) {
          self.searchLocation(suggestion.value);
           }
        });
      },
      error: function() {
        self.dealStatus('Oops, something went wrong, please reload the page and try again.');
        self.loadImg('');
      }
    });
	
  }
  
  //Manages the toggling of the list view, location centering, and search bar on a mobile device.

  this.mobileShow = ko.observable(false);
  this.searchBarShow = ko.observable(true);

   this.mobileToggleList = function() {
    if(self.mobileShow() === false) {
      self.mobileShow(true);
    } else {
      self.mobileShow(false);
    }
  };

  this.searchToggle = function() {
    if(self.searchBarShow() === true) {
      self.searchBarShow(false);
    } else {
      self.searchBarShow(true);
    }
  };

  //Re-center map to current city if you're viewing deals that are further away
  this.centerMap = function() {
    infowindow.close();
    var currCenter = map.getCenter();
    var cityCenter = new google.maps.LatLng(self.currentLat(), self.currentLng());
    if((cityCenter.k == currCenter.A) && (cityCenter.D == currCenter.F)) {
        self.searchStatus('Map is already centered.');
    } else {
      self.searchStatus('');
      map.panTo(cityCenter);
      map.setZoom(12);
    }
  };

  initMap();
}


//custom binding highlights the search text on focus

ko.bindingHandlers.selectOnFocus = {
        update: function (element) {
          ko.utils.registerEventHandler(element, 'focus', function (e) {
            element.select();
          });
        }
      };

function googleCallback() {
  ko.applyBindings(new appViewModel());
}

