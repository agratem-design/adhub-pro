import os
import math
from PIL import Image, ImageDraw

def create_google_drive_icon():
    # 2048x2048 super canvas
    canvas_size = 2048
    img = Image.new('RGBA', (canvas_size, canvas_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    scale = canvas_size / 1000.0
    
    # Precise standard Google Drive coordinates
    # 1. Yellow (Top-Right bar)
    yellow_poly = [
        (350 * scale, 140 * scale),
        (650 * scale, 140 * scale),
        (925 * scale, 616 * scale),
        (625 * scale, 616 * scale)
    ]
    
    # 2. Green (Bottom bar)
    green_poly = [
        (625 * scale, 616 * scale),
        (925 * scale, 616 * scale),
        (775 * scale, 876 * scale),
        (175 * scale, 876 * scale)
    ]
    
    # 3. Blue (Left bar)
    blue_poly = [
        (350 * scale, 140 * scale),
        (625 * scale, 616 * scale),
        (475 * scale, 876 * scale),
        (175 * scale, 876 * scale),
        (75 * scale, 616 * scale)
    ]

    # Draw in correct layering
    draw.polygon(green_poly, fill=(0, 172, 71, 255))      # #00AC47
    draw.polygon(blue_poly, fill=(38, 132, 252, 255))     # #2684FC
    draw.polygon(yellow_poly, fill=(255, 186, 0, 255))    # #FFBA00
    
    # Resample with high-quality Lanczos filter
    img_512 = img.resize((512, 512), Image.Resampling.LANCZOS)
    img_256 = img.resize((256, 256), Image.Resampling.LANCZOS)

    desktop_dir = os.path.join(os.path.dirname(__file__), '..', 'desktop-uploader')
    public_dir = os.path.join(os.path.dirname(__file__), '..', 'public')

    os.makedirs(desktop_dir, exist_ok=True)
    os.makedirs(public_dir, exist_ok=True)

    # Save PNG files
    img_512.save(os.path.join(desktop_dir, 'drive_icon.png'), 'PNG')
    img_512.save(os.path.join(public_dir, 'drive_icon.png'), 'PNG')
    img_512.save(os.path.join(desktop_dir, 'icon.png'), 'PNG')

    # Save Windows ICO files with multiple resolutions (16 to 256)
    ico_sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    
    img_256.save(
        os.path.join(desktop_dir, 'drive_icon.ico'),
        format='ICO',
        sizes=ico_sizes
    )
    img_256.save(
        os.path.join(public_dir, 'drive_icon.ico'),
        format='ICO',
        sizes=ico_sizes
    )
    img_256.save(
        os.path.join(desktop_dir, 'icon.ico'),
        format='ICO',
        sizes=ico_sizes
    )

    print("Google Drive Icons generated successfully!")

if __name__ == '__main__':
    create_google_drive_icon()
