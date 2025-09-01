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
  const [selectedIncident, setSelectedIncident] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedIncident(null);
      setShowConfirmation(false);
      if (!currentLocation) {
        getCurrentLocation();
      }
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

  const handleIncidentSelect = (incidentId: string) => {
    setSelectedIncident(incidentId);
  };

  const handleSubmit = async () => {
    if (!selectedIncident || !currentLocation) return;

    setIsSubmitting(true);
    try {
      // Submit to backend API
      await onSubmit(selectedIncident, currentLocation);
      
      // Show confirmation popup
      setShowConfirmation(true);
      
      // Hide confirmation after 2 seconds and close modal
      setTimeout(() => {
        setShowConfirmation(false);
        onClose();
      }, 2000);
      
    } catch (error) {
      console.error('Failed to submit report:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedIncident(null);
    setShowConfirmation(false);
    onClose();
  };

  if (!isOpen) return null;

  // Confirmation popup
  if (showConfirmation) {
    return (
      <div className="quick-report-overlay">
        <div className="qr-confirmation-popup">
          <div className="qr-confirmation-icon">✅</div>
          <h3>Thank you!</h3>
          <p>Your response has been submitted</p>
        </div>
      </div>
    );
  }

  const selectedIncidentType = incidentTypes.find(type => type.id === selectedIncident);

  return (
    <div className="quick-report-overlay">
      <div className="quick-report-modal">
        <div className="qr-header">
          <div className="qr-header-content">
            <div className="qr-icon">⚡</div>
            <div className="qr-title-section">
              <h3>Quick Report</h3>
              <p>Select incident type and submit</p>
            </div>
          </div>
          <button className="qr-close-btn" onClick={handleClose}>
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
              className={`qr-incident-btn ${selectedIncident === incident.id ? 'selected' : ''}`}
              onClick={() => handleIncidentSelect(incident.id)}
              disabled={!currentLocation || isLoadingLocation}
            >
              <span className="qr-incident-icon">{incident.icon}</span>
              <span className="qr-incident-name">{incident.name}</span>
              {selectedIncident === incident.id && (
                <span className="qr-selected-check">✓</span>
              )}
            </button>
          ))}
        </div>

        {selectedIncident && (
          <div className="qr-submit-section">
            <div className="qr-selected-summary">
              <span className="qr-summary-label">Selected:</span>
              <span className="qr-summary-incident">
                {selectedIncidentType?.icon} {selectedIncidentType?.name}
              </span>
            </div>
            <button 
              className="qr-submit-btn"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Report'}
            </button>
          </div>
        )}

        <div className="qr-footer-note">
          <p>
            Quick reports help us track incidents rapidly. For detailed reports with photos and descriptions, use the main Report Incident button.
          </p>
        </div>
      </div>
    </div>
  );
}