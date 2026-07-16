
import React, { useState, useEffect } from 'react';
import { BlogPost } from '../types';
import { supabaseService } from '../services/supabaseService';

interface AlertBannerProps {
  audience?: 'ALL' | 'STUDENTS' | 'PARENTS';
}

const AlertBanner: React.FC<AlertBannerProps> = ({ audience = 'ALL' }) => {
  const [alerts, setAlerts] = useState<BlogPost[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadAlerts();
  }, [audience]);

  const loadAlerts = async () => {
    try {
      const posts = await supabaseService.getBlogPosts(audience);
      // Filter to high priority alerts only
      const highPriority = posts.filter(p =>
        p.priority === 'HIGH' &&
        p.isPublished &&
        (p.targetAudience === 'ALL' || p.targetAudience === audience)
      );
      setAlerts(highPriority);
    } catch (err) {
      console.error('Failed to load alerts:', err);
    }
  };

  const handleDismiss = (id: string) => {
    setDismissed(prev => new Set([...prev, id]));
    // Store dismissal in localStorage for persistence
    const dismissedIds = JSON.parse(localStorage.getItem('dismissed_alerts') || '[]');
    dismissedIds.push(id);
    localStorage.setItem('dismissed_alerts', JSON.stringify(dismissedIds));
  };

  // Load dismissed alerts from localStorage on mount
  useEffect(() => {
    const dismissedIds = JSON.parse(localStorage.getItem('dismissed_alerts') || '[]');
    setDismissed(new Set(dismissedIds));
  }, []);

  // Filter out dismissed alerts
  const visibleAlerts = alerts.filter(a => !dismissed.has(a.id));

  if (visibleAlerts.length === 0) return null;

  const currentAlert = visibleAlerts[currentIndex % visibleAlerts.length];

  return (
    <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white px-4 py-3 relative">
      <div className="flex items-center gap-3 max-w-4xl mx-auto">
        {/* Alert Icon */}
        <div className="flex-shrink-0">
          <span className="text-xl animate-pulse">🚨</span>
        </div>

        {/* Content */}
        <div className="flex-grow min-w-0">
          <div className="font-black text-sm uppercase tracking-wide">{currentAlert.title}</div>
          {currentAlert.excerpt && (
            <div className="text-xs text-white/90 truncate">{currentAlert.excerpt}</div>
          )}
        </div>

        {/* Navigation (if multiple alerts) */}
        {visibleAlerts.length > 1 && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setCurrentIndex(prev => (prev - 1 + visibleAlerts.length) % visibleAlerts.length)}
              className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs"
            >
              ←
            </button>
            <span className="text-xs font-bold">{currentIndex + 1}/{visibleAlerts.length}</span>
            <button
              onClick={() => setCurrentIndex(prev => (prev + 1) % visibleAlerts.length)}
              className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs"
            >
              →
            </button>
          </div>
        )}

        {/* Dismiss Button */}
        <button
          onClick={() => handleDismiss(currentAlert.id)}
          className="flex-shrink-0 w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-sm hover:bg-white/30 transition-all"
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default AlertBanner;
