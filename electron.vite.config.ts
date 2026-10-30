import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: resolve('electron/main.ts')
      }
    },
    resolve: {
      alias: {
        '@main': resolve('electron')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve('electron/preload.ts'),
          webviewPreload: resolve('electron/webviewPreload.ts'),
          loginPreload: resolve('electron/loginPreload.ts')
        },
        output: {
          entryFileNames: '[name].js'
        }
      }
    }
  },
  renderer: {
    root: '.',
    build: {
      rollupOptions: {
        input: resolve('index.html')
      }
    },
    resolve: {
      alias: {
        '@renderer': resolve('src'),
        '@components': resolve('src/components'),
        '@pages': resolve('src/pages'),
        '@store': resolve('src/store'),
        '@lib': resolve('src/lib')
      }
    },
    plugins: [react()]
  }
})
