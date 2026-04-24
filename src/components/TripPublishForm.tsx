/**
 * Trip Publish Form
 * 
 * Creates a Trip from multiple images with GPS data
 * - First image = title image, determines country and location
 * - Each image can have GPS (auto-detected or manual)
 * - Each image gets a description
 * - Images are sortable via drag & drop
 * - Preview shows the route on a map
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import exifr from 'exifr';
import { SlideshowBlock } from '@/components/SlideshowBlock';
import { TeaserPreviewBox, type TeaserPreviewData } from '@/components/TeaserPreviewBox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { nip19 } from 'nostr-tools';
import { useToast } from '@/hooks/useToast';
import { useUploadFile } from '@/hooks/useUploadFile';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useTrip } from '@/hooks/useTrips';
import { GpsEditor } from '@/components/GpsEditor';
import { GpsStatusIndicator } from '@/components/GpsStatusIndicator';
import { LocationPicker } from '@/components/LocationPicker';
import { CountrySelector, getCountryTag } from '@/components/CountrySelector';
import { VanillaMap, TILE_LAYERS, type MapMarker } from '@/components/VanillaMap';
import { TRIP_TYPES, type TripType } from '@/config/tags';
import { 
  Camera, Upload, MapPin, Loader2, CheckCircle, GripVertical, X, 
  ChevronLeft, ChevronRight, Route, Clock, Map as MapIcon, Trash2, Edit3
} from '@/lib/icons';
import { 
  extractGpsFromImage, formatCoordinatesSimple, reverseGeocode, mapCountryCode,
  type GpsData, type GpsStatus
} from '@/lib/gpsExtraction';

/**
 * Komprimiert ein Bild auf max. targetSizeBytes (Standard: 2MB)
 * Gibt ein neues File-Objekt zurück – GPS/EXIF gehen verloren (egal, die sind schon extrahiert)
 */
async function compressImageForUpload(file: File, targetSizeBytes = 2 * 1024 * 1024): Promise<File> {
  // Nur Bilder komprimieren, Videos/Audio/Docs unverändert lassen
  if (!file.type.startsWith('image/')) return file;
  // Wenn schon klein genug → Original zurückgeben
  if (file.size <= targetSizeBytes) return file;

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');

      // Maximale Dimension: 1920px (ausreichend für KI-Analyse)
      const MAX_DIM = 1920;
      let { naturalWidth: w, naturalHeight: h } = img;
      if (w > MAX_DIM || h > MAX_DIM) {
        if (w > h) { h = Math.round(h * MAX_DIM / w); w = MAX_DIM; }
        else        { w = Math.round(w * MAX_DIM / h); h = MAX_DIM; }
      }
      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(file); return; }
      ctx.drawImage(img, 0, 0, w, h);

      // Qualität iterativ reduzieren bis Zielgröße erreicht
      const tryQuality = (quality: number) => {
        canvas.toBlob((blob) => {
          if (!blob) { resolve(file); return; }
          if (blob.size <= targetSizeBytes || quality <= 0.3) {
            const compressed = new File([blob], file.name, { type: 'image/jpeg', lastModified: file.lastModified });
            console.log(`[Compress] ${file.name}: ${(file.size/1024/1024).toFixed(1)}MB → ${(compressed.size/1024/1024).toFixed(1)}MB (q=${quality.toFixed(1)})`);
            resolve(compressed);
          } else {
            tryQuality(quality - 0.1);
          }
        }, 'image/jpeg', quality);
      };
      tryQuality(0.82);
    };

    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

/**
 * Erstellt eine korrigierte Vorschau basierend auf EXIF-Daten
 * Berücksichtigt die EXIF-Orientierung, die Browser oft ignorieren
 */
async function createCorrectedPreview(
  file: File, 
  exifWidth?: number, 
  exifHeight?: number,
  exifOrientation?: number
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      const actualWidth = img.naturalWidth;
      const actualHeight = img.naturalHeight;
      
      console.log(`[Preview] ${file.name}: Actual dimensions ${actualWidth}x${actualHeight}`);
      console.log(`[Preview] ${file.name}: EXIF Orientation = ${exifOrientation || 'not set'}`);
      
      // Rotation basierend auf EXIF Orientation (1-8)
      let rotation = 0;
      let flipH = false;
      
      if (exifOrientation) {
        switch (exifOrientation) {
          case 2: flipH = true; break;
          case 3: rotation = 180; break;
          case 4: rotation = 180; flipH = true; break;
          case 5: rotation = -90; flipH = true; break;
          case 6: rotation = 90; break;  // 90° CW korrigiert 90° CCW
          case 7: rotation = 90; flipH = true; break;
          case 8: rotation = -90; break;
        }
        if (rotation !== 0 || flipH) {
          console.log(`[Preview] ${file.name}: Applying correction - rotation=${rotation}°, flipH=${flipH}`);
        }
      } else {
        // Fallback: Versuche basierend auf EXIF-Dimensionen zu erkennen
        if (exifWidth && exifHeight) {
          if (exifWidth > exifHeight && actualHeight > actualWidth) {
            rotation = 90;
            console.log(`[Preview] ${file.name}: Detected dimension mismatch, applying 90° CW`);
          } else if (exifHeight > exifWidth && actualWidth > actualHeight) {
            rotation = -90;
            console.log(`[Preview] ${file.name}: Detected dimension mismatch, applying 90° CCW`);
          }
        }
      }
      
      // Canvas erstellen
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        URL.revokeObjectURL(url);
        resolve(url);
        return;
      }
      
      // Canvas-Größe basierend auf Rotation
      if (rotation === 90 || rotation === -90) {
        canvas.width = actualHeight;
        canvas.height = actualWidth;
      } else {
        canvas.width = actualWidth;
        canvas.height = actualHeight;
      }
      
      // Transformation anwenden
      ctx.translate(canvas.width / 2, canvas.height / 2);
      if (rotation !== 0) {
        ctx.rotate((rotation * Math.PI) / 180);
      }
      if (flipH) {
        ctx.scale(-1, 1);
      }
      
      // Zeichnen
      ctx.drawImage(img, -actualWidth / 2, -actualHeight / 2);
      
      URL.revokeObjectURL(url);
      
      // Data URL zurückgeben
      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(URL.createObjectURL(file));
    };
    
    img.src = url;
  });
}

/**
 * Create a corrected File with proper orientation (for upload)
 * Returns a new File with the image rotated correctly
 */
async function createCorrectedFile(
  file: File, 
  exifOrientation?: number
): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      const actualWidth = img.naturalWidth;
      const actualHeight = img.naturalHeight;
      
      // Rotation basierend auf EXIF Orientation (1-8)
      let rotation = 0;
      let flipH = false;
      
      if (exifOrientation && exifOrientation !== 1) {
        switch (exifOrientation) {
          case 2: flipH = true; break;
          case 3: rotation = 180; break;
          case 4: rotation = 180; flipH = true; break;
          case 5: rotation = -90; flipH = true; break;
          case 6: rotation = 90; break;
          case 7: rotation = 90; flipH = true; break;
          case 8: rotation = -90; break;
        }
        console.log(`[Corrected File] ${file.name}: Orientation=${exifOrientation}, applying rotation=${rotation}°`);
      }
      
      // Wenn keine Korrektur nötig, Original zurückgeben
      if (rotation === 0 && !flipH) {
        URL.revokeObjectURL(url);
        resolve(file);
        return;
      }
      
      // Canvas erstellen
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        URL.revokeObjectURL(url);
        resolve(file);
        return;
      }
      
      // Canvas-Größe basierend auf Rotation
      if (rotation === 90 || rotation === -90) {
        canvas.width = actualHeight;
        canvas.height = actualWidth;
      } else {
        canvas.width = actualWidth;
        canvas.height = actualHeight;
      }
      
      // Transformation anwenden
      ctx.translate(canvas.width / 2, canvas.height / 2);
      if (rotation !== 0) {
        ctx.rotate((rotation * Math.PI) / 180);
      }
      if (flipH) {
        ctx.scale(-1, 1);
      }
      
      // Zeichnen
      ctx.drawImage(img, -actualWidth / 2, -actualHeight / 2);
      
      URL.revokeObjectURL(url);
      
      // Canvas to Blob, dann zu File
      canvas.toBlob((blob) => {
        if (!blob) {
          resolve(file);
          return;
        }
        const correctedFile = new File([blob], file.name, {
          type: 'image/jpeg',
          lastModified: file.lastModified
        });
        console.log(`[Corrected File] ${file.name}: Created corrected file, size=${correctedFile.size}`);
        resolve(correctedFile);
      }, 'image/jpeg', 0.9);
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    
    img.src = url;
  });
}

// Calculate distance between two coordinates using Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Trip Station - represents one image with GPS and description
interface TripStation {
  id: string;
  file: File;
  preview: string;
  uploaded?: boolean;
  uploadedUrl?: string;
  
  // GPS data
  gps?: GpsData;
  gpsStatus: GpsStatus;
  
  // Location info (auto-filled from GPS, but manually editable)
  location: string;
  
  // User content
  title: string;
  description: string;
  date: string;
  
  // EXIF timestamp for sorting
  timestamp?: number;
  
  // EXIF orientation for upload correction
  exifOrientation?: number;
}

// Trip metadata
interface TripData {
  title: string;
  summary: string;
  country: string;
  tripType: TripType | '';
}

// Step wizard state
type WizardStep = 'upload' | 'details' | 'preview' | 'publish';

export function TripPublishForm() {
  // URL params for edit mode
  const [searchParams] = useSearchParams();
  const editNaddr = searchParams.get('edit');
  const isEditMode = !!editNaddr;
  
  // Load existing trip for editing
  const { data: existingTrip, isLoading: isLoadingExisting } = useTrip(editNaddr || '');
  
  // State
  const [stations, setStations] = useState<TripStation[]>([]);
  const [tripData, setTripData] = useState<TripData>({
    title: '',
    summary: '',
    country: '',
    tripType: '',
  });
  const [currentStep, setCurrentStep] = useState<WizardStep>('upload');
  const [editingStation, setEditingStation] = useState<string | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [editDtag, setEditDtag] = useState<string | null>(null); // Store d-tag for updates
  
  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, status: '' });
  const [isPublishing, setIsPublishing] = useState(false);
  
  // KI-Artikelgenerierung state
  const [isGeneratingArticle, setIsGeneratingArticle] = useState(false);
  const [generatingProgress, setGeneratingProgress] = useState(0);
  const [selectedModel, setSelectedModel] = useState<'llama4' | 'claude'>('llama4');
  const [lifestyle, setLifestyle] = useState<'mojobus' | 'vanlife' | 'rvlife' | 'beachlife' | 'wohnmobil' | 'perpetual-travelers'>('mojobus');
  const [tripLength, setTripLength] = useState<'short' | 'medium' | 'long'>('medium');
  const [aiGeneratedCaptions, setAiGeneratedCaptions] = useState<Set<string>>(new Set()); // station.ids mit KI-Caption
  const [slideshowVideoUrl, setSlideshowVideoUrl] = useState<string | null>(null); // Fertige Blossom-URL der Slideshow
  const [stationPreviewOpen, setStationPreviewOpen] = useState<string | null>(null);
  const [draftDescription, setDraftDescription] = useState('');

  // Hooks
  const { toast } = useToast();
  const { mutateAsync: uploadFile } = useUploadFile();
  const { mutate: publishEvent } = useNostrPublish();
  const { gender, user } = useCurrentUser(); // Gender für KI-Generierung (Mojo=male, Susanne=female)

  // KI-Artikelgenerierung für Trips
  const generateArticleWithAI = async () => {
    if (stations.length === 0) {
      toast({
        title: 'Fehler',
        description: 'Bitte lade mindestens ein Bild hoch.',
        variant: 'destructive'
      });
      return;
    }

    setIsGeneratingArticle(true);
    setGeneratingProgress(0);

    // Hilfsfunktion: Response sicher als JSON parsen – zeigt echten Fehlertext wenn kein JSON
    const safeJson = async (response: Response) => {
      const text = await response.text();
      try {
        return JSON.parse(text);
      } catch {
        // Server hat kein JSON gesendet (z.B. nginx 413, HTML-Fehlerseite, leere Antwort)
        const preview = text.slice(0, 300).replace(/<[^>]+>/g, '').trim();
        throw new Error(
          `Server HTTP ${response.status}: ${preview || 'Keine Antwort vom Server'}`
        );
      }
    };
    
    try {
      // ── Hilfsfunktion: FormData für einen Versuch bauen ──────────────────
      const buildFormData = async (maxImgBytes: number, maxImgs: number) => {
        const fd = new FormData();
        const stationsWithFiles = stations.filter(s => s.file).slice(0, maxImgs);

        for (const station of stationsWithFiles) {
          const compressed = await compressImageForUpload(station.file, maxImgBytes);
          fd.append('images', compressed);
        }

        fd.append('title',        tripData.title || 'Meine Reise');
        fd.append('description',  tripData.summary || '');
        fd.append('locations',    JSON.stringify(stations.map(s => s.location || s.title)));
        fd.append('startDate',    stations[0]?.date || '');
        fd.append('endDate',      stations[stations.length - 1]?.date || '');
        fd.append('model',        selectedModel);
        fd.append('lifestyle',    lifestyle);
        fd.append('tripType',     tripData.tripType || '');
        fd.append('country',      tripData.country || '');
        fd.append('tripLength',   tripLength);
        fd.append('gender',       gender || 'neutral');
        fd.append('stationDescriptions', JSON.stringify(
          stations.map(s => ({ location: s.location || s.title, description: s.description || '' }))
                  .filter(s => s.description)
        ));
        return { fd, count: stationsWithFiles.length };
      };

      // ── Versuchs-Stufen ───────────────────────────────────────────────────
      // Gemini 2.5 Flash (OpenRouter): kein Rate-Limit, alle 12 Bilder möglich
      // Stufe 1: 2MB × 12 Bilder (~24MB) – Gemini kann das
      // Stufe 2: 1MB × 8 Bilder  (~8MB)  – Fallback bei NetworkError
      // Stufe 3: 512KB × 5 Bilder (~2.5MB) – letzter Versuch
      const attempts = [
        { maxImgBytes: 2 * 1024 * 1024, maxImgs: 12, label: '12 Bilder' },
        { maxImgBytes: 1 * 1024 * 1024, maxImgs: 10, label: '10 Bilder (kleiner)' },
        { maxImgBytes: 512 * 1024,      maxImgs: 6,  label: '6 Bilder (minimal)' },
      ];

      let response: Response | null = null;
      let data: any = null;
      let lastError = '';

      for (let attempt = 0; attempt < attempts.length; attempt++) {
        const { maxImgBytes, maxImgs, label } = attempts[attempt];

        toast({
          title: attempt === 0 ? '🗜️ Bilder werden vorbereitet...' : `🔄 Versuch ${attempt + 1}/3 (${label})`,
          description: attempt === 0
            ? `${Math.min(stations.filter(s => s.file).length, maxImgs)} Bilder komprimieren...`
            : 'Kleinere Dateigröße wird versucht...',
        });

        const { fd, count } = await buildFormData(maxImgBytes, maxImgs);
        console.log(`[KI] Versuch ${attempt + 1}: ${count} Bilder, max ${maxImgBytes/1024}KB/Bild`);
        setGeneratingProgress(10 + attempt * 5);

        try {
          response = await fetch('/api/generate-trip', { method: 'POST', body: fd });
          // Kein NetworkError → Antwort verarbeiten
          data = await safeJson(response);
          if (!response.ok) throw new Error(data.error || `Server HTTP ${response.status}`);
          break; // ✅ Erfolg
        } catch (fetchErr: any) {
          lastError = fetchErr?.message || 'Netzwerkfehler';
          console.warn(`[KI] Versuch ${attempt + 1} fehlgeschlagen: ${lastError}`);
          if (attempt === attempts.length - 1) {
            // Alle Versuche gescheitert
            throw new Error(
              `Alle ${attempts.length} Versuche fehlgeschlagen. Letzter Fehler: ${lastError}\n` +
              `Tipp: Stelle sicher dass der Server läuft (https://mojobus.co/api/health).`
            );
          }
          // Nächste Stufe versuchen
        }
      }

      setGeneratingProgress(90);
      
      if (data.article) {
        // Zusammenfassung in Trip-Summary einfügen
        setTripData(prev => ({
          ...prev,
          summary: data.article
        }));

        // Bild-Captions in die jeweiligen Stationen einfügen
        if (data.captions && data.captions.length > 0) {
          const newAiIds = new Set<string>();
          setStations(prev => prev.map((station, index) => {
            const caption = data.captions[index];
            if (caption) {
              newAiIds.add(station.id);
              return { ...station, description: caption };
            }
            return station;
          }));
          setAiGeneratedCaptions(newAiIds);
          console.log(`[KI] ${data.captions.length} Bild-Captions in Stationen eingefügt`);
        }

        setGeneratingProgress(100);
        
        toast({
          title: 'Fertig!',
          description: `Zusammenfassung + ${data.captions?.length || 0} Bild-Texte generiert (${selectedModel === 'claude' ? 'Claude Sonnet 4.6' : 'Llama 4 Scout'})`
        });
        
        setTimeout(() => {
          setGeneratingProgress(0);
        }, 1000);
      }
    } catch (error: any) {
      console.error('[KI] Generierung fehlgeschlagen:', error);
      setGeneratingProgress(0);
      const errMsg = error?.message || 'KI-Generierung fehlgeschlagen. Bitte versuche es erneut.';
      toast({
        title: 'KI-Fehler',
        description: errMsg.length > 200 ? errMsg.slice(0, 197) + '...' : errMsg,
        variant: 'destructive'
      });
    } finally {
      setIsGeneratingArticle(false);
    }
  };
  
  const navigate = useNavigate();
  
  // Populate form when editing existing trip
  useEffect(() => {
    if (isEditMode && existingTrip && !isLoadingExisting) {
      console.log('[Trip Edit] Loading existing trip:', existingTrip.title);
      
      // Store d-tag for update
      setEditDtag(existingTrip.identifier || null);
      
      // Set trip metadata
      setTripData({
        title: existingTrip.title || '',
        summary: existingTrip.summary || '',
        country: existingTrip.country || '',
        tripType: (existingTrip.category as TripType) || '',
      });
      
      // Create stations from waypoints
      const existingStations: TripStation[] = existingTrip.waypoints.map((wp, index) => ({
        id: `existing-${index}`,
        file: null as unknown as File, // No file needed for existing images
        preview: wp.image || '',
        uploaded: true,
        uploadedUrl: wp.image || '',
        gps: {
          latitude: wp.lat,
          longitude: wp.lon,
          precision: 'medium' as const,
        },
        gpsStatus: 'detected' as GpsStatus,
        location: wp.name || '',
        title: wp.name || '',
        description: wp.description || '',
        date: wp.date || new Date().toISOString().split('T')[0],
      }));
      
      setStations(existingStations);

      // Vorhandene Video-URL laden (wenn trip.video gesetzt)
      if (existingTrip.video) {
        setSlideshowVideoUrl(existingTrip.video);
        console.log('[Trip Edit] Vorhandene Video-URL geladen:', existingTrip.video);
      }
      
      // Skip to details step since we have stations
      setCurrentStep('details');
      
      toast({
        title: 'Trip geladen',
        description: `"${existingTrip.title}" wird bearbeitet.`,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode, existingTrip, isLoadingExisting]);

  // Auto-fill trip metadata from first station
  useEffect(() => {
    const autoFill = async () => {
      const firstStationWithGps = stations.find(s => s.gps && s.gpsStatus === 'detected');
      if (firstStationWithGps?.gps && !tripData.country) {
        const locationData = await reverseGeocode(
          firstStationWithGps.gps.latitude,
          firstStationWithGps.gps.longitude
        );
        if (locationData) {
          const locationParts = [
            locationData.city,
            locationData.neighbourhood,
            locationData.suburb
          ].filter(Boolean);
          
          const loc = locationParts.join(', ');
          const country = mapCountryCode(locationData);
          
          // Update station with location
          setStations(prev => prev.map(s => 
            s.id === firstStationWithGps.id 
              ? { ...s, location: loc }
              : s
          ));
          
          // Update trip data
          if (country && !tripData.country) {
            setTripData(prev => ({ ...prev, country }));
          }
          
          // Auto-generate title if empty
          if (!tripData.title && loc) {
            setTripData(prev => ({ 
              ...prev, 
              title: `Trip nach ${loc}`,
              summary: `Eine Reise durch ${loc} und Umgebung.`
            }));
          }
        }
      }
    };
    
    autoFill();
  }, [stations, tripData.country, tripData.title]);

  // Handle file selection
  const handleFileSelect = async (files: FileList | null) => {
    if (!files) return;
    
    const newStations: TripStation[] = [];
    
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      
      // EXIF-Daten lesen (Datum, GPS, Orientierung, Bildabmessungen)
      let fileDate = new Date().toISOString().split('T')[0];
      let timestamp = Date.now();
      let exifWidth: number | undefined;
      let exifHeight: number | undefined;
      let exifOrientation: number | undefined;
      
      try {
        // Orientation separat lesen (funktioniert auch wenn parse fehlschlägt)
        try {
          exifOrientation = await exifr.orientation(file);
          console.log(`[Trip EXIF] ${file.name}: Orientation (via exifr.orientation) = ${exifOrientation || 'not found'}`);
        } catch (orientErr) {
          console.warn(`[Trip EXIF] ${file.name}: Could not read orientation:`, orientErr);
        }
        
        // Datum separat lesen
        try {
          const dateExif = await exifr.parse(file, { exif: true, pickTags: ['DateTimeOriginal', 'CreateDate', 'GPSDateStamp', 'GPSTimeStamp'] });
          const exifDate = dateExif?.DateTimeOriginal || dateExif?.CreateDate;
          
          // GPS timestamp als Fallback
          const gpsDateStamp = dateExif?.GPSDateStamp;
          const gpsTimeStamp = dateExif?.GPSTimeStamp;
          
          if (exifDate) {
            timestamp = new Date(exifDate).getTime();
            fileDate = new Date(exifDate).toISOString().split('T')[0];
            console.log(`[Trip EXIF] ${file.name}: DateTime = ${exifDate}, timestamp = ${timestamp}`);
          } else if (gpsDateStamp && gpsTimeStamp) {
            // GPS timestamp kombinieren
            const gpsDateTime = `${gpsDateStamp} ${gpsTimeStamp}`;
            timestamp = new Date(gpsDateTime).getTime();
            fileDate = new Date(gpsDateTime).toISOString().split('T')[0];
            console.log(`[Trip EXIF] ${file.name}: GPS DateTime = ${gpsDateTime}, timestamp = ${timestamp}`);
          } else {
            // Fallback: Dateiname parsen (IMG_YYYYMMDD_HHMMSS)
            const nameMatch = file.name.match(/(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/);
            if (nameMatch) {
              const [_, year, month, day, hour, min, sec] = nameMatch;
              const parsedDate = new Date(`${year}-${month}-${day}T${hour}:${min}:${sec}`);
              if (!isNaN(parsedDate.getTime())) {
                timestamp = parsedDate.getTime();
                fileDate = parsedDate.toISOString().split('T')[0];
                console.log(`[Trip EXIF] ${file.name}: Parsed from filename = ${fileDate}, timestamp = ${timestamp}`);
              }
            }
          }
          
          if (!timestamp || timestamp === Date.now()) {
            console.warn(`[Trip EXIF] ${file.name}: Could not extract timestamp, using file lastModified`);
            timestamp = file.lastModified || Date.now();
            fileDate = new Date(timestamp).toISOString().split('T')[0];
          }
          
          console.log(`[Trip EXIF] ${file.name}: FINAL timestamp = ${timestamp}, date = ${fileDate}`);
        } catch (dateErr) {
          console.warn(`[Trip EXIF] ${file.name}: Could not read date:`, dateErr);
          // Fallback: Dateiname oder file.lastModified
          const nameMatch = file.name.match(/(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/);
          if (nameMatch) {
            const [_, year, month, day, hour, min, sec] = nameMatch;
            const parsedDate = new Date(`${year}-${month}-${day}T${hour}:${min}:${sec}`);
            if (!isNaN(parsedDate.getTime())) {
              timestamp = parsedDate.getTime();
              fileDate = parsedDate.toISOString().split('T')[0];
            }
          }
          if (!timestamp) {
            timestamp = file.lastModified || Date.now();
            fileDate = new Date(timestamp).toISOString().split('T')[0];
          }
        }
        
        // Bildabmessungen versuchen zu lesen
        try {
          const dimExif = await exifr.parse(file, { exif: true, pickTags: ['ImageWidth', 'ImageHeight', 'ExifImageWidth', 'ExifImageHeight'] });
          exifWidth = dimExif?.ImageWidth || dimExif?.ExifImageWidth;
          exifHeight = dimExif?.ImageHeight || dimExif?.ExifImageHeight;
          if (exifWidth && exifHeight) {
            console.log(`[Trip EXIF] ${file.name}: EXIF dimensions ${exifWidth}x${exifHeight}`);
          }
        } catch (dimErr) {
          console.warn(`[Trip EXIF] ${file.name}: Could not read dimensions:`, dimErr);
        }
        
      } catch (e) {
        console.warn(`[Trip EXIF] Error in ${file.name}:`, e);
      }
      
      // Bild laden um Vorschau zu erstellen
      let previewUrl: string;
      try {
        previewUrl = await createCorrectedPreview(file, exifWidth, exifHeight, exifOrientation);
      } catch (previewError) {
        console.warn(`[Trip Preview] Failed to create preview for ${file.name}:`, previewError);
        previewUrl = URL.createObjectURL(file);
      }
      
      const station: TripStation = {
        id: Math.random().toString(36).substr(2, 9),
        file,
        preview: previewUrl,
        gpsStatus: 'not_found',
        location: '',
        title: '',
        description: '',
        date: fileDate,
        timestamp,
        exifOrientation,
      };
      
      // Extract GPS from image (with better error handling for mobile)
      try {
        console.log(`[Trip GPS] Starting extraction for ${file.name}...`);
        const gpsData = await extractGpsFromImage(file);
        if (gpsData) {
          station.gps = gpsData;
          station.gpsStatus = 'detected';
          console.log(`[Trip GPS] ✓ Extracted from ${file.name}:`, gpsData);
          
          // Get location name via reverse geocoding
          try {
            const locationData = await reverseGeocode(gpsData.latitude, gpsData.longitude);
            if (locationData) {
              // Use specificLocation (first 3 parts of address) for more precision
              // Example: "Rocha Baixinha Beach, Avenida Comendador André Jordan, Vilamoura"
              station.location = locationData.specificLocation || 
                                 locationData.display_name?.split(',').slice(0, 3).join(', ') ||
                                 [locationData.city, locationData.suburb].filter(Boolean).join(', ');
              console.log(`[Trip Location] Found for ${file.name}:`, station.location);
              
              // Auto-fill title if empty
              if (!station.title && station.location) {
                station.title = station.location;
              }
            }
          } catch (geoError) {
            console.warn(`[Trip Location] Reverse geocoding failed for ${file.name}:`, geoError);
          }
        } else {
          console.log(`[Trip GPS] ✗ No GPS found in ${file.name}`);
        }
      } catch (error: any) {
        console.error(`[Trip GPS] ✗ Failed to extract from ${file.name}:`, error?.message || error);
        station.gpsStatus = 'error';
      }
      
      newStations.push(station);
    }
    
    // Sortieren nach EXIF-Timestamp (ältestes zuerst = Station 1)
    // a - b = aufsteigend = ältestes Bild (kleinster timestamp) zuerst
    newStations.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    console.log('[Trip] New stations sorted by timestamp');
    
    // Merge with existing stations and sort entire list
    setStations(prev => {
      const allStations = [...prev, ...newStations];
      
      // Debug: Log timestamps before sorting
      console.log('[Trip] Before sorting:');
      allStations.forEach((s, i) => {
        console.log(`  [${i}] ${s.file?.name}: timestamp=${s.timestamp}, date=${s.date}`);
      });
      
      // Sort all stations by timestamp (oldest first = smallest timestamp = Station 1)
      allStations.sort((a, b) => {
        const tsA = a.timestamp || 0;
        const tsB = b.timestamp || 0;
        return tsA - tsB; // Ascending: oldest (smallest) first
      });
      
      // Debug: Log timestamps after sorting
      console.log('[Trip] After sorting (oldest first = Station 1):');
      allStations.forEach((s, i) => {
        console.log(`  Station ${i + 1}: ${s.file?.name} (timestamp=${s.timestamp})`);
      });
      
      return allStations;
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const removeStation = (id: string) => {
    setStations(prev => {
      const station = prev.find(s => s.id === id);
      if (station?.preview) {
        URL.revokeObjectURL(station.preview);
      }
      return prev.filter(s => s.id !== id);
    });
  };

  // Drag & Drop reordering
  const handleDragStart = (id: string) => {
    setDraggedId(id);
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) return;
    
    setStations(prev => {
      const newStations = [...prev];
      const draggedIndex = newStations.findIndex(s => s.id === draggedId);
      const targetIndex = newStations.findIndex(s => s.id === targetId);
      
      if (draggedIndex !== -1 && targetIndex !== -1) {
        const [draggedStation] = newStations.splice(draggedIndex, 1);
        newStations.splice(targetIndex, 0, draggedStation);
      }
      
      return newStations;
    });
  };

  const handleDragEnd = () => {
    setDraggedId(null);
  };

  // GPS editing
  const saveGps = async (stationId: string, gps: GpsData) => {
    // Update station
    setStations(prev => prev.map(s => 
      s.id === stationId 
        ? { ...s, gps, gpsStatus: 'manual' as GpsStatus }
        : s
    ));
    
    // Reverse geocode for location
    try {
      const locationData = await reverseGeocode(gps.latitude, gps.longitude);
      if (locationData) {
        // Use specificLocation (first 3 parts of address) for more precision
        const loc = locationData.specificLocation || 
                    locationData.display_name?.split(',').slice(0, 3).join(', ') ||
                    [locationData.city, locationData.suburb].filter(Boolean).join(', ');
        
        setStations(prev => prev.map(s => 
          s.id === stationId 
            ? { ...s, location: loc, title: s.title || loc }
            : s
        ));
        
        // Also update country if not set
        const country = mapCountryCode(locationData);
        if (country && !tripData.country) {
          setTripData(prev => ({ ...prev, country }));
        }
      }
    } catch (error) {
      console.error('[Trip GPS] Reverse geocoding failed:', error);
    }
    
    setEditingStation(null);
    setShowMapPicker(false);
  };

  const removeGps = (stationId: string) => {
    setStations(prev => prev.map(s => {
      if (s.id === stationId) {
        const updated = { ...s };
        delete updated.gps;
        updated.gpsStatus = 'not_found';
        delete updated.location;
        return updated;
      }
      return s;
    }));
    setEditingStation(null);
    setShowMapPicker(false);
  };

  // Update station fields
  const updateStation = (id: string, field: keyof TripStation, value: string) => {
    setStations(prev => prev.map(s => 
      s.id === id ? { ...s, [field]: value } : s
    ));
  };

  // Calculate map markers
  const mapMarkers: MapMarker[] = useMemo(() => {
    return stations
      .filter(s => s.gps)
      .map((s, index) => ({
        id: s.id,
        lat: s.gps!.latitude,
        lng: s.gps!.longitude,
        title: s.title || s.location || `Station ${index + 1}`,
        description: s.location,
        isCurrent: false,
      }));
  }, [stations]);

  // Count stations with GPS
  const stationsWithGps = useMemo(() => 
    stations.filter(s => s.gps).length,
  [stations]);

  // Validate for each step
  const canProceedToDetails = stations.length >= 2;
  const canProceedToPreview = stations.length >= 2 && tripData.title.trim() !== '' && tripData.tripType !== '';
  const canPublish = stations.filter(s => s.gps).length >= 2 && tripData.title.trim() !== '' && tripData.tripType !== '';

  // Upload all images to Blossom and return updated stations
  const uploadImages = async (): Promise<TripStation[]> => {
    setIsUploading(true);
    setUploadProgress({ current: 0, total: stations.length, status: 'Upload gestartet...' });
    
    const updatedStations: TripStation[] = [];
    
    try {
      for (let i = 0; i < stations.length; i++) {
        const station = stations[i];
        
        // Skip stations that are already uploaded (edit mode)
        if (station.uploaded && station.uploadedUrl) {
          console.log(`[Trip Upload] Station ${i + 1} already uploaded, skipping`);
          updatedStations.push(station);
          setUploadProgress({ 
            current: i + 1, 
            total: stations.length, 
            status: `Überspringe Station ${i + 1} (bereits vorhanden)` 
          });
          continue;
        }
        
        // Skip stations without file (should not happen)
        if (!station.file) {
          console.warn(`[Trip Upload] Station ${i + 1} has no file, skipping`);
          continue;
        }
        
        setUploadProgress({ 
          current: i + 1, 
          total: stations.length, 
          status: `Lade ${station.file.name} hoch...` 
        });
        
        try {
          // Create corrected file with proper orientation before upload
          const correctedFile = await createCorrectedFile(station.file, station.exifOrientation);
          
          const uploadResult = await uploadFile(correctedFile);
          
          let uploadedUrl: string | undefined;
          if (Array.isArray(uploadResult)) {
            const urlTag = uploadResult.find(tag => 
              Array.isArray(tag) && tag.length >= 2 && tag[0] === 'url'
            );
            if (urlTag) {
              uploadedUrl = urlTag[1];
            }
          }
          
          updatedStations.push({
            ...station,
            uploaded: true,
            uploadedUrl,
          });
          
          console.log(`[Trip Upload] Station ${i + 1} uploaded:`, uploadedUrl);
        } catch (uploadError: any) {
          console.error(`[Trip Upload] Failed to upload station ${i + 1}:`, uploadError);
          toast({
            title: 'Fehler beim Upload',
            description: `Bild ${i + 1} konnte nicht hochgeladen werden: ${uploadError.message}`,
            variant: 'destructive'
          });
          return []; // Abort on error
        }
      }
      
      toast({
        title: 'Upload erfolgreich!',
        description: `${stations.length} Bilder wurden hochgeladen.`,
      });
      
      // Update state with uploaded stations
      setStations(updatedStations);
      
      return updatedStations;
    } catch (error) {
      console.error('[Trip Upload] Error:', error);
      toast({
        title: 'Fehler beim Upload',
        description: 'Einige Bilder konnten nicht hochgeladen werden.',
        variant: 'destructive'
      });
      return [];
    } finally {
      setIsUploading(false);
      setUploadProgress({ current: 0, total: 0, status: '' });
    }
  };

  // Publish trip
  // Teaser-Note State (nach Trip-Publish anzeigen)
  const [showTeaserBox, setShowTeaserBox] = useState(false);
  const [tripTeaserPreview, setTripTeaserPreview] = useState<TeaserPreviewData | null>(null);
  const [isTripTeaserPublished, setIsTripTeaserPublished] = useState(false);

  const publishTeaserForTrip = async () => {
    if (!tripTeaserPreview) return;
    setIsPublishing(true);
    try {
      await publishEvent({
        kind: 1,
        content: tripTeaserPreview.content,
        tags: tripTeaserPreview.tags,
      }, {
        onSuccess: () => {
          setIsTripTeaserPublished(true);
          setIsPublishing(false);
        },
        onError: (err) => {
          toast({ title: '❌ Teaser fehlgeschlagen', description: err?.message || err, variant: 'destructive' });
          setIsPublishing(false);
        },
      });
    } catch (err: any) {
      toast({ title: '❌ Teaser fehlgeschlagen', description: err?.message || err, variant: 'destructive' });
      setIsPublishing(false);
    }
  };

  const skipTripTeaser = () => {
    setShowTeaserBox(false);
    setTripTeaserPreview(null);
    setStations([]);
    setTripData({ title: '', summary: '', country: '', tripType: '' });
    setEditDtag(null);
    setCurrentStep('upload');
    setTimeout(() => navigate('/map/trips'), 500);
  };

  const handlePublish = async () => {
    // First upload all images and get updated stations
    const uploadedStations = await uploadImages();
    
    if (uploadedStations.length === 0) {
      console.error('[Trip Publish] No stations uploaded');
      return;
    }
    
    // Check for GPS stations
    const gpsStations = uploadedStations.filter(s => s.gps && s.uploadedUrl);
    if (gpsStations.length < 2) {
      toast({
        title: 'Nicht genug GPS-Daten',
        description: 'Mindestens 2 Stationen mit GPS erforderlich.',
        variant: 'destructive'
      });
      return;
    }
    
    // Create trip event (Kind 30025 - compatible with mojotravel)
    // Use existing d-tag for updates, or create new one
    const dTag = editDtag || `trip-${Date.now()}`;
    
    console.log('[Trip Publish] Publishing with', uploadedStations.length, 'stations');
    console.log('[Trip Publish] GPS stations:', gpsStations.length);
    console.log('[Trip Publish] Mode:', isEditMode ? 'UPDATE' : 'CREATE');
    console.log('[Trip Publish] d-tag:', dTag);
    
    // Build waypoint tags (for route visualization)
    // Format: ['waypoint', index, lat, lon, name, date, image, description]
    const waypointTags = gpsStations.map((s, index) => [
      'waypoint',
      (index + 1).toString(),
      s.gps!.latitude.toString(),
      s.gps!.longitude.toString(),
      s.title || s.location || `Station ${index + 1}`,
      s.date || '',
      s.uploadedUrl!,
      s.description || ''
    ]);
    
    // Build image tags (with GPS for map display) - mojotravel format
    const imageTags = uploadedStations
      .filter(s => s.uploadedUrl)
      .map((s, index) => {
        if (s.gps) {
          return ['image', s.uploadedUrl!, s.gps.latitude.toString(), s.gps.longitude.toString(), s.date || ''];
        }
        return ['image', s.uploadedUrl!];
      });
    
    // Calculate total distance
    let totalDistance = 0;
    for (let i = 1; i < gpsStations.length; i++) {
      const prev = gpsStations[i - 1];
      const curr = gpsStations[i];
      totalDistance += calculateDistance(
        prev.gps!.latitude, prev.gps!.longitude,
        curr.gps!.latitude, curr.gps!.longitude
      );
    }
    
    // Build station content
    const stationContent = uploadedStations
      .filter(s => s.uploadedUrl)
      .map((s, index) => {
        let content = `## Station ${index + 1}: ${s.title || s.location || 'Unbenannt'}\n\n`;
        if (s.description) content += `${s.description}\n\n`;
        content += `![${s.title || `Station ${index + 1}`}](${s.uploadedUrl})\n`;
        return content;
      })
      .join('\n---\n\n');
    
    const content = `# ${tripData.title}\n\n${tripData.summary}\n\n${stationContent}`;
    
    console.log('[Trip Publish] Waypoint tags:', waypointTags.length);
    console.log('[Trip Publish] Image tags:', imageTags.length);
    
    // Build tags
    const tags: string[][] = [
      ['d', dTag],
      ['title', tripData.title],
      ['summary', tripData.summary],
      ['type', 'trip'],
      ['t', 'trip'],
      ['t', 'mojobus'],
      ...waypointTags,
      ...imageTags,
    ];
    
    // Add distance
    if (totalDistance > 0) {
      tags.push(['distance', Math.round(totalDistance).toString()]);
      tags.push(['distance_unit', 'km']);
    }
    
    // Add trip type tag
    if (tripData.tripType) {
      tags.push(['t', tripData.tripType]);
      tags.push(['trip_type', tripData.tripType]);
      tags.push(['category', tripData.tripType]);
    }
    
    // Add country tags
    if (tripData.country) {
      const countryTags = getCountryTag(tripData.country);
      countryTags.forEach(tag => tags.push(['t', tag]));
      tags.push(['country', tripData.country]);
    }

    // Slideshow-Video URL einbinden (wenn generiert)
    if (slideshowVideoUrl) {
      tags.push(['video', slideshowVideoUrl]);
      console.log('[Trip Publish] Slideshow-Video wird eingebunden:', slideshowVideoUrl);
    }
    
    // Publish
    setIsPublishing(true);
    
    const doPublish = async (retryCount = 0) => {
      try {
        await new Promise<void>((resolve, reject) => {
          publishEvent({
            kind: 30025, // Trip events (Kind 30025 - Parameterized Replaceable)
            content,
            tags
          }, {
             onSuccess: () => {
               toast({
                 title: isEditMode ? 'Trip aktualisiert!' : 'Trip veröffentlicht!',
                 description: isEditMode 
                   ? 'Dein Trip wurde erfolgreich aktualisiert.' 
                   : 'Dein Trip wurde erfolgreich veröffentlicht.',
               });
               
                 // Teaser-Note vorbereiten
                 // naddr berechnen (für korrekten Trip-Link)
                 let tripNaddr = dTag; // Fallback: dTag
                 try {
                   if (user?.pubkey) {
                     tripNaddr = nip19.naddrEncode({
                       kind: 30025,
                       pubkey: user.pubkey,
                       identifier: dTag,
                     });
                   }
                 } catch (e) {
                   console.warn('[Trip Teaser] naddr encode failed, using dTag as fallback:', e);
                 }
                 
                 // Erstes Bild: aus allen uploadedStations (nicht nur gpsStations)
                 const firstStation = uploadedStations.find(s => s.uploadedUrl);
                 const firstImageUrl = firstStation?.uploadedUrl;
                 
                 // Kurze Zusammenfassung: max 120 Zeichen damit Bild NICHT hinter "more" verschwindet
                 const teaserSummary = tripData.summary.trim().slice(0, 120) + (tripData.summary.trim().length > 120 ? '…' : '');
                 
                 // Content-Struktur für Primal/Amethyst:
                 // - Titel zuerst (kurz, kein langer Text davor)
                 // - SOFORT danach Bild-URL allein auf einer Zeile → erscheint direkt unter Titel
                 // - Kurzer Text
                 // - Video-URL allein auf einer Zeile → wird als Video-Player gerendert
                 // - Trip-Link ganz am Ende
                 // Wichtig: URLs müssen ALLEIN auf einer Zeile stehen (kein Text daneben)
                 const contentLines: string[] = [];
                 contentLines.push(`🗺️ ${tripData.title || 'Trip'}`);
                 // Bild SOFORT nach Titel (vor allem Text) – so bleibt es im sichtbaren Bereich
                 if (firstImageUrl) contentLines.push(firstImageUrl);
                 // Kurzer Teaser-Text danach
                 if (teaserSummary) contentLines.push(teaserSummary);
                 // Stats-Zeile
                 contentLines.push(`📍 ${gpsStations.length} Stationen · 🛣️ ${Math.round(totalDistance)} km`);
                 // Video-URL allein auf einer Zeile (Primal/Amethyst braucht isolierte URL)
                 if (slideshowVideoUrl) contentLines.push(slideshowVideoUrl);
                 // Trip-Link am Ende
                 contentLines.push(`https://mojobus.co/trip/${tripNaddr}`);
                 const teaserContent = contentLines.join('\n\n');

                const teaserTags: string[][] = [
                  ['t', 'trip'],
                  ['t', 'reisen'],
                ];
                if (tripData.tripType) teaserTags.push(['t', tripData.tripType]);
                if (tripData.country) {
                  const countryTags = getCountryTag(tripData.country);
                  countryTags.forEach(tag => teaserTags.push(['t', tag]));
                }
                // imeta für Bild – URL muss exakt mit Content übereinstimmen
                if (firstImageUrl) {
                  teaserTags.push([
                    'imeta',
                    `url ${firstImageUrl}`,
                    `m image/jpeg`,
                    `alt ${tripData.title || 'Trip'}`,
                  ]);
                }
                // imeta für Video – m video/mp4 damit Primal/Amethyst es als Video rendert
                if (slideshowVideoUrl) {
                  teaserTags.push([
                    'imeta',
                    `url ${slideshowVideoUrl}`,
                    `m video/mp4`,
                    `alt ${tripData.title || 'Trip'} – Slideshow`,
                  ]);
                }

                setTripTeaserPreview({
                  content: teaserContent,
                  tags: teaserTags,
                  hasImage: !!firstImageUrl,
                  hasVideo: !!slideshowVideoUrl,
                });
               setShowTeaserBox(true);
               setIsTripTeaserPublished(false);
               
               resolve();
             },
            onError: (error) => {
              reject(error);
            }
          });
        });
      } catch (error: any) {
        console.error('[Trip Publish] Error:', error);
        
        // Retry up to 3 times
        if (retryCount < 3) {
          console.log(`[Trip Publish] Retrying... (${retryCount + 1}/3)`);
          toast({
            title: 'Veröffentlichung wird erneut versucht...',
            description: `Versuch ${retryCount + 1} von 3`,
          });
          await new Promise(r => setTimeout(r, 2000)); // Wait 2 seconds
          return doPublish(retryCount + 1);
        }
        
        toast({
          title: 'Fehler beim Veröffentlichen',
          description: `Der Trip konnte nicht veröffentlicht werden: ${error?.message || 'Unbekannter Fehler'}. Bitte versuche es später erneut.`,
          variant: 'destructive'
        });
      } finally {
        setIsPublishing(false);
      }
    };
    
    await doPublish();
  };

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 'upload':
        return renderUploadStep();
      case 'details':
        return renderDetailsStep();
      case 'preview':
        return renderPreviewStep();
      case 'publish':
        return renderPublishStep();
      default:
        return null;
    }
  };

  // Step 1: Upload images
  const renderUploadStep = () => (
    <div className="space-y-6">
      {/* Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragging ? 'border-primary bg-primary/5' : 'border-gray-300 dark:border-gray-600'
        }`}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
      >
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
          id="trip-image-upload"
        />
        <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium mb-2">Bilder für deinen Trip hochladen</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Ziehe Bilder hierher oder klicke zum Auswählen. Mindestens 2 Bilder erforderlich.
        </p>
        <Button asChild>
          <label htmlFor="trip-image-upload" className="cursor-pointer">
            <Camera className="h-4 w-4 mr-2" />
            Bilder auswählen
          </label>
        </Button>
      </div>

      {/* Image Grid */}
      {stations.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">
              Stationen ({stations.length}) - {stationsWithGps} mit GPS
            </h3>
            <p className="text-sm text-muted-foreground">
              Ziehe zum Sortieren
            </p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {stations.map((station, index) => (
              <div
                key={station.id}
                draggable
                onDragStart={() => handleDragStart(station.id)}
                onDragOver={(e) => handleDragOver(e, station.id)}
                onDragEnd={handleDragEnd}
                className={`relative group border rounded-lg overflow-hidden cursor-move ${
                  draggedId === station.id ? 'opacity-50' : ''
                }`}
              >
                {/* Drag Handle */}
                <div className="absolute top-1 left-1 z-10 bg-black/50 rounded p-1">
                  <GripVertical className="h-4 w-4 text-white" />
                </div>
                
                {/* Station Number */}
                <div className="absolute top-1 right-10 z-10 bg-primary rounded-full w-6 h-6 flex items-center justify-center text-white text-sm font-bold">
                  {index + 1}
                </div>
                
                {/* Image */}
                <img
                  src={station.preview}
                  alt={station.title || `Station ${index + 1}`}
                  className="w-full h-32 object-cover"
                />
                
                {/* GPS Status */}
                <div className="p-2 space-y-1">
                  {station.gps ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full h-7 text-xs text-green-600 justify-start overflow-hidden"
                      onClick={() => setEditingStation(station.id)}
                    >
                      <MapPin className="h-3 w-3 mr-1 flex-shrink-0" />
                      <span className="truncate">{station.location || 'GPS erkannt'}</span>
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full h-7 text-xs"
                      onClick={() => setEditingStation(station.id)}
                    >
                      <MapPin className="h-3 w-3 mr-1" />
                      GPS hinzufügen
                    </Button>
                  )}
                </div>
                
                {/* Delete Button */}
                <Button
                  variant="destructive"
                  size="sm"
                  className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity z-20"
                  onClick={() => removeStation(station.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* GPS Editor Dialog */}
      <Dialog open={editingStation !== null} onOpenChange={(open) => { if (!open) { setEditingStation(null); setShowMapPicker(false); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              GPS-Standort bearbeiten
            </DialogTitle>
            <DialogDescription>
              Wähle zwischen Koordinaten-Eingabe oder Karte
            </DialogDescription>
          </DialogHeader>
          
          {editingStation && (() => {
            const station = stations.find(s => s.id === editingStation);
            if (!station) return null;
            
            return (
              <div className="space-y-4">
                {/* Preview Image */}
                <div className="flex gap-4 items-start">
                  <img
                    src={station.preview}
                    alt=""
                    className="w-24 h-24 object-cover rounded"
                  />
                  <div className="flex-1">
                    <p className="font-medium">{station.title || `Station ${stations.findIndex(s => s.id === editingStation) + 1}`}</p>
                    {station.gps && (
                      <p className="text-sm text-muted-foreground">
                        Aktuell: {formatCoordinatesSimple(station.gps.latitude, station.gps.longitude)}
                      </p>
                    )}
                  </div>
                </div>
                
                {/* Toggle Buttons */}
                <div className="flex gap-2">
                  <Button
                    variant={!showMapPicker ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => setShowMapPicker(false)}
                  >
                    ✏️ Koordinaten eingeben
                  </Button>
                  <Button
                    variant={showMapPicker ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => setShowMapPicker(true)}
                  >
                    🗺️ Auf Karte wählen
                  </Button>
                </div>
                
                {/* Editor Content */}
                {showMapPicker ? (
                  <LocationPicker
                    gps={station.gps}
                    onSave={(gps) => saveGps(station.id, gps)}
                    onCancel={() => { setEditingStation(null); setShowMapPicker(false); }}
                    height="350px"
                  />
                ) : (
                  <GpsEditor
                    gps={station.gps}
                    onSave={(gps) => saveGps(station.id, gps)}
                    onCancel={() => { setEditingStation(null); setShowMapPicker(false); }}
                    onRemove={() => removeGps(station.id)}
                  />
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Navigation */}
      <div className="flex justify-end">
        <Button
          onClick={() => setCurrentStep('details')}
          disabled={!canProceedToDetails}
        >
          Weiter zur Beschreibung
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );

  // Step 2: Add details to each station
  const renderDetailsStep = () => (
    <div className="space-y-6">
      {/* Trip Metadata */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Trip-Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="trip-title">Trip-Titel</Label>
            <Input
              id="trip-title"
              value={tripData.title}
              onChange={(e) => setTripData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="z.B. Portugal Roadtrip 2024"
            />
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="trip-summary">Zusammenfassung</Label>
              {tripData.summary && (
                <span className="text-xs text-muted-foreground">
                  {tripData.summary.trim().split(/\s+/).filter(Boolean).length} Wörter
                </span>
              )}
            </div>
            <Textarea
              id="trip-summary"
              value={tripData.summary}
              onChange={(e) => setTripData(prev => ({ ...prev, summary: e.target.value }))}
              placeholder="Langer Foster-Text für die Reise – oder KI generieren lassen..."
              rows={6}
            />

            {/* Lifestyle Auswahl für KI-Generierung */}
            <div className="mt-4 space-y-2">
              <Label className="text-sm font-medium">Lifestyle für KI-Text:</Label>
              <Select value={lifestyle} onValueChange={(value) => setLifestyle(value as typeof lifestyle)}>
                <SelectTrigger>
                  <SelectValue placeholder="Wähle deinen Lifestyle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mojobus">🚌 Mojobus - Mojo &amp; Susanne, US-Oldtimer</SelectItem>
                  <SelectItem value="vanlife">🚐 Vanlife - Van-Life auf Rädern</SelectItem>
                  <SelectItem value="rvlife">🚗 RVlife - Recreational Vehicle</SelectItem>
                  <SelectItem value="beachlife">🏖️ Beachlife - Strand &amp; Surf Lifestyle</SelectItem>
                  <SelectItem value="wohnmobil">🏠 Wohnmobil - Wohnmobil/Camper</SelectItem>
                  <SelectItem value="perpetual-travelers">🌍 Perpetual Travelers - Permanent Reisende</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Foster Huntington Stil - ehrlich, direkt, authentisch
              </p>
            </div>

            {/* Trip-Länge Auswahl */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Trip-Länge:</span>
                <div className="flex gap-1">
                  {([
                    { value: 'short', label: 'Kurz', words: '150-400' },
                    { value: 'medium', label: 'Mittel', words: '500-1200' },
                    { value: 'long', label: 'Lang', words: '1200-2500' }
                  ] as const).map((len) => (
                    <button
                      key={len.value}
                      type="button"
                      onClick={() => setTripLength(len.value)}
                      className={`h-5 px-2 text-xs rounded transition-colors ${
                        tripLength === len.value
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      {tripLength === len.value && '✓ '}{len.label} <span className="opacity-70">({len.words})</span>
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {tripLength === 'short' && '📖 Ein Tag unterwegs. Eine Strecke. Der Moment wo du ankommst.'}
                {tripLength === 'medium' && '📖 Mehrere Tage. Stationen die zusammengehören. Eine Geschichte mit Bewegung.'}
                {tripLength === 'long' && '📖 Die ganze Reise. Szenen, Abschweifungen, Veränderung.'}
              </p>
            </div>

            {/* KI-Modell Auswahl */}
            <div className="mt-4 space-y-3">
              <Label className="text-sm font-medium">KI-Modell auswählen:</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div 
                  className={`p-3 border rounded-lg cursor-pointer transition-all ${selectedModel === 'llama4' ? 'border-ocean-500 bg-ocean-50 dark:bg-ocean-950' : 'hover:border-gray-300'}`}
                  onClick={() => setSelectedModel('llama4')}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🚀</span>
                    <div>
                      <p className="font-medium text-sm">Llama 4 Scout</p>
                      <p className="text-xs text-muted-foreground">Schnell & Günstig</p>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    <p>✅ 1-2 Sekunden</p>
                    <p>💰 ~$0.005 pro Artikel</p>
                    <p>⭐ Gute Qualität</p>
                  </div>
                </div>
                
                  <div
                    className={`p-3 border rounded-lg cursor-pointer transition-all ${selectedModel === 'claude' ? 'border-ocean-500 bg-ocean-50 dark:bg-ocean-950' : 'hover:border-gray-300'}`}
                    onClick={() => setSelectedModel('claude')}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🤖</span>
                      <div>
                        <p className="font-medium text-sm">Claude Sonnet 4.6</p>
                        <p className="text-xs text-muted-foreground">Neueste Premium Qualität</p>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      <p>⏱️ 3-6 Sekunden</p>
                      <p>💰 ~$0.015 pro Artikel</p>
                      <p>⭐⭐⭐⭐ Neueste menschliche Texte</p>
                    </div>
                  </div>
              </div>
            </div>
            
            {/* KI-Generierung Button */}
            <div className="mt-2 rounded-lg border border-dashed border-ocean-300 dark:border-ocean-700 bg-ocean-50/50 dark:bg-ocean-950/30 p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-ocean-700 dark:text-ocean-300">
                <span>🤖</span>
                <span>KI generiert beides gleichzeitig:</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <span className="text-base">📝</span>
                  <div>
                    <div className="font-medium text-foreground">Zusammenfassung</div>
                    <div>Langer Foster-Text für den Trip</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-base">🖼️</span>
                  <div>
                    <div className="font-medium text-foreground">
                      {stations.length}× Bild-Text
                    </div>
                    <div>20–100 Wörter pro Bild · Gemini Vision</div>
                  </div>
                </div>
              </div>

              <Button
                type="button"
                onClick={generateArticleWithAI}
                disabled={isGeneratingArticle || stations.length === 0}
                className="w-full"
              >
                {isGeneratingArticle ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {generatingProgress < 10 && 'Bilder komprimieren...'}
                    {generatingProgress >= 10 && generatingProgress < 90 && `Gemini analysiert ${stations.filter(s=>s.file).length} Bilder...`}
                    {generatingProgress >= 90 && generatingProgress < 100 && 'Foster-Text generieren...'}
                    {generatingProgress >= 100 && '✓ Fertig!'}
                  </>
                ) : (
                  <>
                    <span className="mr-2">✨</span>
                    Zusammenfassung + Bild-Texte generieren
                    <span className="ml-2 text-xs opacity-70">
                      {selectedModel === 'claude' ? 'Claude 4.6' : 'Llama 4'}
                    </span>
                  </>
                )}
              </Button>
              {isGeneratingArticle && generatingProgress > 0 && (
                <Progress value={generatingProgress} className="h-1.5" />
              )}
            </div>
          </div>
          
          {/* Trip Type Select - Pflichtfeld */}
          <div className="space-y-2">
            <Label htmlFor="trip-type" className={!tripData.tripType ? 'text-destructive' : ''}>
              Art der Reise *
            </Label>
            <Select
              value={tripData.tripType}
              onValueChange={(value) => setTripData(prev => ({ ...prev, tripType: value as TripType }))}
            >
              <SelectTrigger id="trip-type" className={!tripData.tripType ? 'border-destructive' : ''}>
                <SelectValue placeholder="Wähle die Art deiner Reise... (Pflichtfeld)" />
              </SelectTrigger>
              <SelectContent>
                {TRIP_TYPES.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    <span className="flex items-center gap-2">
                      <span>{type.icon}</span>
                      <span>{type.label}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!tripData.tripType && (
              <p className="text-xs text-destructive">
                Bitte wähle die Art deiner Reise aus
              </p>
            )}
            {tripData.tripType && (
              <p className="text-xs text-muted-foreground">
                Ausgewählt: {TRIP_TYPES.find(t => t.id === tripData.tripType)?.icon} {TRIP_TYPES.find(t => t.id === tripData.tripType)?.label}
              </p>
            )}
          </div>
          
          <CountrySelector
            selectedCountry={tripData.country}
            onCountryChange={(country) => setTripData(prev => ({ ...prev, country }))}
            placeholder="Land auswählen"
          />
        </CardContent>
      </Card>

      {/* Station Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Stationen beschreiben</CardTitle>
          <CardDescription>
            Füge jeder Station einen Titel, Standort und eine Beschreibung hinzu
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {stations.map((station, index) => (
            <div key={station.id} className="border rounded-lg p-4 space-y-3 overflow-hidden">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold">
                    {index + 1}
                  </div>
                </div>
                
                <div className="flex-1 space-y-3 min-w-0">
                  {/* GPS & Location Status */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {station.gps ? (
                      <>
                        <Badge variant="outline" className="text-green-600 border-green-300">
                          <MapPin className="h-3 w-3 mr-1" />
                          GPS: {formatCoordinatesSimple(station.gps.latitude, station.gps.longitude)}
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-xs"
                          onClick={() => setEditingStation(station.id)}
                        >
                          ✏️ GPS ändern
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7"
                        onClick={() => setEditingStation(station.id)}
                      >
                        <MapPin className="h-3 w-3 mr-1" />
                        GPS hinzufügen
                      </Button>
                    )}
                  </div>
                  
                  {/* Title */}
                  <Input
                    value={station.title}
                    onChange={(e) => updateStation(station.id, 'title', e.target.value)}
                    placeholder={`Station ${index + 1} Titel (z.B. Ankunft in Porto)`}
                  />
                  
                  {/* Location - Manually Editable */}
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Standort (manuell änderbar)</Label>
                    <Input
                      value={station.location}
                      onChange={(e) => updateStation(station.id, 'location', e.target.value)}
                      placeholder="z.B. Porto, Portugal"
                    />
                    {station.gps && !station.location && (
                      <p className="text-xs text-orange-600">
                        ⏳ Standort wird ermittelt...
                      </p>
                    )}
                  </div>
                  
                  {/* Description */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">Bildtext</Label>
                      {aiGeneratedCaptions.has(station.id) && (
                        <span className="text-xs bg-ocean-100 dark:bg-ocean-900 text-ocean-700 dark:text-ocean-300 px-1.5 py-0.5 rounded font-medium">
                          ✨ KI-Text – bearbeitbar
                        </span>
                      )}
                    </div>
                    <Textarea
                      value={station.description}
                      onChange={(e) => {
                        updateStation(station.id, 'description', e.target.value);
                        // KI-Badge entfernen sobald User editiert
                        if (aiGeneratedCaptions.has(station.id)) {
                          setAiGeneratedCaptions(prev => {
                            const next = new Set(prev);
                            next.delete(station.id);
                            return next;
                          });
                        }
                      }}
                      placeholder="Kurzer Text zu diesem Bild (oder KI generieren lassen)..."
                      rows={3}
                    />
                    {station.description && (
                      <p className="text-xs text-muted-foreground text-right">
                        {station.description.trim().split(/\s+/).filter(Boolean).length} Wörter
                      </p>
                    )}
                  </div>
                  
                  {/* Date */}
                  <Input
                    type="date"
                    value={station.date}
                    onChange={(e) => updateStation(station.id, 'date', e.target.value)}
                    className="max-w-[200px]"
                  />
                </div>
                
                <div className="flex-shrink-0">
                  <img
                    src={station.preview}
                    alt={station.title || `Station ${index + 1}`}
                    className="w-20 h-20 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity hover:ring-2 hover:ring-primary"
                    onClick={() => {
                      setDraftDescription(station.description);
                      setStationPreviewOpen(station.id);
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

       {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setCurrentStep('upload')}>
          <ChevronLeft className="h-4 w-4 mr-2" />
          Zurück
        </Button>
        <Button
          onClick={() => setCurrentStep('preview')}
          disabled={!canProceedToPreview}
        >
          Vorschau anzeigen
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      </div>

      {/* Station-Bild Dialog (groß) */}
      <Dialog 
        open={!!stationPreviewOpen} 
        onOpenChange={(open) => {
          if (!open) {
            // Speichern beim Schließen
            if (stationPreviewOpen) {
              updateStation(stationPreviewOpen, 'description', draftDescription);
              // KI-Badge entfernen
              const st = stations.find(s => s.id === stationPreviewOpen);
              if (st && aiGeneratedCaptions.has(st.id)) {
                setAiGeneratedCaptions(prev => {
                  const next = new Set(prev);
                  next.delete(st.id);
                  return next;
                });
              }
            }
            setStationPreviewOpen(null);
          }
        }}
      >
        <DialogContent className="max-w-3xl" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>
              {(() => {
                const st = stations.find(s => s.id === stationPreviewOpen);
                if (!st) return '';
                const idx = stations.indexOf(st);
                return `Station ${idx + 1}: ${st.title || st.location || 'Unbenannt'}`;
              })()}
            </DialogTitle>
            <DialogDescription>
              {(() => {
                const st = stations.find(s => s.id === stationPreviewOpen);
                return st?.date ? new Date(st.date).toLocaleDateString('de-DE') : '';
              })()}
            </DialogDescription>
          </DialogHeader>
          {(() => {
            const stIndex = stations.findIndex(s => s.id === stationPreviewOpen);
            if (stIndex === -1) return null;
            const st = stations[stIndex];
            // Draft laden wenn Dialog für neue Station geöffnet wird
            if (draftDescription === '' && st.description !== '') {
              setDraftDescription(st.description);
            }
            return (
              <div className="space-y-4">
                {/* Großes Bild */}
                <div className="relative rounded-lg overflow-hidden bg-black">
                  <img
                    src={st.preview}
                    alt={st.title || `Station ${stIndex + 1}`}
                    className="w-full max-h-[50vh] object-contain mx-auto"
                  />
                </div>
                {/* Station-Info */}
                <div className="space-y-3">
                  {st.gps && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-green-600" />
                      <span className="text-muted-foreground">{formatCoordinatesSimple(st.gps.latitude, st.gps.longitude)}</span>
                      {st.location && <span>· {st.location}</span>}
                    </div>
                  )}
                  
                  {/* Editable Description */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">✏️ Bildtext editieren</Label>
                    <Textarea
                      value={draftDescription}
                      onChange={(e) => setDraftDescription(e.target.value)}
                      placeholder="Beschreibe dieses Bild..."
                      rows={5}
                      className="min-h-[120px]"
                    />
                  </div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );

  // Step 3: Preview on map
  const renderPreviewStep = () => (
    <div className="space-y-6">
      {/* Map Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapIcon className="h-5 w-5" />
            Routen-Vorschau
          </CardTitle>
          <CardDescription>
            So wird dein Trip auf der Karte angezeigt
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mapMarkers.length >= 2 ? (
            <VanillaMap
              center={[mapMarkers[0].lat, mapMarkers[0].lng]}
              zoom={6}
              markers={mapMarkers}
              polylines={[{
                points: mapMarkers.map(m => [m.lat, m.lng]),
                color: '#0891B2',
                weight: 3,
                opacity: 0.8,
              }]}
              height="400px"
              fitToMarkers
            />
          ) : (
            <div className="h-[400px] flex items-center justify-center border rounded-lg bg-muted">
              <div className="text-center">
                <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Mindestens 2 Stationen mit GPS erforderlich für Vorschau
                </p>
              </div>
            </div>
          )}
          
          {/* Route Stats */}
          <div className="mt-4 flex gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Route className="h-4 w-4 text-primary" />
              <span><strong>{stations.length}</strong> Stationen</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-green-600" />
              <span><strong>{stationsWithGps}</strong> mit GPS</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trip Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Trip-Zusammenfassung</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-4">
            {stations[0]?.preview && (
              <img
                src={stations[0].preview}
                alt="Titelbild"
                className="w-24 h-24 object-cover rounded"
              />
            )}
            <div className="flex-1">
              <h3 className="text-xl font-bold">{tripData.title || 'Unbenannter Trip'}</h3>
              <p className="text-muted-foreground">{tripData.summary}</p>
              {tripData.country && (
                <Badge variant="outline" className="mt-2">
                  {tripData.country}
                </Badge>
              )}
            </div>
          </div>
          
          {/* Station List */}
          <div className="space-y-2 mt-4">
            {stations.map((station, index) => (
              <div key={station.id} className="flex items-center gap-3 p-2 bg-muted rounded overflow-hidden">
                <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{station.title || `Station ${index + 1}`}</p>
                  {station.location && (
                    <p className="text-xs text-muted-foreground truncate">{station.location}</p>
                  )}
                </div>
                {station.gps ? (
                  <MapPin className="h-4 w-4 text-green-600 flex-shrink-0" />
                ) : (
                  <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Slideshow – nur mit echten Blossom-URLs (keine base64/blob previews!) */}
      {(() => {
        const blossomUrls = stations.map(s => s.uploadedUrl).filter((u): u is string => !!u && u.startsWith('http'));
        const notUploaded = stations.filter(s => s.file && !s.uploadedUrl).length;
        if (notUploaded > 0) {
          return (
            <div className="p-4 border rounded-lg bg-muted/30 text-sm text-muted-foreground text-center space-y-1">
              <p className="font-medium">🎞️ Slideshow</p>
              <p>⚠️ Erst Bilder zu Blossom hochladen, dann Slideshow generieren.</p>
              <p className="text-xs">({notUploaded} Bild{notUploaded !== 1 ? 'er' : ''} noch nicht hochgeladen – klicke "Trip veröffentlichen")</p>
            </div>
          );
        }
        return (
          <SlideshowBlock
            imageUrls={blossomUrls}
            lifestyle={lifestyle}
            title={tripData.title || 'trip'}
            onVideoReady={(url) => {
              setSlideshowVideoUrl(url);
              toast({
                title: '🎞️ Slideshow gespeichert',
                description: 'Video wird beim Veröffentlichen automatisch eingebunden.',
              });
            }}
          />
        );
      })()}

      {/* Video-URL: automatisch via Slideshow ODER manuell eintragen */}
      <div className="space-y-2 p-4 border rounded-lg bg-muted/30">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">🎞️ Video-URL</span>
          {slideshowVideoUrl && (
            <span className="text-xs bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded">
              ✅ via Slideshow
            </span>
          )}
        </div>
        <Input
          value={slideshowVideoUrl || ''}
          onChange={(e) => setSlideshowVideoUrl(e.target.value || null)}
          placeholder="https://... (MP4-URL – automatisch via Slideshow oder manuell eintragen)"
          className="font-mono text-xs"
        />
        <p className="text-xs text-muted-foreground">
          Wird als <code className="bg-muted px-1 rounded">['video', url]</code> im Trip gespeichert und auf der Trip-Seite abgespielt.
        </p>
        {/* Vorschau wenn URL vorhanden */}
        {slideshowVideoUrl && slideshowVideoUrl.startsWith('http') && (
          <video
            src={slideshowVideoUrl}
            controls
            playsInline
            className="w-full rounded-lg mt-2"
            style={{ maxHeight: '300px' }}
          >
            <source src={slideshowVideoUrl} type="video/mp4" />
          </video>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setCurrentStep('details')}>
          <ChevronLeft className="h-4 w-4 mr-2" />
          Zurück
        </Button>
        <Button
          onClick={handlePublish}
          disabled={!canPublish || isUploading || isPublishing}
        >
          {isUploading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {uploadProgress.status || `Lade hoch... (${uploadProgress.current}/${uploadProgress.total})`}
            </>
          ) : isPublishing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Veröffentliche...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              {isEditMode ? 'Trip aktualisieren' : 'Trip veröffentlichen'}
            </>
          )}
        </Button>
      </div>
      
      {/* Progress Bar during Upload */}
      {isUploading && uploadProgress.total > 0 && (
        <div className="mt-4 space-y-2">
          <Progress 
            value={(uploadProgress.current / uploadProgress.total) * 100}
            className="h-2"
          />
          <p className="text-sm text-center text-muted-foreground">
            {uploadProgress.status} ({uploadProgress.current} von {uploadProgress.total} Bildern)
          </p>
        </div>
      )}

      {/* Teaser-Box nach Trip-Publish */}
      {showTeaserBox && tripTeaserPreview && (
        <TeaserPreviewBox
          preview={tripTeaserPreview}
          buttonLabel="🚀 Trip im Nostr-Feed teilen"
          publishedLabel="✅ Trip-Teaser veröffentlicht!"
          infoText="Erscheint bei Primal, Amethyst & Damus mit Titel, Bild, Video-Link"
          isPublished={isTripTeaserPublished}
          onSuccess={() => {
            setIsTripTeaserPublished(true);
            // Nach 1.5s zurück zur Übersicht
            setTimeout(() => {
              setStations([]);
              setTripData({ title: '', summary: '', country: '', tripType: '' });
              setEditDtag(null);
              setCurrentStep('upload');
              navigate('/map/trips');
            }, 1500);
          }}
        />
      )}

      {/* Skip Teaser Button (angezeigt nach Trip-Publish) */}
      {showTeaserBox && !isTripTeaserPublished && (
        <div className="mt-2">
          <Button variant="outline" onClick={skipTripTeaser} className="w-full">
            Überspringen &amp; zurück
          </Button>
        </div>
      )}
    </div>
  );

  // Step 4: Publishing (loading state)
  const renderPublishStep = () => (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      <h3 className="text-xl font-semibold">Trip wird veröffentlicht...</h3>
      <p className="text-muted-foreground">{uploadProgress.status}</p>
      {uploadProgress.total > 0 && (
        <Progress 
          value={(uploadProgress.current / uploadProgress.total) * 100}
          className="w-64"
        />
      )}
    </div>
  );

  // Main render
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Route className="h-5 w-5" />
          {isEditMode ? 'Trip bearbeiten' : 'Trip erstellen'}
        </CardTitle>
        <CardDescription>
          {isEditMode 
            ? 'Bearbeite deinen Trip. Änderungen überschreiben die bestehende Version.'
            : 'Erstelle einen Trip aus mehreren Bildern mit GPS-Daten. Das erste Bild ist das Titelbild und bestimmt den Startort.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Loading state for edit mode */}
        {isEditMode && isLoadingExisting ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-muted-foreground">Trip wird geladen...</p>
          </div>
        ) : (
          <>
            {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[
            { step: 'upload', label: 'Bilder', icon: Camera },
            { step: 'details', label: 'Details', icon: Edit3 },
            { step: 'preview', label: 'Vorschau', icon: MapIcon },
          ].map((item, index) => {
            const isActive = currentStep === item.step;
            const isPast = ['upload', 'details', 'preview', 'publish'].indexOf(currentStep) > index;
            
            return (
              <div key={item.step} className="flex items-center">
                <div
                  className={`flex items-center gap-2 px-3 py-2 rounded-full ${
                    isActive 
                      ? 'bg-primary text-primary-foreground' 
                      : isPast
                        ? 'bg-primary/20 text-primary'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  <span className="text-sm font-medium hidden sm:inline">{item.label}</span>
                </div>
                {index < 2 && (
                  <div className={`w-8 h-0.5 mx-1 ${
                    isPast ? 'bg-primary' : 'bg-muted'
                  }`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Step Content */}
        {renderStepContent()}
          </>
        )}
      </CardContent>
    </Card>
  );
}
