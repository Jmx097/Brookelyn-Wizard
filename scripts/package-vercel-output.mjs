import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const root = process.cwd();
const distDir = join(root, "dist");
const outDir = join(root, ".vercel", "output");
const serverDir = join(distDir, "server");
const clientDir = join(distDir, "client");
const serverFuncDir = join(outDir, "functions", "__server.func");
const staticDir = join(outDir, "static");

if (!existsSync(distDir) || !existsSync(serverDir) || !existsSync(clientDir)) {
  throw new Error("Expected dist/server and dist/client to exist before packaging Vercel output");
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(serverFuncDir, { recursive: true });
mkdirSync(staticDir, { recursive: true });

cpSync(clientDir, staticDir, { recursive: true });
cpSync(serverDir, serverFuncDir, { recursive: true });

const vcConfigPath = join(serverDir, ".vc-config.json");
const rootConfigPath = join(distDir, "config.json");

if (!existsSync(vcConfigPath) || !existsSync(rootConfigPath)) {
  throw new Error("Missing dist/server/.vc-config.json or dist/config.json");
}

const vcConfig = JSON.parse(readFileSync(vcConfigPath, "utf8"));
const rootConfig = JSON.parse(readFileSync(rootConfigPath, "utf8"));

writeFileSync(join(serverFuncDir, ".vc-config.json"), JSON.stringify(vcConfig, null, 2));
writeFileSync(join(outDir, "config.json"), JSON.stringify(rootConfig, null, 2));

const routesManifestPath = join(outDir, "routes.json");
writeFileSync(routesManifestPath, JSON.stringify(rootConfig.routes ?? [], null, 2));

console.log("Packaged .vercel/output from dist/");
console.log(JSON.stringify({
  outDir,
  staticDir,
  serverFuncDir,
  handler: vcConfig.handler,
  runtime: vcConfig.runtime,
}, null, 2));
