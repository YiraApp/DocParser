/** @type {import('next').NextConfig} */
const nextConfig = {
    // TypeScript configuration
      reactStrictMode: true,
  distDir: "build",
  output: "standalone",

    typescript: {
        ignoreBuildErrors: true,
    },

    // Image optimization
    images: {
        unoptimized: true,
    },

    // ESLint configuration
    eslint: {
        ignoreDuringBuilds: true,
    },

    // React configuration
    reactStrictMode: true,
    swcMinify: true,

    // Compiler configuration
    compiler: {
        removeConsole: process.env.NODE_ENV === 'production',
    },

    // Security headers
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

export default nextConfig

