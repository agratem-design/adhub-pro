/** Municipality lists start with the original photo, without advertising artwork. */
export function getMunicipalityImportMedia(billboard: {
  Image_URL?: string | null; image_name?: string | null;
}) {
  return {
    image_url: billboard.Image_URL || (billboard.image_name ? `/image/${billboard.image_name}` : null),
    design_face_a: null,
    design_face_b: null,
    overlay_config: {
      enabled: false,
      show_image: true,
      x_pct: 50,
      y_pct: 78,
      scale_pct: 100,
      rotation_deg: 0,
    },
  };
}
