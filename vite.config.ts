/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import cabeceras from './seguridad.headers.json'

// Las mismas cabeceras de seguridad que en Vercel (vercel.json), para probarlas con `npm run preview`

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  preview: { headers: cabeceras },
  test: {
    // Las pruebas se ejecutan con la hora de España (como la app), para cazar fallos de zona horaria
    env: { TZ: 'Europe/Madrid' },
    include: ['src/**/*.test.ts'],
  },
})
