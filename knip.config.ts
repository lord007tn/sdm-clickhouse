const config = {
  entry: ["index.html", "src-tauri/src/main.rs"],
  project: [
    "src/**/*.{ts,tsx}",
    "src-tauri/src/**/*.rs",
    "src-tauri/Cargo.toml",
    "src-tauri/tauri.conf.json",
  ],
  ignore: ["src/components/ui/**", "src/hooks/use-mobile.ts"],
  ignoreDependencies: [
    "cmdk",
    "date-fns",
    "embla-carousel-react",
    "input-otp",
    "next-themes",
    "react-day-picker",
    "react-resizable-panels",
    "recharts",
    "tailwindcss",
    "vaul",
  ],
  ignoreExportsUsedInFile: true,
  ignoreIssues: {
    "src/components/ui/**": ["exports"],
  },
};

export default config;
