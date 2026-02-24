import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1]
const isGitHubPagesBuild = process.env.GITHUB_ACTIONS === 'true'

export default defineConfig({
  base: isGitHubPagesBuild && repositoryName ? `/${repositoryName}/` : '/',
  plugins: [react()],
  server: {
    host: true,
    allowedHosts: ['.trycloudflare.com', 'localhost', '127.0.0.1']
  }
})
