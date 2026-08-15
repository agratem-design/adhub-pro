import { useCallback, useRef, useEffect, useState } from 'react';

interface VoiceAlertSettings {
  enabled: boolean;
  volume: number;
  alertDistance: number; // meters
  language: 'ar' | 'en';
}

interface NearbyBillboard {
  id: number;
  name: string;
  distance: number;
  landmark?: string;
}

const DEFAULT_SETTINGS: VoiceAlertSettings = {
  enabled: true,
  volume: 1.0,
  alertDistance: 100,
  language: 'ar'
};

export function useVoiceAlerts() {
  const [settings, setSettings] = useState<VoiceAlertSettings>(DEFAULT_SETTINGS);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const alertedBillboardsRef = useRef<Set<number>>(new Set());
  const speechQueueRef = useRef<string[]>([]);
  const isSpeakingRef = useRef(false);
  
  // Check if speech synthesis is supported
  const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  
  // Get Arabic voice
  const getArabicVoice = useCallback((): SpeechSynthesisVoice | null => {
    if (!isSupported) return null;
    
    const voices = window.speechSynthesis.getVoices();
    
    // Try to find Arabic voice
    const arabicVoice = voices.find(v => 
      v.lang.startsWith('ar') || 
      v.name.toLowerCase().includes('arabic') ||
      v.name.includes('العربية')
    );
    
    // Fallback to any available voice
    return arabicVoice || voices[0] || null;
  }, [isSupported]);
  
  // Speak text
  const speak = useCallback((text: string, priority: boolean = false) => {
    if (!isSupported || !settings.enabled) return;
    
    if (priority) {
      // Cancel current speech for high priority
      window.speechSynthesis.cancel();
      speechQueueRef.current = [text];
    } else {
      speechQueueRef.current.push(text);
    }
    
    const processQueue = () => {
      if (isSpeakingRef.current || speechQueueRef.current.length === 0) return;
      
      const nextText = speechQueueRef.current.shift();
      if (!nextText) return;
      
      const utterance = new SpeechSynthesisUtterance(nextText);
      utterance.volume = settings.volume;
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      
      const voice = getArabicVoice();
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      } else {
        utterance.lang = settings.language === 'ar' ? 'ar-SA' : 'en-US';
      }
      
      utterance.onstart = () => {
        isSpeakingRef.current = true;
        setIsSpeaking(true);
      };
      
      utterance.onend = () => {
        isSpeakingRef.current = false;
        setIsSpeaking(false);
        // Process next in queue
        setTimeout(processQueue, 300);
      };
      
      utterance.onerror = () => {
        isSpeakingRef.current = false;
        setIsSpeaking(false);
        setTimeout(processQueue, 100);
      };
      
      window.speechSynthesis.speak(utterance);
    };
    
    processQueue();
  }, [isSupported, settings.enabled, settings.volume, settings.language, getArabicVoice]);
  
  // Alert for approaching billboard
  const alertApproachingBillboard = useCallback((billboard: NearbyBillboard) => {
    if (!settings.enabled) return;
    if (alertedBillboardsRef.current.has(billboard.id)) return;
    
    // Only alert when within configured distance
    if (billboard.distance > settings.alertDistance) return;
    
    alertedBillboardsRef.current.add(billboard.id);
    
    const distanceText = billboard.distance < 30 
      ? 'قريب جداً' 
      : billboard.distance < 50 
        ? `${Math.round(billboard.distance)} متر`
        : `على بعد ${Math.round(billboard.distance)} متر`;
    
    const message = billboard.distance < 30
      ? `وصلت إلى اللوحة رقم ${billboard.id}`
      : `اقتربت من لوحة. ${distanceText}`;
    
    speak(message, billboard.distance < 30);
  }, [settings.enabled, settings.alertDistance, speak]);
  
  // Alert for very close billboard (< 30m)
  const alertVeryCloseBillboard = useCallback((billboard: NearbyBillboard) => {
    if (!settings.enabled) return;
    
    const message = `لوحة ${billboard.id}. ${Math.round(billboard.distance)} متر`;
    speak(message, true);
  }, [settings.enabled, speak]);
  
  // Alert for starting tracking
  const alertTrackingStarted = useCallback(() => {
    if (!settings.enabled) return;
    speak('بدء التتبع المباشر', true);
  }, [settings.enabled, speak]);
  
  // Alert for stopping tracking
  const alertTrackingStopped = useCallback((billboardsCount: number, distance: number) => {
    if (!settings.enabled) return;
    const distanceKm = (distance / 1000).toFixed(1);
    const message = `انتهى التتبع. مررت بـ ${billboardsCount} لوحة. المسافة ${distanceKm} كيلومتر`;
    speak(message, true);
  }, [settings.enabled, speak]);
  
  // Clear alerted billboards (for new tracking session)
  const clearAlertedBillboards = useCallback(() => {
    alertedBillboardsRef.current.clear();
  }, []);
  
  // Update settings
  const updateSettings = useCallback((newSettings: Partial<VoiceAlertSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);
  
  // Toggle enabled
  const toggleEnabled = useCallback(() => {
    setSettings(prev => ({ ...prev, enabled: !prev.enabled }));
  }, []);
  
  // Stop all speech
  const stopSpeaking = useCallback(() => {
    if (isSupported) {
      window.speechSynthesis.cancel();
      speechQueueRef.current = [];
      isSpeakingRef.current = false;
      setIsSpeaking(false);
    }
  }, [isSupported]);
  
  // Load voices on mount
  useEffect(() => {
    if (!isSupported) return;
    
    // Chrome requires waiting for voiceschanged event
    const loadVoices = () => {
      window.speechSynthesis.getVoices();
    };
    
    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
    };
  }, [isSupported]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isSupported) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isSupported]);
  
  return {
    settings,
    updateSettings,
    toggleEnabled,
    isSpeaking,
    isSupported,
    speak,
    alertApproachingBillboard,
    alertVeryCloseBillboard,
    alertTrackingStarted,
    alertTrackingStopped,
    clearAlertedBillboards,
    stopSpeaking
  };
}

export default useVoiceAlerts;
