# ScatterPilot Design System
## Claude.ai-Inspired UI with ScatterPilot Brand Colors

### Color Palette (Extracted from Landing Page)

#### Primary Colors
- **Purple (Brand Primary)**
  - `purple-50`: #FAF5FF - Subtle backgrounds
  - `purple-500`: #A855F7 - Gradient accents
  - `purple-600`: #9333EA - Primary actions, brand elements
  - `purple-700`: #7E22CE - Hover states, emphasis

- **Pink (Brand Secondary)**
  - `pink-50`: #FDF2F8 - Subtle backgrounds
  - `pink-500`: #EC4899 - Gradient accents
  - `pink-600`: #DB2777 - Secondary accents

#### Brand Gradients
- **Hero Gradient**: `from-purple-600 to-pink-600`
- **Background Gradient**: `from-purple-50 via-white to-pink-50`
- **Accent Gradient**: `from-purple-500 to-pink-500`

#### Neutrals (Dark Theme Adapted)
- **Background Tones**:
  - `slate-950`: #020617 - App background (darkest)
  - `slate-900`: #0F172A - Sidebar background
  - `slate-800`: #1E293B - Card backgrounds
  - `slate-700`: #334155 - Elevated surfaces

- **Border & Dividers**:
  - `slate-700`: #334155 - Subtle borders
  - `slate-600`: #475569 - Prominent borders

- **Text Colors**:
  - `slate-50`: #F8FAFC - Primary text (dark theme)
  - `slate-300`: #CBD5E1 - Secondary text
  - `slate-400`: #94A3B8 - Tertiary text, placeholders

### Typography

#### Font Stack (Claude.ai-inspired)
```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen",
             "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue",
             sans-serif;
```

#### Font Sizes
- **Display**: text-5xl, text-6xl (48px, 60px)
- **Heading 1**: text-3xl (30px)
- **Heading 2**: text-2xl (24px)
- **Heading 3**: text-xl (20px)
- **Body**: text-base (16px)
- **Small**: text-sm (14px)
- **Tiny**: text-xs (12px)

### Spacing & Layout

#### Container Widths
- **Sidebar**: 256px (w-64)
- **Max Content Width**: 1280px (max-w-7xl)
- **Comfortable Padding**: p-6, p-8

#### Border Radius
- **Small**: rounded-lg (8px)
- **Medium**: rounded-xl (12px)
- **Large**: rounded-2xl (16px)
- **Full**: rounded-full

### Component Patterns

#### Buttons
- **Primary**: Purple gradient background, white text, shadow
- **Secondary**: Transparent bg, purple border, purple text
- **Danger**: Red tones (for delete actions)
- **Ghost**: Transparent, hover bg-slate-700

#### Cards
- **Default**: bg-slate-800, border-slate-700, rounded-xl, shadow-lg
- **Elevated**: bg-slate-750, border-slate-600
- **Interactive**: Hover shadow-2xl, transition-all

#### Inputs
- **Style**: Dark bg (slate-800), light text, purple focus ring
- **Border**: border-slate-600 default, border-purple-500 focus
- **Padding**: px-4 py-3

#### Navigation
- **Active State**: Purple gradient background or purple text
- **Hover**: bg-slate-700/50
- **Icon Size**: h-5 w-5 or h-6 w-6

### Micro-interactions

#### Transitions
```css
transition-all duration-200 ease-in-out
transition-colors duration-150
```

#### Hover Effects
- Buttons: scale-105, shadow increase
- Cards: shadow increase, subtle lift
- Links: color change, underline appear

#### Loading States
- Skeleton: bg-slate-700 animate-pulse
- Spinner: Purple gradient, rotating

### Shadows

#### Elevation
- **Low**: shadow-sm
- **Medium**: shadow-lg
- **High**: shadow-2xl
- **Colored**: shadow-purple-500/20 (for brand elements)

### Layout Structure (Claude.ai-inspired)

```
┌─────────────────────────────────────────────┐
│           Top Bar (Optional)                │
├──────────┬──────────────────────────────────┤
│          │                                  │
│  Sidebar │      Main Content Area          │
│  (256px) │                                  │
│          │                                  │
│  - Logo  │  ┌─────────────────────────┐    │
│  - Nav   │  │   Welcome Message       │    │
│  - User  │  │   Time-based Greeting   │    │
│          │  └─────────────────────────┘    │
│          │                                  │
│          │  ┌─────────────────────────┐    │
│          │  │   Primary Action Area   │    │
│          │  │   (Create Invoice)      │    │
│          │  └─────────────────────────┘    │
│          │                                  │
│          │  Quick Actions / Recent Items    │
│          │                                  │
└──────────┴──────────────────────────────────┘
```

### Dark Theme Adaptations

Since Claude.ai uses a dark theme, we're adapting ScatterPilot to use:
- **Dark backgrounds** (slate-950, slate-900, slate-800)
- **Light text** (slate-50, slate-300)
- **Purple/Pink accents** maintained from brand
- **Subtle borders** (slate-700) instead of gray-200
- **Elevated cards** with darker backgrounds
