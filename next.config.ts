import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 明示的にWebpackを使用するように指定
  // Turbopackはディレクトリ名に日本語が含まれる場合にエラーを起こす
};

export default nextConfig;
