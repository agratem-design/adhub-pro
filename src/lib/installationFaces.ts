export type ReinstalledFaces = 'both' | 'face_a' | 'face_b';

export interface InstallationFacesSource {
  faces_to_install?: unknown;
  reinstalled_faces?: ReinstalledFaces | null;
  billboard?: PhysicalFacesSource | null;
}

export interface PhysicalFacesSource {
  Faces_Count?: unknown;
  faces_count?: unknown;
  Faces?: unknown;
  faces?: unknown;
}

const parsePositiveFacesCount = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (/^(1|one|single|وجه\s*واحد|وجه1)$/.test(normalized) || /وجه\s*واحد|وجه1|single|one/.test(normalized)) return 1;
    if (/^(2|two|double|وجهين|وجهان|وجه\s*2)$/.test(normalized) || /وجهين|وجهان|وجه\s*2|double|two/.test(normalized)) return 2;
    const num = Number(normalized);
    if (Number.isFinite(num) && num > 0) return Math.max(1, Math.min(2, Math.round(num)));
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.max(1, Math.min(2, Math.round(parsed)));
};

export const resolveInstallationFacesCount = (
  item: InstallationFacesSource,
  billboard: PhysicalFacesSource | null | undefined = item.billboard,
  taskType?: string | null,
): number => {
  const physicalFaces = [
    billboard?.Faces_Count,
    billboard?.faces_count,
    billboard?.Faces,
    billboard?.faces,
  ].map(parsePositiveFacesCount).find((faces): faces is number => faces !== null) ?? null;
  const requestedFaces = parsePositiveFacesCount(item.faces_to_install);
  const reinstalledFaces = item.reinstalled_faces || undefined;

  let resolvedFaces = requestedFaces ?? physicalFaces ?? 1;
  if (taskType === 'reinstallation') {
    if (reinstalledFaces === 'face_a' || reinstalledFaces === 'face_b') resolvedFaces = 1;
    if (reinstalledFaces === 'both') {
      resolvedFaces = physicalFaces !== null ? physicalFaces : Math.max(2, resolvedFaces);
    }
  }

  // A task can request fewer faces than the billboard, but never more than it physically owns.
  return physicalFaces !== null ? Math.min(resolvedFaces, physicalFaces) : resolvedFaces;
};

export const calculateInstallationArea = (
  width: number,
  height: number,
  item: InstallationFacesSource,
  billboard: PhysicalFacesSource | null | undefined = item.billboard,
  taskType?: string | null,
): number => {
  const safeWidth = Number.isFinite(Number(width)) ? Math.max(0, Number(width)) : 0;
  const safeHeight = Number.isFinite(Number(height)) ? Math.max(0, Number(height)) : 0;
  return safeWidth * safeHeight * resolveInstallationFacesCount(item, billboard, taskType);
};
