import ExifReader from 'exifreader';

export interface ExifData {
  lat: number | null;
  lng: number | null;
  capturedAt: string | null;
  deviceMake: string | null;
  deviceModel: string | null;
  directionDegrees: number | null;
  focalLength: number | null;
  zoomRatio: number | null;
  orbitRadiusMeters: number;
}

/**
 * Convert EXIF GPS coordinates to decimal degrees
 */
function gpsToDecimal(
  degrees: number,
  minutes: number,
  seconds: number,
  ref: string
): number {
  let decimal = degrees + minutes / 60 + seconds / 3600;
  if (ref === 'S' || ref === 'W') decimal = -decimal;
  return decimal;
}

/**
 * Estimate orbit radius in meters based on focal length and zoom
 * Samsung S24 Ultra 3x zoom ≈ 150mm equivalent focal length
 * Typical billboard photography distance: 30-80m
 */
function estimateOrbitRadius(focalLength: number | null, zoomRatio: number | null): number {
  if (focalLength && focalLength > 0) {
    // Higher focal length = further away subject
    // Base: 26mm wide = ~10m, 150mm tele = ~60m
    return Math.round((focalLength / 26) * 10);
  }
  if (zoomRatio && zoomRatio > 1) {
    return Math.round(zoomRatio * 20);
  }
  return 50; // default
}

/**
 * Extract EXIF data from an image file
 */
export async function extractExifData(file: File): Promise<ExifData> {
  const result: ExifData = {
    lat: null,
    lng: null,
    capturedAt: null,
    deviceMake: null,
    deviceModel: null,
    directionDegrees: null,
    focalLength: null,
    zoomRatio: null,
    orbitRadiusMeters: 50,
  };

  try {
    const arrayBuffer = await file.arrayBuffer();
    const tags = ExifReader.load(arrayBuffer, { expanded: true });

    // GPS coordinates (rounded to 6 decimal places for concise format ~10cm precision)
    if (tags.gps?.Latitude !== undefined && tags.gps?.Longitude !== undefined) {
      result.lat = Number(tags.gps.Latitude.toFixed(6));
      result.lng = Number(tags.gps.Longitude.toFixed(6));
    }

    // Date/Time
    const exifTags = tags.exif || {};
    const dateTag = exifTags.DateTimeOriginal || exifTags.DateTime;
    if (dateTag?.description) {
      // EXIF format: "2024:01:15 14:30:00" → ISO
      const dtStr = dateTag.description.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
      result.capturedAt = new Date(dtStr).toISOString();
    }

    // Device info
    if (exifTags.Make?.description) {
      result.deviceMake = exifTags.Make.description;
    }
    if (exifTags.Model?.description) {
      result.deviceModel = exifTags.Model.description;
    }

    // Direction (compass bearing)
    if (exifTags.GPSImgDirection?.description) {
      result.directionDegrees = parseFloat(exifTags.GPSImgDirection.description);
    } else if ((tags as any).gps?.GPSImgDirection !== undefined) {
      result.directionDegrees = (tags as any).gps.GPSImgDirection;
    }

    // Focal length
    if (exifTags.FocalLength?.description) {
      result.focalLength = parseFloat(exifTags.FocalLength.description);
    }
    if (exifTags.FocalLengthIn35mmFilm?.description) {
      result.focalLength = parseFloat(exifTags.FocalLengthIn35mmFilm.description);
    }

    // Digital zoom ratio
    if (exifTags.DigitalZoomRatio?.description) {
      const zr = parseFloat(exifTags.DigitalZoomRatio.description);
      if (zr > 0) result.zoomRatio = zr;
    }

    // Estimate orbit radius
    result.orbitRadiusMeters = estimateOrbitRadius(result.focalLength, result.zoomRatio);
  } catch (err) {
    console.warn('Failed to extract EXIF data:', err);
  }

  return result;
}
