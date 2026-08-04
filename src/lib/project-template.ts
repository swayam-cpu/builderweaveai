// Scaffold files for a Vite + React + React Router project that runs inside WebContainer.
// The AI only generates files under src/ (pages, components, styles); everything else is fixed.

export const WEBCONTAINER_CLIENT_ID = "wc_api_swayambarnwal531_90b0c5170d12590fc2d710072c987c2f";

export type ProjectFiles = Record<string, string>;

export const SCAFFOLD: ProjectFiles = {
  "package.json": JSON.stringify(
    {
      name: "weave-app",
      private: true,
      type: "module",
      scripts: {
        dev: "vite --port 3000 --host",
        build: "vite build",
      },
      dependencies: {
        react: "^18.3.1",
        "react-dom": "^18.3.1",
        "react-router-dom": "^6.26.2",
      },
      devDependencies: {
        "@vitejs/plugin-react": "^4.3.1",
        vite: "^5.4.8",
      },
    },
    null,
    2,
  ),
  "vite.config.js": `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  server: { host: true, port: 3000 },
});
`,
  "index.html": `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Weave App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`,
  "src/main.jsx": `import React from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App.jsx";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
);
`,
};

/** Files the AI must not overwrite. */
const LOCKED = new Set(["package.json", "vite.config.js", "src/main.jsx"]);

export function mergeProject(aiFiles: ProjectFiles): ProjectFiles {
  const out: ProjectFiles = { ...SCAFFOLD };
  for (const [path, content] of Object.entries(aiFiles)) {
    const clean = path.replace(/^\.?\//, "");
    if (LOCKED.has(clean)) continue;
    out[clean] = content;
  }
  if (!out["src/styles.css"]) out["src/styles.css"] = "*{box-sizing:border-box}body{margin:0}";
  return out;
}

/** Convert a flat path->content map into WebContainer's nested FileSystemTree. */
export function toFileSystemTree(files: ProjectFiles): Record<string, unknown> {
  const tree: Record<string, any> = {};
  for (const [path, contents] of Object.entries(files)) {
    const parts = path.split("/").filter(Boolean);
    let node = tree;
    parts.forEach((part, i) => {
      if (i === parts.length - 1) {
        node[part] = { file: { contents } };
      } else {
        node[part] = node[part] ?? { directory: {} };
        node = node[part].directory;
      }
    });
  }
  return tree;
}
