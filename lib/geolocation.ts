export type GeoCoords = { latitude: number; longitude: number };

/**
 * Promisified wrapper with human-readable messages per error code — V1 had
 * the same shape. City/address auto-detection from coordinates (V1 also
 * had this, via static bounding boxes for a handful of Indian metros) is
 * deliberately NOT ported here: the Part 1 audit recorded that the feature
 * existed but not its exact coordinate boundaries, and fabricating
 * plausible-looking bounding boxes to fill the gap would be worse than not
 * having the feature. This just returns coordinates; city/address stay
 * manually entered until there's a real geocoding source to base it on.
 */
export function getCurrentLocation(): Promise<GeoCoords> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Your browser doesn't support location detection."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            reject(new Error("Location access was denied. Enter your address manually instead."));
            break;
          case error.POSITION_UNAVAILABLE:
            reject(new Error("Your location couldn't be determined. Enter your address manually instead."));
            break;
          case error.TIMEOUT:
            reject(new Error("Location request timed out. Try again or enter your address manually."));
            break;
          default:
            reject(new Error("Couldn't get your location. Enter your address manually instead."));
        }
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  });
}
