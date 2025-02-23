/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true
  },
  assetPrefix: process.env.NODE_ENV === 'production' ? 'http://localhost' : '',
  basePath: '',
  distDir: 'out',
  trailingSlash: true,
}

module.exports = nextConfig 