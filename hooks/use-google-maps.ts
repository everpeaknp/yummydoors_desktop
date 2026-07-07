"use client";

import { useJsApiLoader } from "@react-google-maps/api";

const GOOGLE_MAP_LIBRARIES: ("places")[] = ["places"];

export function useGoogleMaps() {
  return useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY as string,
    libraries: GOOGLE_MAP_LIBRARIES,
    preventGoogleFontsLoading: true,
  });
}
