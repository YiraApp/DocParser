/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
 distDir: "build", //add this
 output: "standalone", //add this
  // Ensure proper React handling
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  // Allow API calls over HTTP in development only
  headers: async () => {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
