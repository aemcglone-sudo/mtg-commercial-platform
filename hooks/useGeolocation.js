import { useState, useEffect, useCallback } from 'react';

const ERROR_MESSAGES = {
  PERMISSION_DENIED: 'Location permission denied. Enable it in browser settings.',
  POSITION_UNAVAILABLE: 'Your location is currently unavailable.',
  TIMEOUT: 'Location request timed out. Please try again.',
  NOT_SUPPORTED: 'Geolocation is not supported in your browser.',
  UNKNOWN: 'An unknown error occurred while getting your location.',
};

export function useGeolocation(options = {}) {
  const {
    enableHighAccuracy = false,
    timeout = 10000,
    maximumAge = 0,
  } = options;

  const [state, setState] = useState({
    latitude: null,
    longitude: null,
    accuracy: null,
    error: null,
    loading: false,
    permissionState: 'prompt', // 'prompt', 'granted', 'denied', 'unsupported'
  });

  const requestLocation = useCallback(() => {
    // Check if geolocation is supported
    if (!navigator?.geolocation) {
      setState(prev => ({
        ...prev,
        error: ERROR_MESSAGES.NOT_SUPPORTED,
        permissionState: 'unsupported',
      }));
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          error: null,
          loading: false,
          permissionState: 'granted',
        });
      },
      (error) => {
        let errorMessage = ERROR_MESSAGES.UNKNOWN;
        let permissionState = 'prompt';

        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = ERROR_MESSAGES.PERMISSION_DENIED;
            permissionState = 'denied';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = ERROR_MESSAGES.POSITION_UNAVAILABLE;
            break;
          case error.TIMEOUT:
            errorMessage = ERROR_MESSAGES.TIMEOUT;
            break;
          default:
            errorMessage = ERROR_MESSAGES.UNKNOWN;
        }

        setState({
          latitude: null,
          longitude: null,
          accuracy: null,
          error: errorMessage,
          loading: false,
          permissionState,
        });
      },
      {
        enableHighAccuracy,
        timeout,
        maximumAge,
      }
    );
  }, [enableHighAccuracy, timeout, maximumAge]);

  // Auto-request on mount if desired
  useEffect(() => {
    // Don't auto-request; let the component explicitly call requestLocation
  }, []);

  return {
    ...state,
    requestLocation,
  };
}
