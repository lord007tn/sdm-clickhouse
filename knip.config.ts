const config = {
  entry: ["index.html", "src-tauri/src/main.rs"],
  project: [
    "src/**/*.{ts,tsx}",
    "src-tauri/src/**/*.rs",
    "src-tauri/Cargo.toml",
    "src-tauri/tauri.conf.json",
  ],
  ignore: [],
  ignoreDependencies: ["@playwright/test"],
  ignoreExportsUsedInFile: true,
  ignoreIssues: {
    "src/components/ui/**": ["exports"],
  },
};

export default config;
