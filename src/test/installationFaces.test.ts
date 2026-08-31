import { describe, expect, it } from 'vitest';
import { calculateInstallationArea, resolveInstallationFacesCount } from '@/lib/installationFaces';

describe('installation face calculations', () => {
  it('never prints or charges a second face for a one-face billboard', () => {
    const item = { faces_to_install: 2 };
    const billboard = { Faces_Count: 1 };

    expect(resolveInstallationFacesCount(item, billboard)).toBe(1);
    expect(calculateInstallationArea(6, 3, item, billboard)).toBe(18);
  });

  it('uses the selected task faces when fewer than the physical faces', () => {
    const item = { faces_to_install: 1 };
    const billboard = { Faces_Count: 2 };

    expect(resolveInstallationFacesCount(item, billboard)).toBe(1);
    expect(calculateInstallationArea(6, 3, item, billboard)).toBe(18);
  });

  it('calculates both faces exactly once', () => {
    const item = { faces_to_install: 2 };
    const billboard = { Faces_Count: 2 };

    expect(resolveInstallationFacesCount(item, billboard)).toBe(2);
    expect(calculateInstallationArea(6, 3, item, billboard)).toBe(36);
  });

  it('limits a single-face reinstallation to one face', () => {
    const item = { faces_to_install: 2, reinstalled_faces: 'face_b' as const };
    const billboard = { Faces_Count: 2 };

    expect(resolveInstallationFacesCount(item, billboard, 'reinstallation')).toBe(1);
    expect(calculateInstallationArea(6, 3, item, billboard, 'reinstallation')).toBe(18);
  });

  it('recognizes legacy face-count aliases and Arabic labels', () => {
    const item = { faces_to_install: 2 };

    expect(resolveInstallationFacesCount(item, { faces_count: 1 })).toBe(1);
    expect(resolveInstallationFacesCount(item, { Faces: 'وجه واحد' })).toBe(1);
    expect(resolveInstallationFacesCount(item, { Faces: '1' })).toBe(1);
  });

  it('strictly forces 1 face and single-face area for single-face billboards during reinstallation even if reinstalled_faces is both', () => {
    // Like BS1162: billboard physical face is 1, but task item requested 'both'
    const item = { faces_to_install: 1, reinstalled_faces: 'both' as const };
    const billboard = { Faces_Count: 1, Size: '4x3', Billboard_Name: 'BS1162' };

    expect(resolveInstallationFacesCount(item, billboard, 'reinstallation')).toBe(1);
    expect(calculateInstallationArea(4, 3, item, billboard, 'reinstallation')).toBe(12);
  });
});
