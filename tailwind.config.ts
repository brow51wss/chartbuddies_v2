import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // AppHeader is z-app-header so MAR sticky chrome stays beneath it.
      // All full-screen dialogs / scrims must use z-modal (above the header).
      zIndex: {
        'app-header': '10000001',
        'app-header-dropdown': '10000002',
        modal: '10100000',
      },
      colors: {
        'lasso-navy': '#142F61',
        'lasso-teal': '#00799E',
        'lasso-blue': '#00B6E2',
        'lasso-gray': '#5B5B5B',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
}
export default config
