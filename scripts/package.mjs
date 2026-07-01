import { spawn } from "node:child_process";
import { cp, mkdir, readFile, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const folderName = `rtv-shadap-v${pkg.version}`;
const releaseDir = join(root, "release");
const stageRoot = join(releaseDir, ".stage");
const stageDir = join(stageRoot, folderName);
const installZipPath = join(releaseDir, `${folderName}.zip`);
const webstoreZipPath = join(releaseDir, `${folderName}-webstore.zip`);

function run(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: "inherit",
      ...options
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

await run(process.execPath, [join(root, "scripts/build.mjs")]);

await mkdir(releaseDir, { recursive: true });
await rm(stageRoot, { recursive: true, force: true });
await rm(installZipPath, { force: true });
await rm(webstoreZipPath, { force: true });
await mkdir(stageDir, { recursive: true });
await cp(join(root, "dist"), stageDir, { recursive: true });

await run("zip", ["-qr", installZipPath, folderName], { cwd: stageRoot });
await run("zip", ["-qr", webstoreZipPath, "."], { cwd: join(root, "dist") });
await rm(stageRoot, { recursive: true, force: true });

console.log(`Created ${installZipPath}`);
console.log(`Created ${webstoreZipPath}`);
