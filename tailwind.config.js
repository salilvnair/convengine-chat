/** @type {import('tailwindcss').Config} */
export default {
  // Scans library source so Tailwind only generates classes actually used
  content: ['./src/**/*.{js,jsx,ts,tsx}'],

  // Honour data-ce-theme="dark" attribute on the root element as the dark mode
  // trigger so the library theme never conflicts with the consumer's dark mode.
  darkMode: ['class', '[data-ce-theme="dark"]'],

  theme: {
    extend: {},
  },

  plugins: [],

  // Prefix all generated utilities with "ce-tw-" when consumers need raw
  // Tailwind classes inside their own project.  For the compiled CSS output we
  // keep the prefix empty because every style is already scoped inside
  // .ce-chat-root via the @apply calls in convengine-chat.css.
  prefix: '',
};
