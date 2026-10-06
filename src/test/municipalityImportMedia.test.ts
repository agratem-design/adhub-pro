import { describe, expect, it } from 'vitest';
import { getMunicipalityImportMedia } from '../utils/municipalityImportMedia';

describe('municipality import media', () => {
  it('imports the original photo and disables artwork even when the source has designs', () => {
    const source = { Image_URL: '/original.jpg', image_name: 'fallback.jpg',
      design_face_a: '/front-design.jpg', design_face_b: '/back-design.jpg',
      overlay_config: { enabled: true, show_image: false } };
    const media = getMunicipalityImportMedia(source);
    expect(media.image_url).toBe('/original.jpg');
    expect(media.design_face_a).toBeNull();
    expect(media.design_face_b).toBeNull();
    expect(media.overlay_config.enabled).toBe(false);
    expect(media.overlay_config.show_image).toBe(true);
    expect(source.design_face_a).toBe('/front-design.jpg');
    expect(source.overlay_config.enabled).toBe(true);
  });
  it('uses a local original image name and leaves missing photos empty', () => {
    expect(getMunicipalityImportMedia({ image_name: 'ZL-ZL0136.jpg' }).image_url).toBe('/image/ZL-ZL0136.jpg');
    expect(getMunicipalityImportMedia({}).image_url).toBeNull();
  });
});
