import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#17494d',
          deep: '#102f34',
          pine: '#1f6b6f',
          gold: '#e0aa55',
          cream: '#f7efe1',
          blush: '#f5ded2'
        },
        ink: '#122026'
      },
      fontFamily: {
        sans: ['"PingFang SC"', '"Microsoft YaHei"', '"Helvetica Neue"', 'sans-serif'],
        serif: ['"STSong"', '"Songti SC"', '"Noto Serif SC"', 'serif']
      },
      boxShadow: {
        soft: '0 18px 50px rgba(23, 73, 77, 0.08)',
        hero: '0 28px 70px rgba(16, 47, 52, 0.22)',
        float: '0 12px 30px rgba(23, 73, 77, 0.14)'
      },
      borderRadius: {
        '4xl': '2rem'
      },
      keyframes: {
        rise: {
          '0%': { opacity: '0', transform: 'translateY(18px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        }
      },
      animation: {
        rise: 'rise 0.55s ease-out both'
      }
    }
  },
  plugins: []
};

export default config;
