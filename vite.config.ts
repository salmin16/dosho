import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'

const config = defineConfig(async () => {
  const netlifyPlugins = process.env.NETLIFY
    ? [(await import('@netlify/vite-plugin-tanstack-start')).default()]
    : []

  return {
    plugins: [
      viteTsConfigPaths({
        projects: ['./tsconfig.json'],
      }),
      tailwindcss(),
      ...netlifyPlugins,
      tanstackStart(),
      viteReact(),
    ],
  }
})

export default config
