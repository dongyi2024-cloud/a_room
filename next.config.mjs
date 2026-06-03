/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    outputFileTracingIncludes: {
      "/api/ai/*": ["./virginia-woolf-perspective/SKILL.md"]
    }
  }
};

export default nextConfig;
