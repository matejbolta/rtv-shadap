import { build, context } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";

const watch = process.argv.includes("--watch");
const common = {
  bundle: true,
  format: "esm",
  target: "es2022",
  sourcemap: !watch,
  minify: !watch
};

async function copyStatic() {
  await mkdir("dist", { recursive: true });
  await cp("public/manifest.json", "dist/manifest.json");
  await cp("public/icons", "dist/icons", { recursive: true });
  await cp("src/content/content.css", "dist/content.css");
  await cp("src/popup/popup.html", "dist/popup.html");
  await cp("src/popup/popup.css", "dist/popup.css");
}

async function run() {
  if (!watch) {
    await rm("dist", { recursive: true, force: true });
  }
  await copyStatic();
  const entries = [
    { entryPoints: ["src/background/service-worker.ts"], outfile: "dist/service-worker.js" },
    { entryPoints: ["src/content/content-script.ts"], outfile: "dist/content-script.js" },
    { entryPoints: ["src/popup/popup.ts"], outfile: "dist/popup.js" }
  ];
  if (watch) {
    const contexts = await Promise.all(entries.map((entry) => context({ ...common, ...entry })));
    await Promise.all(contexts.map((ctx) => ctx.watch()));
    console.log("Watching extension files...");
  } else {
    await Promise.all(entries.map((entry) => build({ ...common, ...entry })));
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
