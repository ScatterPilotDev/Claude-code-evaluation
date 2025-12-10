#!/usr/bin/env python3
"""
Generate ScatterPilot branding assets: favicon and social preview image
"""

from PIL import Image, ImageDraw, ImageFont
import os

# Output directory
OUTPUT_DIR = "/workspaces/Claude-code-evaluation/scatterpilot/frontend/public"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Brand colors
PURPLE_DARK = (107, 70, 193)  # #6B46C1
PURPLE_LIGHT = (139, 92, 246)  # #8B5CF6
WHITE = (255, 255, 255)

def create_favicon_base(size=512):
    """Create base favicon image with SP logo"""
    img = Image.new('RGB', (size, size), PURPLE_DARK)
    draw = ImageDraw.Draw(img)

    # Draw circle
    draw.ellipse([0, 0, size, size], fill=PURPLE_DARK)

    # Draw "SP" text
    try:
        # Try to use a bold font
        font_size = int(size * 0.5)
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
    except:
        # Fallback to default font
        font = ImageFont.load_default()

    text = "SP"

    # Get text bounding box for centering
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]

    # Center text
    x = (size - text_width) // 2
    y = (size - text_height) // 2 - int(size * 0.05)  # Slight adjustment

    draw.text((x, y), text, fill=WHITE, font=font)

    return img

def create_gradient_background(width, height):
    """Create vertical gradient from purple dark to purple light"""
    img = Image.new('RGB', (width, height), PURPLE_DARK)
    draw = ImageDraw.Draw(img)

    # Create gradient
    for y in range(height):
        ratio = y / height
        r = int(PURPLE_DARK[0] + (PURPLE_LIGHT[0] - PURPLE_DARK[0]) * ratio)
        g = int(PURPLE_DARK[1] + (PURPLE_LIGHT[1] - PURPLE_DARK[1]) * ratio)
        b = int(PURPLE_DARK[2] + (PURPLE_LIGHT[2] - PURPLE_DARK[2]) * ratio)
        draw.line([(0, y), (width, y)], fill=(r, g, b))

    return img

def create_social_preview():
    """Create 1200x630 social media preview image"""
    width, height = 1200, 630

    # Create gradient background
    img = create_gradient_background(width, height)
    draw = ImageDraw.Draw(img)

    # Load fonts
    try:
        title_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 90)
        tagline_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 48)
        subtitle_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 36)
    except:
        title_font = ImageFont.load_default()
        tagline_font = ImageFont.load_default()
        subtitle_font = ImageFont.load_default()

    # Draw main title
    title = "ScatterPilot"
    bbox = draw.textbbox((0, 0), title, font=title_font)
    title_width = bbox[2] - bbox[0]
    x = (width - title_width) // 2
    y = 150
    draw.text((x, y), title, fill=WHITE, font=title_font)

    # Draw tagline
    tagline = "Create Invoices in 30 Seconds"
    bbox = draw.textbbox((0, 0), tagline, font=tagline_font)
    tagline_width = bbox[2] - bbox[0]
    x = (width - tagline_width) // 2
    y = 280
    draw.text((x, y), tagline, fill=WHITE, font=tagline_font)

    # Draw subtitle
    subtitle = "AI-powered invoice generation"
    bbox = draw.textbbox((0, 0), subtitle, font=subtitle_font)
    subtitle_width = bbox[2] - bbox[0]
    x = (width - subtitle_width) // 2
    y = 370
    draw.text((x, y), subtitle, fill=WHITE, font=subtitle_font)

    # Add small logo in corner
    logo_size = 80
    logo = create_favicon_base(logo_size)
    img.paste(logo, (60, 60))

    return img

def main():
    print("🎨 Generating ScatterPilot branding assets...")

    # Create base favicon
    print("\n📱 Creating favicon images...")
    base_favicon = create_favicon_base(512)

    # Save various sizes
    sizes = [
        (16, "favicon-16x16.png"),
        (32, "favicon-32x32.png"),
        (180, "apple-touch-icon.png"),
        (512, "favicon-512x512.png")
    ]

    for size, filename in sizes:
        resized = base_favicon.resize((size, size), Image.Resampling.LANCZOS)
        filepath = os.path.join(OUTPUT_DIR, filename)
        resized.save(filepath, "PNG")
        print(f"  ✓ Created {filename}")

    # Create ICO file (multi-size)
    ico_path = os.path.join(OUTPUT_DIR, "favicon.ico")
    icon_sizes = [(16, 16), (32, 32), (48, 48)]
    icons = [base_favicon.resize(size, Image.Resampling.LANCZOS) for size in icon_sizes]
    icons[0].save(ico_path, format='ICO', sizes=icon_sizes)
    print(f"  ✓ Created favicon.ico (multi-size)")

    # Create social preview
    print("\n🖼️  Creating social media preview image...")
    social_img = create_social_preview()
    social_path = os.path.join(OUTPUT_DIR, "og-image.png")
    social_img.save(social_path, "PNG", optimize=True)
    print(f"  ✓ Created og-image.png (1200x630)")

    print("\n✅ All branding assets created successfully!")
    print(f"📁 Location: {OUTPUT_DIR}")

if __name__ == "__main__":
    main()
