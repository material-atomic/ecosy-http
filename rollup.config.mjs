import typescript from "@rollup/plugin-typescript";
import terser from "@rollup/plugin-terser";
import path from "path";
import { glob } from "glob";

// Get all TypeScript files in src, excluding test files
const inputFiles = glob.sync("src/**/*.{ts,tsx}", {
  ignore: ["src/**/*.test.{ts,tsx}", "src/**/*.spec.{ts,tsx}", "**/vitest.setup.ts"],
});

// Create input object with file names as keys and paths as values
const input = inputFiles.reduce((acc, file) => {
  const relativePath = path.relative("src", file);
  const key = relativePath.replace(path.extname(relativePath), "");
  acc[key] = file;
  return acc;
}, {});

// Base external packages (none for this utils package)
const external = [  /* tslib must stay external. Bundled with preserveModules, rollup emits its
     path relative to the output root — "./node_modules/tslib/tslib.es6.mjs" —
     which is a path on the machine that built the package and does not exist
     on anyone else's. */
  "tslib",
];

// Minification configuration
const minifyOptions = {
  compress: {
    drop_console: true,
    drop_debugger: true,
    pure_funcs: ["console.log", "console.info", "console.debug"],
  },
  mangle: true,
};

// CommonJS build
const cjsConfig = {
  input,
  external,
  output: {
    dir: "dist",
    format: "cjs",
    entryFileNames: "[name].js",
    chunkFileNames: "[name].js",
    exports: "named",
    preserveModules: true,
    preserveModulesRoot: "src",
    interop: "auto",
  },
  plugins: [
    typescript({
      tsconfig: "./tsconfig.json",
      declaration: true,
      declarationDir: "dist",
      rootDir: "src",
    }),
    terser(minifyOptions),
  ],
};

// ESM build
const esmConfig = {
  input,
  external,
  output: {
    dir: "dist",
    format: "esm",
    entryFileNames: "[name].mjs",
    exports: "named",
    preserveModules: true,
    preserveModulesRoot: "src",
    interop: "auto",
    generatedCode: {
      symbols: true,
    },
  },
  plugins: [
    typescript({
      tsconfig: "./tsconfig.json",
      declaration: false,
      declarationDir: undefined,
      rootDir: "src",
    }),
    terser(minifyOptions),
  ],
};

// UMD build (Standalone for browsers)
const umdConfig = {
  input: "src/index.ts",
  output: {
    file: "dist/ecosy-http.umd.js",
    format: "umd",
    name: "EcosyHttp",
    sourcemap: true,
    exports: "named",
  },
  plugins: [
    typescript({
      tsconfig: "./tsconfig.json",
      declaration: false,
      rootDir: "src",
    }),
    terser(minifyOptions),
  ],
};

export default [cjsConfig, esmConfig, umdConfig];
