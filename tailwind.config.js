/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}", // Adicionei para garantir que pegue seus componentes
    "./*.{js,ts,jsx,tsx}" // Pega arquivos na raiz
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
