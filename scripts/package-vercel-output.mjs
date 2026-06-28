import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const distDir = join(root, "dist");
const outDir = join(root, ".vercel", "output");
const serverDir = join(distDir, "server");
const clientDir = join(distDir, "client");
const clientAssetsDir = join(clientDir, "assets");
const serverFuncDir = join(outDir, "functions", "__server.func");
const staticDir = join(outDir, "static");
const DEV_CLIENT_ENTRY = "/@id/virtual:tanstack-start-dev-client-entry";

function findClientEntryAsset() {
  const candidates = readdirSync(clientAssetsDir)
    .filter((name) => /^index-.*\.js$/.test(name))
    .map((name) => ({
      name,
      size: statSync(join(clientAssetsDir, name)).size,
    }))
    .sort((a, b) => b.size - a.size);

  if (!candidates.length) {
    throw new Error(
      `Could not find built client entry asset in ${clientAssetsDir}`,
    );
  }

  return `/assets/${candidates[0].name}`;
}

function patchStartManifestClientEntry(filePath, clientEntry) {
  if (!existsSync(filePath)) return false;

  const original = readFileSync(filePath, "utf8");
  if (!original.includes(DEV_CLIENT_ENTRY)) return false;

  const patched = original.replaceAll(DEV_CLIENT_ENTRY, clientEntry);
  writeFileSync(filePath, patched);
  return true;
}

if (!existsSync(distDir) || !existsSync(serverDir) || !existsSync(clientDir)) {
  throw new Error(
    "Expected dist/server and dist/client to exist before packaging Vercel output",
  );
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(serverFuncDir, { recursive: true });
mkdirSync(staticDir, { recursive: true });

cpSync(clientDir, staticDir, { recursive: true });
cpSync(serverDir, serverFuncDir, { recursive: true });

const clientEntry = findClientEntryAsset();
const patchedDistManifest = patchStartManifestClientEntry(
  join(serverDir, "_tanstack-start-manifest_v.mjs"),
  clientEntry,
);
const patchedOutputManifest = patchStartManifestClientEntry(
  join(serverFuncDir, "_tanstack-start-manifest_v.mjs"),
  clientEntry,
);

const vcConfigPath = join(serverDir, ".vc-config.json");
const rootConfigPath = join(distDir, "config.json");

if (!existsSync(vcConfigPath) || !existsSync(rootConfigPath)) {
  throw new Error("Missing dist/server/.vc-config.json or dist/config.json");
}

const vcConfig = JSON.parse(readFileSync(vcConfigPath, "utf8"));
const rootConfig = JSON.parse(readFileSync(rootConfigPath, "utf8"));

writeFileSync(
  join(serverFuncDir, ".vc-config.json"),
  JSON.stringify(vcConfig, null, 2),
);
writeFileSync(join(outDir, "config.json"), JSON.stringify(rootConfig, null, 2));

const routesManifestPath = join(outDir, "routes.json");
writeFileSync(
  routesManifestPath,
  JSON.stringify(rootConfig.routes ?? [], null, 2),
);

console.log("Packaged .vercel/output from dist/");
console.log(
  JSON.stringify(
    {
      outDir,
      staticDir,
      serverFuncDir,
      handler: vcConfig.handler,
      runtime: vcConfig.runtime,
      clientEntry,
      patchedDistManifest,
      patchedOutputManifest,
    },
    null,
    2,
  ),
);
