// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './views/**/*.ejs',          // EJS templatelar
    './public/**/*.html',        // statik HTML varsa
    './public/**/*.js',          // front-end JS (örn. main.js)
  ],
  theme: {
    extend: {
      colors: {
        gold: '#d4af37',
        olive: {
          DEFAULT: '#556B2F',
          50:  '#f5f8ee',
          100: '#e9f0d7',
          200: '#d2e1af',
          300: '#b4cc82',
          400: '#93b45a',
          500: '#738f3e',
          600: '#5d7332',
          700: '#495a29',
          800: '#394622',
          900: '#2f3a1d',
        },
        ink: '#0b0e14',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'ui-sans-serif', 'Arial'],
        display: ['Space Grotesk', 'Inter', 'system-ui'],
        mono: ['Fira Code', 'ui-monospace', 'SFMono-Regular', 'Menlo'],
      },
      boxShadow: {
        soft: '0 10px 30px rgba(0,0,0,.12)',
      },
      borderRadius: {
        '2xl': '1.25rem',
      },
      container: {
        center: true,
        padding: {
          DEFAULT: '1rem',
          sm: '1.25rem',
          lg: '2rem',
          xl: '2.5rem',
          '2xl': '3rem',
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
    require('@tailwindcss/aspect-ratio'),
    require('@tailwindcss/container-queries'),    
  ],
};
