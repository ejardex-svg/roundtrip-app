import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent } from './ui/card';
import { MapPin, Navigation, Clock, Route, Search, Loader2 } from 'lucide-react';

// Fix for default marker icons in Leaflet with webpack
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom icons
const originIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const destinationIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Component to fit map bounds
const FitBounds = ({ origin, destination }) => {
  const map = useMap();
  
  useEffect(() => {
    if (origin && destination) {
      const bounds = L.latLngBounds([origin, destination]);
      map.fitBounds(bounds, { padding: [50, 50] });
    } else if (origin) {
      map.setView(origin, 13);
    } else if (destination) {
      map.setView(destination, 13);
    }
  }, [origin, destination, map]);
  
  return null;
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
  const [routeInfo, setRouteInfo] = useState(null);
  const [routeLine, setRouteLine] = useState([]);
  
  const [originSuggestions, setOriginSuggestions] = useState([]);
  const [destinationSuggestions, setDestinationSuggestions] = useState([]);
  const [loadingOrigin, setLoadingOrigin] = useState(false);
  const [loadingDestination, setLoadingDestination] = useState(false);
  const [showOriginSuggestions, setShowOriginSuggestions] = useState(false);
  const [showDestinationSuggestions, setShowDestinationSuggestions] = useState(false);
  
  const originRef = useRef(null);
  const destinationRef = useRef(null);
  const debounceRef = useRef(null);

  const defaultCenter = [40.4168, -3.7038]; // Madrid

  // Search for places using Nominatim
  const searchPlaces = async (query, type) => {
    if (query.length < 3) {
      if (type === 'origin') setOriginSuggestions([]);
      else setDestinationSuggestions([]);
      return;
    }

    if (type === 'origin') setLoadingOrigin(true);
    else setLoadingDestination(true);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`,
        {
          headers: {
            'Accept-Language': 'es'
          }
        }
      );
      const data = await response.json();
      
      if (type === 'origin') {
        setOriginSuggestions(data);
        setShowOriginSuggestions(true);
      } else {
        setDestinationSuggestions(data);
        setShowDestinationSuggestions(true);
      }
    } catch (error) {
      console.error('Error searching places:', error);
    } finally {
      if (type === 'origin') setLoadingOrigin(false);
      else setLoadingDestination(false);
    }
  };

  // Debounced search
  const handleSearch = (query, type) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      searchPlaces(query, type);
    }, 300);
  };

  // Calculate route using OSRM (free routing service)
  const calculateRoute = async (orig, dest) => {
    if (!orig || !dest) return;

    try {
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${orig[1]},${orig[0]};${dest[1]},${dest[0]}?overview=full&geometries=geojson`
      );
      const data = await response.json();

      if (data.routes && data.routes[0]) {
        const route = data.routes[0];
        const coordinates = route.geometry.coordinates.map(coord => [coord[1], coord[0]]);
        setRouteLine(coordinates);

        const distance = (route.distance / 1000).toFixed(1);
        const duration = Math.round(route.duration / 60);
        
        const info = {
          distance: `${distance} km`,
          distanceValue: route.distance,
          duration: duration < 60 ? `${duration} min` : `${Math.floor(duration / 60)}h ${duration % 60}min`,
          durationValue: route.duration
        };
        
        setRouteInfo(info);
        onRouteInfoChange?.(info);
      }
    } catch (error) {
      console.error('Error calculating route:', error);
    }
  };

  // Handle origin selection
  const handleOriginSelect = (place) => {
    const coords = [parseFloat(place.lat), parseFloat(place.lon)];
    setOrigin(place.display_name);
    setOriginCoords(coords);
    setShowOriginSuggestions(false);
    onOriginChange?.(place.display_name);
    
    if (destinationCoords) {
      calculateRoute(coords, destinationCoords);
    }
  };

  // Handle destination selection
  const handleDestinationSelect = (place) => {
    const coords = [parseFloat(place.lat), parseFloat(place.lon)];
    setDestination(place.display_name);
    setDestinationCoords(coords);
    setShowDestinationSuggestions(false);
    onDestinationChange?.(place.display_name);
    
    if (originCoords) {
      calculateRoute(originCoords, coords);
    }
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (originRef.current && !originRef.current.contains(e.target)) {
        setShowOriginSuggestions(false);
      }
      if (destinationRef.current && !destinationRef.current.contains(e.target)) {
        setShowDestinationSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="space-y-4">
      {/* Origin Input */}
      <div className="space-y-2 relative" ref={originRef}>
        <Label className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-emerald-500" />
          Origen
        </Label>
        <div className="relative">
          <Input
            placeholder="Buscar dirección de origen..."
            value={origin}
            onChange={(e) => {
              setOrigin(e.target.value);
              handleSearch(e.target.value, 'origin');
            }}
            onFocus={() => originSuggestions.length > 0 && setShowOriginSuggestions(true)}
            className="w-full pr-10"
          />
          {loadingOrigin && (
            <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          )}
        </div>
        
        {showOriginSuggestions && originSuggestions.length > 0 && (
          <div className="absolute z-50 w-full bg-white border rounded-lg shadow-lg mt-1 max-h-60 overflow-y-auto">
            {originSuggestions.map((place, index) => (
              <div
                key={index}
                className="p-3 hover:bg-emerald-50 cursor-pointer border-b last:border-b-0 text-sm"
                onClick={() => handleOriginSelect(place)}
              >
                <div className="font-medium text-gray-900">{place.display_name.split(',')[0]}</div>
                <div className="text-gray-500 text-xs truncate">{place.display_name}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Destination Input */}
      <div className="space-y-2 relative" ref={destinationRef}>
        <Label className="flex items-center gap-2">
          <Navigation className="w-4 h-4 text-cyan-500" />
          Destino
        </Label>
        <div className="relative">
          <Input
            placeholder="Buscar dirección de destino..."
            value={destination}
            onChange={(e) => {
              setDestination(e.target.value);
              handleSearch(e.target.value, 'destination');
            }}
            onFocus={() => destinationSuggestions.length > 0 && setShowDestinationSuggestions(true)}
            className="w-full pr-10"
          />
          {loadingDestination && (
            <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          )}
        </div>
        
        {showDestinationSuggestions && destinationSuggestions.length > 0 && (
          <div className="absolute z-50 w-full bg-white border rounded-lg shadow-lg mt-1 max-h-60 overflow-y-auto">
            {destinationSuggestions.map((place, index) => (
              <div
                key={index}
                className="p-3 hover:bg-cyan-50 cursor-pointer border-b last:border-b-0 text-sm"
                onClick={() => handleDestinationSelect(place)}
              >
                <div className="font-medium text-gray-900">{place.display_name.split(',')[0]}</div>
                <div className="text-gray-500 text-xs truncate">{place.display_name}</div>
              </div>
            ))}
          </div>
        )}
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
        <div style={{ height: '300px', width: '100%' }}>
          <MapContainer
            center={defaultCenter}
            zoom={6}
            style={{ height: '100%', width: '100%', borderRadius: '12px' }}
            scrollWheelZoom={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            {originCoords && (
              <Marker position={originCoords} icon={originIcon} />
            )}
            
            {destinationCoords && (
              <Marker position={destinationCoords} icon={destinationIcon} />
            )}
            
            {routeLine.length > 0 && (
              <Polyline 
                positions={routeLine} 
                color="#10b981" 
                weight={5}
                opacity={0.8}
              />
            )}
            
            <FitBounds origin={originCoords} destination={destinationCoords} />
          </MapContainer>
        </div>
      </Card>
    </div>
  );
};

export default LocationPicker;
