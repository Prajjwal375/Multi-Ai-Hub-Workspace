/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,html}', './index.html'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        "blue-custom": "#3b82f6",
        "error-container": "#ffdad6",
        "on-tertiary": "#ffffff",
        "surface-container-lowest": "#ffffff",
        "primary-fixed-dim": "#adc6ff",
        "on-primary-container": "#fefcff",
        "on-background": "#131b2e",
        "on-tertiary-fixed-variant": "#3f484d",
        "surface-container-high": "#e2e7ff",
        "on-primary-fixed": "#001a42",
        "primary-fixed": "#d8e2ff",
        "surface-bright": "#faf8ff",
        "on-error-container": "#93000a",
        "surface-variant": "#dae2fd",
        "tertiary": "#545d62",
        "tertiary-fixed-dim": "#bfc8ce",
        "primary-container": "#2170e4",
        "on-secondary-fixed": "#001d35",
        "on-primary": "#ffffff",
        "on-primary-fixed-variant": "#004395",
        "inverse-on-surface": "#eef0ff",
        "surface-container-low": "#f2f3ff",
        "tertiary-container": "#6d767b",
        "surface-container-highest": "#dae2fd",
        "inverse-primary": "#adc6ff",
        "surface-container": "#eaedff",
        "secondary-fixed-dim": "#adc9eb",
        "background": "#faf8ff",
        "secondary-container": "#c1dcff",
        "on-secondary": "#ffffff",
        "inverse-surface": "#283044",
        "on-tertiary-fixed": "#141d21",
        "on-tertiary-container": "#fbfdff",
        "primary": "#0058be",
        "surface": "#faf8ff",
        "on-surface": "#131b2e",
        "tertiary-fixed": "#dbe4ea",
        "surface-tint": "#005ac2",
        "outline-variant": "#c2c6d6",
        "error": "#ba1a1a",
        "secondary": "#45607e",
        "surface-dim": "#d2d9f4",
        "on-secondary-fixed-variant": "#2d4965",
        "outline": "#727785",
        "on-secondary-container": "#46617f",
        "on-surface-variant": "#424754",
        "on-error": "#ffffff",
        "secondary-fixed": "#d0e4ff"
      },
      borderRadius: {
        "DEFAULT": "0.25rem",
        "lg": "0.5rem",
        "xl": "0.75rem",
        "full": "9999px"
      },
      spacing: {
        "section-gap": "40px",
        "unit": "4px",
        "gutter": "16px",
        "container-padding": "24px"
      },
      fontFamily: {
        "body-md": ["Inter"],
        "label-sm": ["Inter"],
        "display-lg": ["Inter"],
        "body-lg": ["Inter"],
        "headline-md": ["Inter"],
        "headline-lg": ["Inter"],
        "label-md": ["Inter"],
        "sans": ["Inter", "sans-serif"]
      },
      fontSize: {
        "body-md": ["16px", {"lineHeight": "24px", "fontWeight": "400"}],
        "label-sm": ["12px", {"lineHeight": "16px", "fontWeight": "500"}],
        "display-lg": ["48px", {"lineHeight": "56px", "letterSpacing": "-0.02em", "fontWeight": "700"}],
        "body-lg": ["18px", {"lineHeight": "28px", "fontWeight": "400"}],
        "headline-md": ["24px", {"lineHeight": "32px", "fontWeight": "600"}],
        "headline-lg": ["32px", {"lineHeight": "40px", "letterSpacing": "-0.01em", "fontWeight": "600"}],
        "label-md": ["14px", {"lineHeight": "20px", "letterSpacing": "0.01em", "fontWeight": "500"}]
      },
      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' }
        }
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.5s ease-out forwards',
        float: 'float 6s ease-in-out infinite'
      }
    }
  },
  plugins: [
    require('@tailwindcss/forms')
  ]
}
