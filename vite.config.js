import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate vendor libraries for better caching
          vendor: ['react', 'react-dom'],
          charts: ['recharts'],
          // Group utility functions
          models: [
            './src/utils/poissonModel.js',
            './src/utils/enhancedBettingModel.js',
            './src/utils/advancedSpreadModel.js'
          ],
          // Group data files
          data: [
            './src/data/team-stats-2025.js',
            './src/data/week1-2025-espn-data.js'
          ]
        }
      }
    },
    // Optimize bundle size
    chunkSizeWarningLimit: 1000,
    // Enable source maps for debugging in production (can disable later)
    sourcemap: false,
    // Minify for production
    minify: 'terser',
    terserOptions: {
      compress: {
        // Remove console logs in production
        drop_console: true,
        drop_debugger: true
      }
    }
  },
  // Performance optimizations
  optimizeDeps: {
    include: ['react', 'react-dom', 'recharts']
  },
  // Server configuration for development
  server: {
    port: 5173,
    // Enable gzip compression
    compress: true
  },
  // Preview configuration for production testing
  preview: {
    port: 3000,
    host: true
  }
})
