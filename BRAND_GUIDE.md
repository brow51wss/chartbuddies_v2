# Lasso EHR - Brand Guide & Design System

**Last Updated:** November 25, 2025  
**Purpose:** This document serves as the design system and brand guide for maintaining visual and UX consistency across all Lasso EHR features and pages.

---

## Table of Contents
1. [Color Palette](#color-palette)
2. [Typography](#typography)
3. [Component Patterns](#component-patterns)
4. [Layout & Spacing](#layout--spacing)
5. [Animations & Transitions](#animations--transitions)
6. [Module System](#module-system)
7. [Status Indicators](#status-indicators)
8. [Dark Mode](#dark-mode)
9. [Icon Usage](#icon-usage)
10. [Button Styles](#button-styles)

---

## Color Palette

### Primary Colors
- **Primary Blue:** `blue-600` to `blue-700` (gradient)
- **Primary Indigo:** `indigo-600` (accent)
- **Gradient Combinations:**
  - Primary: `from-blue-600 to-indigo-600` (for main branding)
  - Buttons: `from-blue-600 to-blue-700` with hover `from-blue-700 to-blue-800`

### Module-Specific Colors
Each EHR module has its own color identity:
- **MAR (Medication):** Blue (`from-blue-500 to-blue-600`)
- **Vital Signs:** Green (`from-green-500 to-green-600`)
- **Progress Notes:** Purple (`from-purple-500 to-purple-600`)
- **Admissions:** Indigo (`from-indigo-500 to-indigo-600`)
- **Laboratory:** Orange (`from-orange-500 to-orange-600`)
- **Imaging:** Teal (`from-teal-500 to-teal-600`)

### Status Colors
- **Available/Active:** Green (`text-green-600`, `bg-green-100`)
- **Coming Soon:** Gray (`text-gray-600`, `bg-gray-100`)
- **Error:** Red (`text-red-800`, `bg-red-50`)

### Background Colors
- **Light Mode:**
  - Main: `bg-gray-50` or `bg-white`
  - Cards: `bg-white`
  - Header: `bg-white/80` with backdrop blur
- **Dark Mode:**
  - Main: `bg-gray-900` or `bg-gray-800`
  - Cards: `bg-gray-800`
  - Header: `bg-gray-800/80` with backdrop blur

---

## Typography

### Headings
- **H1 (Main Title):** 
  - Size: `text-3xl`
  - Weight: `font-bold`
  - Style: Gradient text using `bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent`
  - Example: "Lasso EHR"

- **H2 (Section Titles):**
  - Size: `text-2xl`
  - Weight: `font-bold`
  - Color: `text-gray-900 dark:text-white`

- **H3 (Subsection Titles):**
  - Size: `text-xl` or `text-lg`
  - Weight: `font-semibold` or `font-bold`
  - Color: `text-gray-800 dark:text-white`

### Body Text
- **Regular:** `text-sm` or `text-base`
- **Secondary Text:** `text-gray-600 dark:text-gray-400`
- **Muted Text:** `text-gray-500 dark:text-gray-400` or italic variant

### Font Weights
- **Bold:** `font-bold` (headings, important text)
- **Semibold:** `font-semibold` (subheadings, labels)
- **Medium:** `font-medium` (buttons, links)
- **Regular:** Default (body text)

---

## Component Patterns

### Module Cards
Module cards are the primary navigation element for EHR modules.

**Structure:**
```tsx
- Container: rounded-xl, shadow-md, hover:shadow-xl
- Top accent bar: 2px height, gradient background
- Content padding: p-6
- Icon: text-4xl (emoji or icon)
- Status badge: top-right corner
- Title: text-lg font-bold
- Description: text-sm, line-clamp-2
- Action indicator: bottom, with arrow animation
```

**States:**
- **Available:** 
  - Cursor: `cursor-pointer`
  - Hover: `hover:scale-105`, `hover:border-blue-300`
  - Opacity: Full (100%)
- **Coming Soon:**
  - Cursor: `cursor-not-allowed`
  - Opacity: `opacity-75`
  - No hover effects

**Spacing:**
- Grid: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
- Gap: `gap-6`
- Card padding: `p-6`

### Status Badges
Small, rounded badges indicating module or feature status.

**Styles:**
- Size: `px-2 py-1 text-xs font-semibold`
- Shape: `rounded-full`
- Available: `text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30`
- Coming Soon: `text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-700`

### Tables
Used for displaying patient lists and data tables.

**Structure:**
- Container: `rounded-xl shadow-md`, white/dark background
- Header: Gradient background `from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800`
- Header text: `text-xs font-semibold uppercase tracking-wider`
- Rows: Hover effect `hover:bg-gray-50 dark:hover:bg-gray-700/50`
- Borders: `divide-y divide-gray-200 dark:divide-gray-700`
- Padding: `px-6 py-4`

### Empty States
When no data is available, show helpful empty states.

**Structure:**
- Large icon/emoji: `text-6xl mb-4`
- Heading: `text-xl font-semibold`
- Description: `text-gray-600 dark:text-gray-400`
- CTA Button: Primary button style

---

## Layout & Spacing

### Container
- Max width: `max-w-7xl`
- Horizontal padding: `px-4 sm:px-6 lg:px-8`
- Vertical padding: `py-8` (main), `py-4` (header)

### Grid System
- **Mobile:** 1 column (`grid-cols-1`)
- **Tablet:** 2 columns (`md:grid-cols-2`)
- **Desktop:** 3 columns (`lg:grid-cols-3`)

### Spacing Scale
- **Small:** `gap-3`, `space-x-3`, `mb-2`
- **Medium:** `gap-6`, `space-x-4`, `mb-4`, `mb-6`
- **Large:** `gap-8`, `mb-8`, `p-12`

### Header
- Sticky: `sticky top-0 z-10`
- Backdrop blur: `backdrop-blur-sm`
- Border: `border-b border-gray-200 dark:border-gray-700`
- Background: `bg-white/80 dark:bg-gray-800/80`

---

## Animations & Transitions

### Hover Effects
- **Scale:** `hover:scale-105` (module cards)
- **Shadow:** `hover:shadow-xl` (from `shadow-md`)
- **Border:** `hover:border-blue-300 dark:hover:border-blue-600`
- **Duration:** `transition-all duration-300` or `duration-200`

### Arrow Animations
- **Text with arrow:** Arrow moves on hover
  - `group-hover:gap-2` (increases gap)
  - `group-hover:translate-x-1` (moves arrow right)

### Overlay Effects
- **Gradient overlay on hover:** 
  - `bg-gradient-to-br from-blue-500/5 to-indigo-500/5`
  - `opacity-0 group-hover:opacity-100`
  - `transition-opacity duration-300`

### Loading States
- Spinner: `animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600`

---

## Module System

### Module Definition Structure
```typescript
interface EHRModule {
  id: string
  name: string
  description: string
  icon: string  // Emoji or icon identifier
  status: 'available' | 'coming_soon'
  color: string  // Color name for reference
  gradient: string  // Tailwind gradient classes
  route?: string  // Optional route for navigation
}
```

### Module Card Layout
1. **Top Accent Bar:** 2px height, full width, gradient color
2. **Icon:** Large (text-4xl), top-left
3. **Status Badge:** Top-right corner
4. **Title:** Below icon, bold
5. **Description:** Below title, 2-line clamp
6. **Action Indicator:** Bottom, with hover animation

### Module Interaction
- **Available modules:** Clickable, navigate to module view
- **Coming soon modules:** Non-clickable, visual indication only
- **Module views:** Show relevant data (e.g., patient list for MAR)

---

## Status Indicators

### Available Status
- **Color:** Green
- **Text:** "Available"
- **Style:** `text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30`
- **Usage:** Active modules, features, or content

### Coming Soon Status
- **Color:** Gray
- **Text:** "Coming Soon"
- **Style:** `text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-700`
- **Usage:** Future modules, planned features

### Error Status
- **Color:** Red
- **Style:** `bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500`
- **Text:** `text-red-800 dark:text-red-200`

---

## Dark Mode

### Implementation
- Use Tailwind's `dark:` prefix for all dark mode styles
- Always provide both light and dark variants
- Test both modes during development

### Color Mappings
- **Backgrounds:**
  - Light: `bg-white` → Dark: `bg-gray-800`
  - Light: `bg-gray-50` → Dark: `bg-gray-900`
- **Text:**
  - Light: `text-gray-900` → Dark: `text-white`
  - Light: `text-gray-600` → Dark: `text-gray-400`
- **Borders:**
  - Light: `border-gray-200` → Dark: `border-gray-700`

### Backdrop Elements
- Use opacity with backdrop blur: `bg-white/80 dark:bg-gray-800/80`
- Maintain readability in both modes

---

## Icon Usage

### Emoji Icons
- **Size:** `text-4xl` for module cards, `text-6xl` for empty states
- **Usage:** Primary icons for modules (💊, 📊, 📝, 🏥, 🔬, 🩻)
- **Placement:** Top-left of cards, centered in empty states

### Icon Guidelines
- Use emojis for visual appeal and quick recognition
- Ensure emojis are consistent across platforms
- Consider accessibility (provide text alternatives)

---

## Button Styles

### Primary Button
```tsx
className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 text-sm font-medium shadow-md hover:shadow-lg transition-all duration-200"
```
- **Use case:** Main actions (Add Patient, Submit, etc.)
- **States:** Normal, hover (darker gradient, larger shadow)

### Secondary Button
```tsx
className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium transition-colors duration-200"
```
- **Use case:** Secondary actions (Logout, Cancel, etc.)
- **States:** Normal, hover (background change)

### Link Button
```tsx
className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
```
- **Use case:** Navigation links, "View Forms", etc.
- **States:** Normal, hover (color change)

### Button Sizes
- **Small:** `px-4 py-2 text-sm`
- **Medium:** `px-6 py-3` (default)
- **Large:** `px-8 py-4 text-lg`

---

## Design Principles

### 1. Consistency
- Use the same patterns, colors, and spacing throughout
- Maintain visual hierarchy
- Follow established component patterns

### 2. Clarity
- Clear visual feedback for all interactions
- Obvious status indicators
- Intuitive navigation

### 3. Modern Aesthetics
- Gradient accents for visual interest
- Smooth animations and transitions
- Clean, minimal design
- Professional medical application feel

### 4. Accessibility
- Sufficient color contrast
- Clear typography hierarchy
- Keyboard navigation support
- Screen reader friendly

### 5. Responsiveness
- Mobile-first approach
- Breakpoints: `sm:`, `md:`, `lg:`
- Flexible grid layouts
- Touch-friendly targets

---

## Implementation Notes

### Tailwind CSS Classes
- Use utility classes for consistency
- Leverage Tailwind's dark mode support
- Use gradient utilities for modern effects
- Apply transition utilities for smooth animations

### Component Reusability
- Create reusable components following these patterns
- Maintain consistent prop interfaces
- Document component usage

### Future Considerations
- Consider adding a component library (e.g., shadcn/ui) if needed
- Maintain this guide as the design system evolves
- Update when new patterns are established

---

## Quick Reference

### Common Patterns

**Module Card:**
```tsx
<div className="bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-xl transition-all duration-300 border border-gray-200 dark:border-gray-700">
  <div className="h-2 bg-gradient-to-r from-blue-500 to-blue-600" />
  <div className="p-6">
    {/* Content */}
  </div>
</div>
```

**Status Badge:**
```tsx
<span className="px-2 py-1 text-xs font-semibold text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30 rounded-full">
  Available
</span>
```

**Primary Button:**
```tsx
<button className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 font-medium shadow-md hover:shadow-lg transition-all duration-200">
  Action
</button>
```

---

**Remember:** This guide should be referenced when building any new features or pages to ensure visual and UX consistency across the entire Lasso EHR application.

