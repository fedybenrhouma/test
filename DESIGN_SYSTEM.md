# Design System Documentation

## Overview
This project uses a dark-themed, modern cryptocurrency dashboard with responsive design and smooth animations. Built with Angular 17+, Tailwind CSS v4.2.2, and a custom theme.

---

## Color Palette

### Primary Colors
- **Main Background**: `#0a0a0a` (pure dark)
- **Card/Secondary Background**: `#111111` (slightly lighter dark)
- **Accent Red**: `#ef233c` (brand color - alerts, CTAs)
- **Success Green**: `#00d68f` (positive metrics, gains)

### Text Colors
- **Primary Text**: `#f2f2f2` (main text, headings)
- **Secondary Text**: `#555555` (labels, helper text)
- **Muted Text**: `#888888` (disabled, inactive states)

### Border/Shadow Colors
- **Border**: `border-white/7` to `border-white/15` (subtle light borders)
- **Hover Border**: `border-white/15` to `border-white/20`
- **Shadow**: `shadow-[0_20px_60px_rgba(0,0,0,0.5)]` (dark shadows)

---

## Typography

### Font System
- **Display Font**: `font-display` (headings, brand text)
- **Default Font**: `font-sans` (body text)

### Text Sizes
- **Headings**: `text-xl sm:text-2xl` (responsive sizing)
- **Body**: `text-sm sm:text-[14px]`
- **Labels**: `text-xs sm:text-[13px]`
- **Captions**: `text-[10px] sm:text-[11px]`
- **Mono**: `font-mono` (for prices, values)

### Font Weights
- **Bold**: `font-bold` (primary headings)
- **Semibold**: `font-semibold` (section titles, labels)
- **Medium**: `font-medium` (body text emphasis)

---

## Spacing System

### Responsive Padding
- **Containers**: `px-4 sm:px-6 md:px-8` (mobile-first)
- **Cards**: `p-6 sm:p-8`
- **Fields**: `px-3 sm:px-4 py-2.5 sm:py-3`
- **Compact**: `p-3.5` or `px-2 py-1`

### Gaps & Margins
- **Section Gap**: `gap-4 sm:gap-6`
- **Form Fields**: `space-y-4` (vertical stacking)
- **Group Spacing**: `mt-5 sm:mt-6` (section separation)

---

## Animation System

### Keyframe Animations
All animations use custom Tailwind animations (defined in `@theme` in `tailwind.css`)

#### `fadeIn` Animation
```css
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
```
- **Usage**: `animate-[fadeIn_0.2s_ease]` to `animate-[fadeIn_0.3s_ease]`
- **Duration**: 0.2s - 0.3s
- **Use case**: Backdrop, page transitions

#### `slideUp` Animation
```css
@keyframes slideUp {
  from { 
    opacity: 0; 
    transform: translateY(20px); 
  }
  to { 
    opacity: 1; 
    transform: translateY(0); 
  }
}
```
- **Usage**: `animate-[slideUp_Xs_ease]` where X varies
- **Staggered Duration Pattern**:
  - Header: `0.4s` - `0.5s`
  - Login form fields: `0.5s` → `0.6s` → `0.7s` (0.1s increments)
  - Sign up form: `0.5s` → `1.1s` (cascading)
  - Toggle/Footer: `1.2s` → `1.3s`
- **Use case**: Component entry, form fields, buttons

### Transition Durations
- **Standard**: `transition-all duration-200`
- **Quick**: `transition-colors duration-200`
- **Hover Effects**: `transition-transform`, `transition-colors`

---

## Component Styling Patterns

### Modal/Dialog Pattern
```html
<!-- Backdrop -->
<div class="fixed inset-0 z-[999] animate-[fadeIn_0.2s_ease] bg-black/50"></div>

<!-- Modal Container -->
<div class="fixed top-1/2 left-1/2 z-[1000] w-[85%] max-w-sm 
            -translate-x-1/2 -translate-y-1/2 animate-[slideUp_0.3s_ease]">
  
  <!-- Modal Content -->
  <div class="rounded-2xl bg-[#111111] border border-white/7 
              p-6 sm:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
    <!-- Content here -->
  </div>
</div>
```

**Key Properties:**
- Backdrop: Fixed, full-screen, semi-transparent black with fadeIn animation
- Modal width: `w-[85%] max-w-sm` (mobile-responsive)
- Centered: `fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2`
- Animation: slideUp at 0.3s
- Z-index: Backdrop 999, Modal 1000

### Form Input Pattern
```html
<input 
  class="w-full bg-[#0a0a0a] border border-white/10 rounded-lg 
         px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-[14px] 
         text-[#f2f2f2] placeholder-[#555555] outline-none 
         transition-all duration-200 
         focus:border-[#ef233c] focus:ring-2 focus:ring-[#ef233c]/20 
         focus:scale-[1.02]"
/>
```

**Key Properties:**
- Background: `bg-[#0a0a0a]`
- Border: `border border-white/10` (subtle)
- Focus border: `focus:border-[#ef233c]` (red accent)
- Focus ring: `focus:ring-2 focus:ring-[#ef233c]/20` (glow effect)
- Focus scale: `focus:scale-[1.02]` (slight zoom for feedback)

### Button Pattern

#### Primary Button (CTA)
```html
<button 
  class="w-full bg-[#ef233c] hover:bg-[#d41f2f] text-white 
         font-bold text-xs sm:text-[14px] uppercase tracking-wider 
         py-2.5 sm:py-3 rounded-lg transition-all duration-200 
         hover:shadow-[0_0_20px_rgba(239,35,60,0.4)] 
         active:scale-95 
         disabled:opacity-60 disabled:cursor-not-allowed 
         flex items-center justify-center gap-2">
  Sign In
</button>
```

**Key Properties:**
- Background: `bg-[#ef233c]` (red)
- Hover darker: `hover:bg-[#d41f2f]`
- Hover glow: `hover:shadow-[0_0_20px_rgba(239,35,60,0.4)]`
- Active press: `active:scale-95`
- Disabled: `disabled:opacity-60`

#### Secondary Button
```html
<button 
  class="border border-white/10 hover:border-white/20 
         text-[#f2f2f2] hover:text-white hover:bg-white/5 
         font-semibold text-xs sm:text-[13px] uppercase 
         py-2 sm:py-2.5 rounded-lg 
         transition-all duration-200 bg-transparent">
  Create Account
</button>
```

**Key Properties:**
- Background: `bg-transparent`
- Border: `border border-white/10`
- Hover: Slightly lighter border and background

### Card Pattern
```html
<div class="rounded-2xl bg-[#111111] border border-white/7 
            p-6 sm:p-8 
            shadow-[0_20px_60px_rgba(0,0,0,0.5)] 
            hover:border-white/15 transition-colors">
  <!-- Card content -->
</div>
```

**Key Properties:**
- Background: `bg-[#111111]`
- Border: `border-white/7` → `hover:border-white/15`
- Border radius: `rounded-2xl`
- Shadow: Dark, large shadow for depth
- Hover effect: Border slightly lighter

---

## Responsive Design Strategy

### Mobile-First Approach
All components use `sm:` breakpoint for tablet/desktop enhancements.

### Common Responsive Patterns

#### Width Responsive
```html
<!-- Full width on mobile, narrower on desktop -->
<div class="w-[85%] max-w-sm sm:w-[90%] md:max-w-[380px]">
```

#### Padding Responsive
```html
<!-- Tighter on mobile, spacious on desktop -->
<div class="px-4 sm:px-6 md:px-8 py-4 sm:py-6">
```

#### Text Responsive
```html
<!-- Smaller on mobile, readable on desktop -->
<h3 class="text-xl sm:text-2xl"> <!-- or text-sm sm:text-[14px] -->
```

#### Grid Responsive
```html
<!-- 1 column mobile, 2-4 columns desktop -->
<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
```

### Breakpoints
- **Default (Mobile)**: No prefix, base styles
- **Tablet+**: `sm:` prefix (640px+)
- **Desktop**: `md:` prefix (768px+)
- **Large Desktop**: `lg:` prefix (1024px+)

---

## Interactive States

### Hover States
```html
<!-- Button hover -->
hover:bg-[#d41f2f] hover:shadow-[0_0_20px_rgba(239,35,60,0.4)]

<!-- Border hover -->
hover:border-white/15 hover:border-white/20

<!-- Text hover -->
hover:text-white hover:text-[#f2f2f2]

<!-- Icon hover -->
group-hover:scale-110 group-hover:opacity-100
```

### Focus States
```html
<!-- Input focus -->
focus:border-[#ef233c] focus:ring-2 focus:ring-[#ef233c]/20 focus:scale-[1.02]

<!-- Button focus (via ring) -->
focus:ring-2 focus:ring-[#ef233c]/30
```

### Active States
```html
<!-- Button press -->
active:scale-95

<!-- Menu active (router) -->
routerLinkActive="text-white"
```

### Disabled States
```html
<!-- Button disabled -->
disabled:opacity-60 disabled:cursor-not-allowed

<!-- Form disabled -->
disabled:bg-[#0a0a0a]/50 disabled:text-[#555555]
```

---

## Layout Patterns

### Header Layout
- Fixed position at top
- Left sidebar spacing: `left-[220px]`
- Z-index: `z-40`
- Backdrop blur: `backdrop-blur-md`
- Border: `border-b border-white/7`

### Container Layout
```html
<div class="min-h-screen bg-[#0a0a0a]">
  <div class="mx-auto max-w-[1200px] px-4 sm:px-6 md:px-8">
    <!-- Content -->
  </div>
</div>
```

### Flex Gap System
```html
<!-- Horizontal gap -->
<div class="flex items-center gap-4">

<!-- Vertical gap -->
<div class="flex flex-col gap-3 sm:gap-4">

<!-- Grid gap -->
<div class="grid grid-cols-2 gap-2 sm:gap-3">
```

---

## Shadows & Effects

### Standard Shadow
```css
shadow-[0_20px_60px_rgba(0,0,0,0.5)]
```
Used for modals, cards, dropdowns.

### Glow Effect (Buttons)
```css
hover:shadow-[0_0_20px_rgba(239,35,60,0.4)]
```
Red glow on red buttons during hover.

### Subtle Shadow
```css
shadow-sm
```
Used for dropdown menus, small cards.

### No Shadow (Transparent)
```css
shadow-none
```

---

## Scrolling & Overflow

### Scrollable Areas
```html
<div class="max-h-[60vh] overflow-y-auto">
  <!-- Scrollable content -->
</div>
```

### Scrollbar Styling
- Default browser scrollbar (dark theme compatible)
- Parent should have dark background

---

## Icon Usage

### Icon Library
- **Library**: Iconify with lucide icons
- **Sizing**: `w-4 h-4` to `w-8 h-8` depending on context
- **Color**: Inherits text color, can override with `text-[#ef233c]`

```html
<iconify-icon icon="lucide:bell" class="w-5 h-5"></iconify-icon>
<iconify-icon icon="lucide:zap" class="w-4 h-4"></iconify-icon>
<iconify-icon icon="lucide:x" class="w-3.5 h-3.5"></iconify-icon>
```

---

## Accessibility Patterns

### Focus Management
- All interactive elements have visible focus states
- Focus ring: `focus:ring-2 focus:ring-[#ef233c]/20`
- Focus border: `focus:border-[#ef233c]`

### Semantic HTML
- Use `<button>` for clickable elements
- Use `<input>` for form fields
- Use `<label>` with proper `for` attributes
- Use `aria-label` for icon-only buttons

### Title Attributes
```html
<button title="Delete notification">
  <iconify-icon icon="lucide:x"></iconify-icon>
</button>
```

---

## Z-Index System

```
1000      - Highest priority modals
999       - Modal backdrops
40-50     - Header, fixed navigation
20-30     - Dropdowns, overlays
10-19     - Cards, elevated elements
0-9       - Base elements
```

---

## Common Component Examples

### Page Header Section
```html
<div class="mb-8">
  <h1 class="m-0 mb-2 text-2xl font-bold text-[#f2f2f2]">Page Title</h1>
  <p class="m-0 text-[14px] text-[#555555]">Subtitle or description</p>
</div>
```

### Stat Card
```html
<div class="rounded-xl bg-[#111111] border border-white/7 p-6 
            hover:border-white/15 transition-colors">
  <div class="text-[12px] text-[#555555] uppercase tracking-wider mb-2">
    Label
  </div>
  <div class="text-3xl font-bold text-[#f2f2f2]">
    Value
  </div>
  <div class="text-[12px] text-[#00d68f] mt-2">
    +12.5% change
  </div>
</div>
```

### Notification Item
```html
<div class="flex items-start gap-3 p-4 border-b border-white/5 last:border-none 
            hover:bg-white/[0.02] transition-colors">
  <div class="w-8 h-8 rounded-full bg-[#ef233c]/10 text-[#ef233c] 
              flex items-center justify-center border border-[#ef233c]/20">
    <iconify-icon icon="lucide:zap" class="w-4 h-4"></iconify-icon>
  </div>
  <div class="flex-1">
    <h4 class="m-0 font-bold text-[#f2f2f2] text-[13px]">Title</h4>
    <span class="text-[10px] text-[#555555]">Timestamp</span>
  </div>
</div>
```

---

## Tailwind Configuration Reference

### Custom Theme (used in @theme)
```javascript
{
  colors: {
    'color-bg-light': '#f5f5f5',  // Light mode fallback
  },
  fontFamily: {
    display: ['var(--font-display)', 'sans-serif'],
  },
  animation: {
    'fadeIn': 'fadeIn 0.2s ease forwards',
    'slideUp': 'slideUp 0.3s ease forwards',
    'slideDown': 'slideDown 0.2s ease forwards',
  }
}
```

---

## Dark Mode Implementation

- No Tailwind dark mode toggle needed
- All classes hardcoded for dark theme
- Colors are absolute values, not relative
- Light text on dark backgrounds
- Subtle white overlays for depth

---

## Future Design Enhancements

- Add `transition-opacity duration-300` for fade transitions
- Implement skeleton loaders matching card dimensions
- Add toast/notification animations
- Create component library with reusable patterns
- Document spacing scale (4px base unit)
- Add typography scale ratios (1.125 ratio: 12, 14, 16, 18, 20, 24, 28, 32)

---

## Quick Reference Cheat Sheet

```
DARK COLORS:
- bg: #0a0a0a (main), #111111 (cards)
- text: #f2f2f2 (primary), #555555 (secondary), #888888 (muted)
- accent: #ef233c (red), #00d68f (green)
- border: border-white/7 to border-white/20

RESPONSIVE:
- px-4 sm:px-6 md:px-8
- text-sm sm:text-[14px]
- max-w-sm sm:max-w-[420px]
- grid-cols-1 sm:grid-cols-2 lg:grid-cols-4

ANIMATIONS:
- fadeIn: 0.2s - 0.3s (backdrops)
- slideUp: 0.3s - 1.3s (cascading elements, 0.1s increments)
- duration-200: standard transitions

STATES:
- hover: lighter color, glow shadow, scale up
- focus: red border, red ring, scale 1.02
- active: scale 0.95
- disabled: opacity-60, grayscale

SPACING:
- gap-4 sm:gap-6 (flex/grid)
- space-y-4 (flex-col)
- p-6 sm:p-8 (cards)
- mt-5 sm:mt-6 (sections)
```
