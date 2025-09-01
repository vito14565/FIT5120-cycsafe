// src/components/NotificationSettings.tsx
import React, { useState, useEffect } from 'react';
import './NotificationSettings.css';

interface NotificationSettingsProps {
  onSettingsChange?: (settings: NotificationSettings) => void;
}

export interface NotificationSettings {
  enableWeather: boolean;
  enableTraffic: boolean;
  enableInfra: boolean;
  enableSafety: boolean;
  criticalOnly: boolean;
  pushNotifications: boolean;
}

const defaultSettings: NotificationSettings = {
  enableWeather: true,
  enableTraffic: true,
  enableInfra: true,
  enableSafety: true,
  criticalOnly: false,
  pushNotifications: true,
};

export default function NotificationSettings({ onSettingsChange }: NotificationSettingsProps) {
  const [settings, setSettings] = useState<NotificationSettings>(defaultSettings);
  const [isExpanded, setIsExpanded] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('cs.notification.settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        setSettings({ ...defaultSettings, ...parsed });
      }
    } catch (error) {
      console.warn('Failed to load notification settings:', error);
    }
  }, []);

  // Save settings when they change
  const updateSetting = <K extends keyof NotificationSettings>(
    key: K,
    value: NotificationSettings[K]
  ) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    
    try {
      localStorage.setItem('cs.notification.settings', JSON.stringify(newSettings));
    } catch (error) {
      console.warn('Failed to save notification settings:', error);
    }
    
    onSettingsChange?.(newSettings);
  };

  return (
    <section className="notification-settings">
      <button 
        className="settings-header"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
      >
        <div className="settings-title">
          <h3>Notification Settings</h3>
          <p>Customize your alert preferences</p>
        </div>
        <div className="settings-action">
          <span>{isExpanded ? 'Collapse' : 'Configure'}</span>
          <svg 
            className={`chevron ${isExpanded ? 'expanded' : ''}`}
            width="20" 
            height="20" 
            viewBox="0 0 20 20" 
            fill="currentColor"
          >
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </div>
      </button>

      {isExpanded && (
        <div className="settings-content">
          <div className="settings-group">
            <h4>Alert Categories</h4>
            <div className="setting-item">
              <label>
                <input
                  type="checkbox"
                  checked={settings.enableWeather}
                  onChange={(e) => updateSetting('enableWeather', e.target.checked)}
                />
                <span>Weather Alerts</span>
              </label>
              <small>Severe weather and cycling conditions</small>
            </div>
            
            <div className="setting-item">
              <label>
                <input
                  type="checkbox"
                  checked={settings.enableTraffic}
                  onChange={(e) => updateSetting('enableTraffic', e.target.checked)}
                />
                <span>Traffic Incidents</span>
              </label>
              <small>Road closures and accidents</small>
            </div>
            
            <div className="setting-item">
              <label>
                <input
                  type="checkbox"
                  checked={settings.enableInfra}
                  onChange={(e) => updateSetting('enableInfra', e.target.checked)}
                />
                <span>Infrastructure Works</span>
              </label>
              <small>Road works and maintenance</small>
            </div>
            
            <div className="setting-item">
              <label>
                <input
                  type="checkbox"
                  checked={settings.enableSafety}
                  onChange={(e) => updateSetting('enableSafety', e.target.checked)}
                />
                <span>Safety Warnings</span>
              </label>
              <small>General safety information</small>
            </div>
          </div>

          <div className="settings-group">
            <h4>Notification Preferences</h4>
            <div className="setting-item">
              <label>
                <input
                  type="checkbox"
                  checked={settings.criticalOnly}
                  onChange={(e) => updateSetting('criticalOnly', e.target.checked)}
                />
                <span>Critical Alerts Only</span>
              </label>
              <small>Only show high priority alerts</small>
            </div>
            
            <div className="setting-item">
              <label>
                <input
                  type="checkbox"
                  checked={settings.pushNotifications}
                  onChange={(e) => updateSetting('pushNotifications', e.target.checked)}
                />
                <span>Push Notifications</span>
              </label>
              <small>Receive browser notifications for new alerts</small>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}