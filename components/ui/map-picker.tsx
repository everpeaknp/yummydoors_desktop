"use client";

import { KeyboardEvent, useEffect, useState, useCallback, useRef } from "react";
import { MapPin, Search } from "lucide-react";
import { GoogleMap, MarkerF } from "@react-google-maps/api";

import { useGoogleMaps } from "@/hooks/use-google-maps";

interface MapPickerProps {
  latitude: number | null;
  longitude: number | null;
  onChange: (lat: number, lng: number) => void;
  defaultCenter?: [number, number];
  showSearch?: boolean;
  heightClassName?: string;
  onResolvedAddress?: (label: string) => void;
}

type PlacePrediction = {
  description: string;
  place_id: string;
  structured_formatting?: {
    main_text?: string;
    secondary_text?: string;
  };
};

const containerStyle = {
  width: "100%",
  height: "100%",
};

export default function MapPicker({
  latitude,
  longitude,
  onChange,
  defaultCenter = [28.2096, 83.9856],
  showSearch = false,
  heightClassName = "h-[450px]",
  onResolvedAddress,
}: MapPickerProps) {
  const { isLoaded } = useGoogleMaps();

  const [position, setPosition] = useState<google.maps.LatLngLiteral | null>(
    latitude && longitude ? { lat: latitude, lng: longitude } : null
  );

  const defaultCenterLiteral = { lat: defaultCenter[0], lng: defaultCenter[1] };
  const mapRef = useRef<google.maps.Map | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activePredictionIndex, setActivePredictionIndex] = useState(-1);
  const searchWrapRef = useRef<HTMLDivElement | null>(null);
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);

  const onLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  const onUnmount = useCallback(() => {
    mapRef.current = null;
  }, []);

  useEffect(() => {
    if (latitude !== null && longitude !== null) {
      const newPos = { lat: latitude, lng: longitude };
      // Prevent infinite loop by checking if it actually changed significantly
      if (!position || Math.abs(position.lat - latitude) > 0.000001 || Math.abs(position.lng - longitude) > 0.000001) {
        setPosition(newPos);
        if (mapRef.current) {
          mapRef.current.panTo(newPos);
        }
      }
    }
  }, [latitude, longitude, position]);

  useEffect(() => {
    if (!isLoaded || typeof google === "undefined" || autocompleteServiceRef.current) {
      return;
    }

    autocompleteServiceRef.current = new google.maps.places.AutocompleteService();
  }, [isLoaded]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!searchWrapRef.current?.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const resolveAddress = useCallback(
    (lat: number, lng: number) => {
      if (!onResolvedAddress || typeof google === "undefined") {
        return;
      }

      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === "OK" && results?.[0]?.formatted_address) {
          onResolvedAddress(results[0].formatted_address);
        }
      });
    },
    [onResolvedAddress],
  );

  const handleMapClick = (e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      setPosition({ lat, lng });
      onChange(lat, lng);
      resolveAddress(lat, lng);
    }
  };

  const handleMarkerDragEnd = (e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      setPosition({ lat, lng });
      onChange(lat, lng);
      resolveAddress(lat, lng);
    }
  };

  const applyResolvedPlace = useCallback(
    (lat: number, lng: number, label?: string) => {
      const nextPosition = { lat, lng };
      setPosition(nextPosition);
      onChange(lat, lng);
      if (label) {
        onResolvedAddress?.(label);
      } else {
        resolveAddress(lat, lng);
      }
      if (mapRef.current) {
        mapRef.current.panTo(nextPosition);
        mapRef.current.setZoom(16);
      }
    },
    [onChange, onResolvedAddress, resolveAddress],
  );

  const handlePredictionSelect = useCallback(
    (prediction: PlacePrediction) => {
      if (typeof google === "undefined") {
        return;
      }

      setSearching(true);
      setSearchError(null);
      setSearchQuery(prediction.description);
      setPredictions([]);
      setDropdownOpen(false);
      setActivePredictionIndex(-1);

      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ placeId: prediction.place_id }, (results, status) => {
        setSearching(false);

        if (status !== "OK" || !results?.[0]?.geometry?.location) {
          setSearchError("Location not found. Try a more specific place.");
          return;
        }

        const lat = results[0].geometry.location.lat();
        const lng = results[0].geometry.location.lng();
        applyResolvedPlace(lat, lng, results[0].formatted_address || prediction.description);
      });
    },
    [applyResolvedPlace],
  );

  useEffect(() => {
    if (!showSearch || !searchQuery.trim() || !autocompleteServiceRef.current) {
      setPredictions([]);
      setDropdownOpen(false);
      setActivePredictionIndex(-1);
      return;
    }

    const timer = window.setTimeout(() => {
      autocompleteServiceRef.current?.getPlacePredictions(
        {
          input: searchQuery.trim(),
          componentRestrictions: { country: "np" },
        },
        (results, status) => {
          if (status !== google.maps.places.PlacesServiceStatus.OK || !results?.length) {
            setPredictions([]);
            setDropdownOpen(false);
            setActivePredictionIndex(-1);
            return;
          }

          setPredictions(results as PlacePrediction[]);
          setDropdownOpen(true);
          setActivePredictionIndex(-1);
        },
      );
    }, 180);

    return () => window.clearTimeout(timer);
  }, [searchQuery, showSearch]);

  const runSearch = useCallback(() => {
    if (predictions.length > 0) {
      const prediction =
        activePredictionIndex >= 0 ? predictions[activePredictionIndex] : predictions[0];
      handlePredictionSelect(prediction);
      return true;
    }

    if (!searchQuery.trim() || typeof google === "undefined") {
      return false;
    }

    setSearching(true);
    setSearchError(null);

    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: searchQuery.trim() }, (results, status) => {
      setSearching(false);

      if (status !== "OK" || !results?.[0]?.geometry?.location) {
        setSearchError("Location not found. Try a more specific place.");
        return;
      }

      const lat = results[0].geometry.location.lat();
      const lng = results[0].geometry.location.lng();
      applyResolvedPlace(lat, lng, results[0].formatted_address || searchQuery.trim());
    });
    return true;
  }, [
    activePredictionIndex,
    applyResolvedPlace,
    handlePredictionSelect,
    predictions,
    searchQuery,
  ]);

  if (!isLoaded) {
    return (
      <div className={`${heightClassName} flex w-full items-center justify-center rounded-[16px] border border-black/6 bg-[#f4f4f1] text-sm text-gray-500`}>
        Loading map...
      </div>
    );
  }

  return (
    <div className={`z-0 w-full overflow-hidden rounded-[16px] border border-black/6 bg-white shadow-[0_10px_32px_rgba(15,23,42,0.05)] ${heightClassName}`}>
      {showSearch ? (
        <div className="border-b border-black/5 bg-[#fcfcfa] px-4 py-4">
          <div className="space-y-3">
            <div className="flex flex-col gap-3">
              <div className="relative flex-1" ref={searchWrapRef}>
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={searchQuery}
                  onChange={(event) => {
                    setSearchQuery(event.target.value);
                    setSearchError(null);
                  }}
                  onFocus={() => {
                    if (predictions.length > 0) {
                      setDropdownOpen(true);
                    }
                  }}
                  onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void runSearch();
                      return;
                    }

                    if (!predictions.length) {
                      return;
                    }

                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      setDropdownOpen(true);
                      setActivePredictionIndex((current) =>
                        current >= predictions.length - 1 ? 0 : current + 1,
                      );
                    }

                    if (event.key === "ArrowUp") {
                      event.preventDefault();
                      setDropdownOpen(true);
                      setActivePredictionIndex((current) =>
                        current <= 0 ? predictions.length - 1 : current - 1,
                      );
                    }

                    if (event.key === "Escape") {
                      setDropdownOpen(false);
                      setActivePredictionIndex(-1);
                    }
                  }}
                  placeholder="Search area, street, or landmark"
                  className="h-11 w-full rounded-[12px] border border-black/8 bg-white pl-11 pr-4 text-sm outline-none transition focus:border-primary"
                />
                {dropdownOpen && predictions.length > 0 ? (
                  <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 overflow-hidden rounded-[14px] border border-black/8 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.12)]">
                    <ul className="max-h-72 overflow-y-auto py-2">
                      {predictions.map((prediction, index) => (
                        <li key={prediction.place_id}>
                          <button
                            type="button"
                            onClick={() => handlePredictionSelect(prediction)}
                            className={`flex w-full items-start gap-3 px-4 py-3 text-left transition ${
                              index === activePredictionIndex ? "bg-[#f7f3eb]" : "hover:bg-[#fbf8f2]"
                            }`}
                          >
                            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium text-[#20242b]">
                                {prediction.structured_formatting?.main_text ?? prediction.description}
                              </span>
                              {prediction.structured_formatting?.secondary_text ? (
                                <span className="block truncate text-xs text-[#6b7280]">
                                  {prediction.structured_formatting.secondary_text}
                                </span>
                              ) : null}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </div>
            {searchError ? <p className="text-sm text-[#9a3412]">{searchError}</p> : null}
            <div className="sr-only" aria-live="polite">
              {searching ? "Searching location" : ""}
            </div>
          </div>
        </div>
      ) : null}

      <div className={showSearch ? "h-[calc(100%-92px)]" : "h-full"}>
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={position || defaultCenterLiteral}
        zoom={position ? 16 : 14}
        onLoad={onLoad}
        onUnmount={onUnmount}
        onClick={handleMapClick}
        options={{
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        }}
      >
        {position && (
          <MarkerF
            position={position}
            draggable={true}
            onDragEnd={handleMarkerDragEnd}
          />
        )}
      </GoogleMap>
      </div>
    </div>
  );
}
