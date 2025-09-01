// src/components/QuickReportModal.tsx
import React, { useState, useEffect } from 'react';
import './QuickReportModal.css';

interface QuickReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (incidentType: string, location: { lat: number; lon: number; address: string }) => void;
}

type IncidentType = {
  id: string;
  name: string;
  icon: string;
};

const incidentTypes: IncidentType[] = [
  { id: 'collision', name: 'Collision', icon: '🚗' },
  { id: 'near_miss', name: 'Near Miss', icon: '⚠️' },
  { id: 'road_hazard', name: 'Road Hazard', icon: '🕳️' },
  { id: 'aggressive_driver', name: 'Aggressive Driver', icon: '😠' },
  { id: 'poor_infrastructure', name: 'Poor Infrastructure', icon: '🚧' },
  { id: 'other', name: 'Other', icon: '❓' },
];

export default function QuickReportModal({ isOpen, onClose, onSubmit }: QuickReportModalProps) {
  const [currentLocation, setCurrentLocation] = useState<{
    lat: number;
    lon: number;
    address: string;
  } | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);

  // Get user's current location when modal opens
  useEffect(() => {
    if (isOpen && !currentLocation) {
      getCurrentLocation();
    }
  }, [isOpen]);

  const getCurrentLocation = async () => {
    setIsLoadingLocation(true);
    try {
      if (!navigator.geolocation) {
        throw new Error('Geolocation not supported');
      }

      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
        });
      });

      const { latitude, longitude } = position.coords;
      
      // Get address from coordinates
      const address = await reverseGeocode(latitude, longitude);
      
      setCurrentLocation({
        lat: latitude,
        lon: longitude,
        address
      });
    } catch (error) {
      console.error('Failed to get location:', error);
      // Fallback to Melbourne CBD
      setCurrentLocation({
        lat: -37.8136,
        lon: 144.9631,
        address: 'Melbourne CBD'
      });
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const reverseGeocode = async (lat: number, lon: number): Promise<string> => {
    try {
      const response = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`
      );
      const data = await response.json();
      return data.city || data.locality || data.principality || 'Current Location';
    } catch {
      return 'Current Location';
    }
  };

  const handleIncidentSelect = (incidentType: string) => {
    if (currentLocation) {
      onSubmit(incidentType, currentLocation);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="quick-report-overlay">
      <div className="quick-report-modal">
        <div className="qr-header">
          <div className="qr-header-content">
            <div className="qr-icon">⚡</div>
            <div className="qr-title-section">
              <h3>Quick Report</h3>
              <p>Tap incident type to report</p>
            </div>
          </div>
          <button className="qr-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="qr-location">
          <div className="qr-location-icon">📍</div>
          <span>
            {isLoadingLocation ? 'Getting location...' : currentLocation?.address || 'Location unavailable'}
          </span>
        </div>

        <div className="qr-section-title">
          <h4>What happened?</h4>
        </div>

        <div className="qr-incident-types">
          {incidentTypes.map((incident) => (
            <button
              key={incident.id}
              className="qr-incident-btn"
              onClick={() => handleIncidentSelect(incident.id)}
              disabled={!currentLocation || isLoadingLocation}
            >
              <span className="qr-incident-icon">{incident.icon}</span>
              <span className="qr-incident-name">{incident.name}</span>
            </button>
          ))}
        </div>

        <div className="qr-footer-note">
          <p>
            Quick reports help us track incidents rapidly. For detailed reports with photos and descriptions, use the main Report Incident button.
          </p>
        </div>
      </div>
    </div>
  );
}