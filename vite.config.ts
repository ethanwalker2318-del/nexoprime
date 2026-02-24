import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// For GitHub Pages deployment, use the repository name as base path
const getBase = () => {
  // In GitHub Actions
  if (process.env.GITHUB_ACTIONS === 'true') {
    const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1]
    return repositoryName ? `/${repositoryName}/` : '/'
  }
  
  // For local development targeting GitHub Pages
  if (process.env.VITE_BASE) {
    return process.env.VITE_BASE
  }
  
  return '/'
}

export default defineConfig({
  base: getBase(),
  plugins: [react()],
  server: {
    host: true,
    allowedHosts: ['.trycloudflare.com', 'localhost', '127.0.0.1']
  }
})
