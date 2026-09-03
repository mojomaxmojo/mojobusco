import type { GpsData, GpsStatus } from '@/lib/gpsExtraction';
import type { TripType } from '@/config/tags';

// Trip Station - represents one image with GPS and description
export interface TripStation {
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
export interface TripData {
  title: string;
  summary: string;
  country: string;
  tripType: TripType | '';
}

// Step wizard state
export type WizardStep = 'upload' | 'details' | 'preview' | 'publish';
