import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JSDOM } from "jsdom";
const require = createRequire(import.meta.url);
test("splash branding composes with Expo, preserves its theme and regenerates resources idempotently", async () => {
  const custom = require("../plugins/with-splash-wordmark.cjs");
  const splash = require("expo-splash-screen/app.plugin.js").default;
  const config = splash(
    custom({
      name: "Offday Note",
      slug: "offday-note",
      _internal: { projectRoot: process.cwd() },
    }),
    {
      backgroundColor: "#F8F6F0",
      image: "./assets/images/offday-splash.png",
      imageWidth: 180,
    },
  );
  const dir = await mkdtemp(join(tmpdir(), "offday-branding-"));
  const request = {
    projectRoot: process.cwd(),
    platformProjectRoot: dir,
    platform: "android",
    modName: "styles",
  };
  try {
    let result = await config.mods.android.styles({
      ...config,
      modResults: { resources: { style: [] } },
      modRequest: request,
    });
    result = await config.mods.android.styles({
      ...result,
      modRequest: request,
    });
    const theme = result.modResults.resources.style.find(
      (style: any) => style.$.name === "Theme.App.SplashScreen",
    );
    assert.ok(
      theme.item.some(
        (item: any) => item.$.name === "windowSplashScreenAnimatedIcon",
      ),
    );
    assert.equal(
      theme.item.filter(
        (item: any) =>
          item.$.name === "android:windowSplashScreenBrandingImage",
      ).length,
      1,
    );
    await config.mods.android.dangerous({
      ...config,
      modRequest: { ...request, modName: "dangerous" },
    });
    const root = join(dir, "app/src/main/res");
    for (const file of [
      "drawable/offday_branding.xml",
      "values/offday-branding-colors.xml",
      "values-night/offday-branding-colors.xml",
    ]) {
      const xml = await readFile(join(root, file), "utf8");
      const dom = new JSDOM(xml, { contentType: "application/xml" });
      assert.equal(dom.window.document.querySelector("parsererror"), null);
      dom.window.close();
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
