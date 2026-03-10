/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    eslint: {
        ignoreDuringBuilds: true,
    },
    typescript: {
        ignoreBuildErrors: true,
    },
    output: "standalone",
    async rewrites() {
        const apiInternalUrl = (process.env.API_INTERNAL_URL || "http://api:8000").replace(/\/+$/, "");
        return [
            {
                // Keep Auth.js handlers on /api/auth local to Next.js.
                source: "/api/:path((?!auth(?:/|$)).*)",
                destination: `${apiInternalUrl}/api/:path`,
            },
        ];
    },
    async headers() {
        return [
            {
                source: "/(.*)",
                headers: [
                    { key: "X-Content-Type-Options", value: "nosniff" },
                    { key: "X-Frame-Options", value: "SAMEORIGIN" },
                    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
                ],
            },
        ];
    },
};

module.exports = nextConfig;
