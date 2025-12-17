import { useState, useCallback, useRef } from 'react';
import { GoogleMap, useJsApiLoader, Marker, DirectionsRenderer, Autocomplete } from '@react-google-maps/api';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent } from './ui/card';
import { MapPin, Navigation, Clock, Route } from 'lucide-react';

const libraries = ['places'];

const mapContainerStyle = {
  width: '100%',
  height: '300px',
  borderRadius: '12px'
};

const defaultCenter = {
  lat: 40.4168,
  lng: -3.7038 // Madrid, Spain
};

const LocationPicker = ({ 
  onOriginChange, 
  onDestinationChange, 
  onRouteInfoChange,
  initialOrigin = '',
  initialDestination = ''
}) => {
  const [origin, setOrigin] = useState(initialOrigin);
  const [destination, setDestination] = useState(initialDestination);
  const [originCoords, setOriginCoords] = useState(null);
  const [destinationCoords, setDestinationCoords] = useState(null);
  const [directions, setDirections] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  
  const originAutocompleteRef = useRef(null);
  const destinationAutocompleteRef = useRef(null);
  const mapRef = useRef(null);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY,
    libraries
  });

  const onMapLoad = useCallback((map) => {
    mapRef.current = map;
  }, []);

  const calculateRoute = useCallback(async (orig, dest) => {
    if (!orig || !dest || !window.google) return;

    const directionsService = new window.google.maps.DirectionsService();
    
    try {
      const result = await directionsService.route({
        origin: orig,
        destination: dest,
        travelMode: window.google.maps.TravelMode.DRIVING,
      });

      setDirections(result);
      
      const route = result.routes[0].legs[0];
      const info = {
        distance: route.distance.text,
        distanceValue: route.distance.value, // meters
        duration: route.duration.text,
        durationValue: route.duration.value, // seconds
      };
      
      setRouteInfo(info);
      onRouteInfoChange?.(info);

      // Fit bounds to show entire route
      if (mapRef.current) {
        const bounds = new window.google.maps.LatLngBounds();
        bounds.extend(route.start_location);
        bounds.extend(route.end_location);
        mapRef.current.fitBounds(bounds);
      }
    } catch (error) {
      console.error('Error calculating route:', error);
    }
  }, [onRouteInfoChange]);

  const handleOriginSelect = () => {
    if (originAutocompleteRef.current) {
      const place = originAutocompleteRef.current.getPlace();
      if (place.geometry) {
        const address = place.formatted_address || place.name;
        setOrigin(address);
        setOriginCoords({
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng()
        });
        onOriginChange?.(address);
        
        if (destinationCoords) {
          calculateRoute(address, destination);
        }
      }
    }
  };

  const handleDestinationSelect = () => {
    if (destinationAutocompleteRef.current) {
      const place = destinationAutocompleteRef.current.getPlace();
      if (place.geometry) {
        const address = place.formatted_address || place.name;
        setDestination(address);
        setDestinationCoords({
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng()
        });
        onDestinationChange?.(address);
        
        if (originCoords) {
          calculateRoute(origin, address);
        }
      }
    }
  };

  if (loadError) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-4 text-center text-red-600">
          Error al cargar Google Maps. Verifica la API Key.
        </CardContent>
      </Card>
    );
  }

  if (!isLoaded) {
    return (
      <Card className="border-0 shadow-md">
        <CardContent className="p-4 text-center text-gray-500">
          Cargando mapa...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Origin Input */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-emerald-500" />
          Origen
        </Label>
        <Autocomplete
          onLoad={(autocomplete) => originAutocompleteRef.current = autocomplete}
          onPlaceChanged={handleOriginSelect}
          options={{ types: ['geocode', 'establishment'] }}
        >
          <Input
            placeholder="Buscar dirección de origen..."
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            className="w-full"
          />
        </Autocomplete>
      </div>

      {/* Destination Input */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Navigation className="w-4 h-4 text-cyan-500" />
          Destino
        </Label>
        <Autocomplete
          onLoad={(autocomplete) => destinationAutocompleteRef.current = autocomplete}
          onPlaceChanged={handleDestinationSelect}
          options={{ types: ['geocode', 'establishment'] }}
        >
          <Input
            placeholder="Buscar dirección de destino..."
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            className="w-full"
          />
        </Autocomplete>
      </div>

      {/* Route Info */}
      {routeInfo && (
        <Card className="border-0 bg-gradient-to-r from-emerald-50 to-cyan-50">
          <CardContent className="p-4">
            <div className="flex justify-around text-center">
              <div>
                <Route className="w-6 h-6 text-emerald-500 mx-auto mb-1" />
                <p className="text-sm text-gray-500">Distancia</p>
                <p className="text-lg font-bold text-gray-900">{routeInfo.distance}</p>
              </div>
              <div className="border-l border-gray-200 pl-6">
                <Clock className="w-6 h-6 text-cyan-500 mx-auto mb-1" />
                <p className="text-sm text-gray-500">Tiempo estimado</p>
                <p className="text-lg font-bold text-gray-900">{routeInfo.duration}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Map */}
      <Card className="border-0 shadow-md overflow-hidden">
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={originCoords || destinationCoords || defaultCenter}
          zoom={originCoords || destinationCoords ? 12 : 6}
          onLoad={onMapLoad}
          options={{
            disableDefaultUI: false,
            zoomControl: true,
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: true,
          }}
        >
          {originCoords && !directions && (
            <Marker 
              position={originCoords}
              icon={{
                url: 'http://maps.google.com/mapfiles/ms/icons/green-dot.png'
              }}
            />
          )}
          {destinationCoords && !directions && (
            <Marker 
              position={destinationCoords}
              icon={{
                url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png'
              }}
            />
          )}
          {directions && (
            <DirectionsRenderer
              directions={directions}
              options={{
                polylineOptions: {
                  strokeColor: '#10b981',
                  strokeWeight: 5,
                },
                suppressMarkers: false,
              }}
            />
          )}
        </GoogleMap>
      </Card>
    </div>
  );
};

export default LocationPicker;
