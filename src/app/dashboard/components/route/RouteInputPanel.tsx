"use client"

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  RouteRequest,
  RoutePreferences,
  LocationPoint,
  SearchResult,
  RouteType,
  VehicleType
} from '@/types/route-optimization';
import { 
  MapPin, 
  Navigation, 
  Plus, 
  X, 
  Clock, 
  Car, 
  Truck, 
  Bike,
  Search,
  LocateFixed,
  ArrowRight,
  Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface RouteInputPanelProps {
  preferences: RoutePreferences;
  onPreferencesChange: (preferences: Partial<RoutePreferences>) => void;
  onRouteCalculate: (request: RouteRequest) => void;
  isCalculating: boolean;
  popularLocations: LocationPoint[];
  selectedWaypoints: LocationPoint[];
  onWaypointAdd: (waypoint: LocationPoint) => void;
  onWaypointRemove: (waypointId: string) => void;
}

interface LocationInputProps {
  label: string;
  placeholder: string;
  value: LocationPoint | null;
  onChange: (location: LocationPoint | null) => void;
  onSearch: (query: string) => void;
  searchResults: SearchResult[];
  isSearching: boolean;
  popularLocations: LocationPoint[];
  icon: React.ReactNode;
}

const LocationInput: React.FC<LocationInputProps> = ({
  label,
  placeholder,
  value,
  onChange,
  onSearch,
  searchResults,
  isSearching,
  popularLocations,
  icon
}) => {
  const [query, setQuery] = useState(value?.name || '');
  const [showResults, setShowResults] = useState(false);
  const [showPopular, setShowPopular] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value) {
      setQuery(value.name);
    }
  }, [value]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);
    
    if (newQuery.length > 2) {
      onSearch(newQuery);
      setShowResults(true);
      setShowPopular(false);
    } else {
      setShowResults(false);
      setShowPopular(newQuery.length === 0);
    }
  }, [onSearch]);

  const handleLocationSelect = useCallback((location: LocationPoint) => {
    onChange(location);
    setQuery(location.name);
    setShowResults(false);
    setShowPopular(false);
  }, [onChange]);

  const handleFocus = useCallback(() => {
    if (query.length === 0) {
      setShowPopular(true);
    } else if (query.length > 2) {
      setShowResults(true);
    }
  }, [query]);

  const handleBlur = useCallback(() => {
    // Delay hiding to allow for clicks on results
    setTimeout(() => {
      setShowResults(false);
      setShowPopular(false);
    }, 200);
  }, []);

  return (
    <div className="space-y-2">
      <Label className="text-xs sm:text-sm font-medium text-gray-700">{label}</Label>
      <div className="relative">
        <div className="relative">
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
            {icon}
          </div>
          <Input
            ref={inputRef}
            type="text"
            placeholder={placeholder}
            value={query}
            onChange={handleInputChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            className="pl-10 pr-10 text-xs sm:text-sm"
          />
          {isSearching && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
            </div>
          )}
        </div>

        {/* Search Results */}
        {(showResults && searchResults.length > 0) && (
          <div
            ref={resultsRef}
            className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
          >
            {searchResults.map((result, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleLocationSelect({
                  id: result.id || `search-${index}`,
                  name: result.name,
                  address: result.address,
                  lat: result.coordinates?.lat || 0,
                  lng: result.coordinates?.lng || 0
                })}
                className="w-full px-3 py-2 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
              >
                <div className="font-medium text-xs sm:text-sm text-gray-900">{result.name}</div>
                <div className="text-xs text-gray-600">{result.address}</div>
              </button>
            ))}
          </div>
        )}

        {/* Popular Locations */}
        {(showPopular && popularLocations.length > 0) && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            <div className="px-3 py-2 text-xs font-medium text-gray-500 border-b border-gray-100">
              Popular Locations
            </div>
            {popularLocations.map((location) => (
              <button
                key={location.id}
                type="button"
                onClick={() => handleLocationSelect(location)}
                className="w-full px-3 py-2 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
              >
                <div className="font-medium text-xs sm:text-sm text-gray-900">{location.name}</div>
                <div className="text-xs text-gray-600">{location.address}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const RouteInputPanel: React.FC<RouteInputPanelProps> = ({
  preferences,
  onPreferencesChange,
  onRouteCalculate,
  isCalculating,
  popularLocations,
  selectedWaypoints,
  onWaypointAdd,
  onWaypointRemove
}) => {
  const [origin, setOrigin] = useState<LocationPoint | null>(null);
  const [destination, setDestination] = useState<LocationPoint | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [departureTime, setDepartureTime] = useState('');

  // Location search handler
  const handleLocationSearch = useCallback(async (query: string) => {
    setIsSearching(true);
    try {
      const response = await fetch(`/api/locations/search?q=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.results || []);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Location search failed:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Route calculation handler
  const handleCalculateRoute = useCallback(() => {
    if (!origin || !destination) {
      return;
    }

    const request: RouteRequest = {
      origin,
      destination,
      waypoints: selectedWaypoints.length > 0 ? selectedWaypoints : undefined,
      preferences: {
        ...preferences,
        departureTime: departureTime ? new Date(departureTime) : undefined
      }
    };

    onRouteCalculate(request);
  }, [origin, destination, selectedWaypoints, preferences, departureTime, onRouteCalculate]);

  // Swap origin and destination
  const handleSwapLocations = useCallback(() => {
    const temp = origin;
    setOrigin(destination);
    setDestination(temp);
  }, [origin, destination]);

  // Route type options
  const routeTypeOptions: Array<{ value: RouteType; label: string; description: string; icon: React.ReactNode }> = [
    { value: 'fastest', label: 'Fastest', description: 'Minimize travel time', icon: <Clock className="w-4 h-4" /> },
    { value: 'shortest', label: 'Shortest', description: 'Minimize distance', icon: <Navigation className="w-4 h-4" /> },
    { value: 'eco', label: 'Eco', description: 'Fuel efficient', icon: <div className="w-4 h-4 bg-green-500 rounded-full" /> },
    { value: 'thrilling', label: 'Scenic', description: 'Scenic route', icon: <div className="w-4 h-4 bg-purple-500 rounded-full" /> }
  ];

  // Vehicle type options
  const vehicleTypeOptions: Array<{ value: VehicleType; label: string; icon: React.ReactNode }> = [
    { value: 'car', label: 'Car', icon: <Car className="w-4 h-4" /> },
    { value: 'truck', label: 'Truck', icon: <Truck className="w-4 h-4" /> },
    { value: 'motorcycle', label: 'Motorcycle', icon: <Bike className="w-4 h-4" /> }
  ];

  return (
    <Card className="h-fit">
      <CardHeader className="pb-3 sm:pb-6">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <Navigation className="w-4 h-4 sm:w-5 sm:h-5" />
          Route Planning
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          Plan your optimal route with traffic-aware navigation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 sm:space-y-6">
        {/* Location Inputs */}
        <div className="space-y-4">
          <LocationInput
            label="From"
            placeholder="Enter starting location"
            value={origin}
            onChange={setOrigin}
            onSearch={handleLocationSearch}
            searchResults={searchResults}
            isSearching={isSearching}
            popularLocations={popularLocations}
            icon={<MapPin className="w-5 h-5 text-green-500" />}
          />

          {/* Swap Button */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleSwapLocations}
              className="p-2 text-gray-400 hover:text-blue-600 transition-colors bg-white border border-gray-300 rounded-full shadow-sm hover:shadow-md"
              title="Swap locations"
              disabled={!origin || !destination}
            >
              <ArrowRight className="w-4 h-4 transform rotate-90" />
            </button>
          </div>

          <LocationInput
            label="To"
            placeholder="Enter destination"
            value={destination}
            onChange={setDestination}
            onSearch={handleLocationSearch}
            searchResults={searchResults}
            isSearching={isSearching}
            popularLocations={popularLocations}
            icon={<MapPin className="w-5 h-5 text-red-500" />}
          />
        </div>

        {/* Waypoints */}
        {selectedWaypoints.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs sm:text-sm font-medium text-gray-700">Waypoints</Label>
            {selectedWaypoints.map((waypoint, index) => (
              <div key={waypoint.id} className="flex items-center space-x-2 p-2 bg-gray-50 rounded-lg">
                <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-medium">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm text-gray-900">{waypoint.name}</div>
                  <div className="text-xs text-gray-600">{waypoint.address}</div>
                </div>
                <button
                  type="button"
                  onClick={() => onWaypointRemove(waypoint.id)}
                  className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Route Type Selection */}
        <div className="space-y-2 sm:space-y-3">
          <Label className="text-xs sm:text-sm font-medium text-gray-700">Route Type</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {routeTypeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onPreferencesChange({ routeType: option.value })}
                className={`p-2 sm:p-3 border rounded-lg text-left transition-colors ${
                  preferences.routeType === option.value
                    ? 'border-blue-500 bg-blue-50 text-blue-900'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center space-x-2 mb-1">
                  {option.icon}
                  <span className="font-medium text-xs sm:text-sm">{option.label}</span>
                </div>
                <div className="text-xs text-gray-600">{option.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Advanced Options Toggle */}
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center space-x-2 text-xs sm:text-sm text-blue-600 hover:text-blue-800 transition-colors"
        >
          <Settings className="w-3 h-3 sm:w-4 sm:h-4" />
          <span>Advanced Options</span>
          <div className={`transform transition-transform ${showAdvanced ? 'rotate-180' : ''}`}>
            <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {/* Advanced Options */}
        {showAdvanced && (
          <div className="space-y-3 sm:space-y-4 p-3 sm:p-4 bg-gray-50 rounded-lg">
            {/* Vehicle Type */}
            <div className="space-y-2">
              <Label className="text-xs sm:text-sm font-medium text-gray-700">Vehicle Type</Label>
              <div className="flex flex-wrap gap-2">
                {vehicleTypeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onPreferencesChange({ vehicleType: option.value })}
                    className={`flex items-center space-x-1.5 sm:space-x-2 px-2 sm:px-3 py-1.5 sm:py-2 border rounded-lg transition-colors text-xs sm:text-sm ${
                      preferences.vehicleType === option.value
                        ? 'border-blue-500 bg-blue-50 text-blue-900'
                        : 'border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {option.icon}
                    <span>{option.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Departure Time */}
            <div className="space-y-2">
              <Label htmlFor="departure-time" className="text-xs sm:text-sm font-medium text-gray-700">
                Departure Time (Optional)
              </Label>
              <Input
                id="departure-time"
                type="datetime-local"
                value={departureTime}
                onChange={(e) => setDepartureTime(e.target.value)}
                className="w-full text-xs sm:text-sm"
              />
            </div>

            {/* Avoid Options */}
            <div className="space-y-2">
              <Label className="text-xs sm:text-sm font-medium text-gray-700">Avoid</Label>
              <div className="space-y-1.5 sm:space-y-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={preferences.avoidTolls || false}
                    onChange={(e) => onPreferencesChange({ avoidTolls: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs sm:text-sm text-gray-700">Toll roads</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={preferences.avoidFerries || false}
                    onChange={(e) => onPreferencesChange({ avoidFerries: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs sm:text-sm text-gray-700">Ferries</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={preferences.avoidTrafficJams || false}
                    onChange={(e) => onPreferencesChange({ avoidTrafficJams: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs sm:text-sm text-gray-700">Traffic jams</span>
                </label>
              </div>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="pt-3 sm:pt-6">
        {/* Calculate Button */}
        <Button
          onClick={handleCalculateRoute}
          disabled={!origin || !destination || isCalculating}
          className="w-full text-xs sm:text-sm"
        >
          {isCalculating ? (
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-2 border-white border-t-transparent"></div>
              <span>Calculating Route...</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <Navigation className="w-3 h-3 sm:w-4 sm:h-4" />
              <span>Find Optimal Route</span>
            </div>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default RouteInputPanel;