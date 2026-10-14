const { withAndroidStyles, withDangerousMod } = require("expo/config-plugins");
const { mkdir, writeFile } = require("node:fs/promises");
const path = require("node:path");
// Code-native monoline lettering: Offday Note, inside Android's 200×80dp branding area.
const strokes =
  "M10,0 C-3,0 -3,20 10,20 C23,20 23,0 10,0 M26,20 V5 Q26,0 32,0 M22,7 H31 M38,20 V5 Q38,0 44,0 M34,7 H43 M57,0 V20 M57,9 C43,0 43,27 57,18 M73,7 V20 M73,9 C59,0 59,27 73,18 M79,7 L85,20 M92,7 L84,27 M104,20 V0 L119,20 V0 M131,7 C118,7 118,20 131,20 C144,20 144,7 131,7 M149,2 V16 Q149,20 154,20 M144,7 H154 M160,13 H173 C173,4 159,4 159,13 C159,21 169,22 173,18";
const drawable = `<?xml version="1.0" encoding="utf-8"?><vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="200dp" android:height="80dp" android:viewportWidth="200" android:viewportHeight="80"><group android:translateX="14" android:translateY="26"><path android:pathData="${strokes}" android:fillColor="@android:color/transparent" android:strokeColor="@color/offday_brand_text" android:strokeWidth="1.2" android:strokeLineCap="round" android:strokeLineJoin="round"/></group></vector>`;
module.exports = function withSplashWordmark(config) {
  config = withAndroidStyles(config, (config) => {
    const splash = config.modResults.resources.style?.find(
      (style) => style.$.name === "Theme.App.SplashScreen",
    );
    if (!splash)
      throw new Error(
        "The Expo splash theme must be configured before the Offday wordmark.",
      );
    splash.item = (splash.item ?? []).filter(
      (item) => item.$.name !== "android:windowSplashScreenBrandingImage",
    );
    splash.item.push({
      $: { name: "android:windowSplashScreenBrandingImage" },
      _: "@drawable/offday_branding",
    });
    return config;
  });
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const root = path.join(
        config.modRequest.platformProjectRoot,
        "app/src/main/res",
      );
      for (const [folder, contents] of [
        ["drawable", drawable],
        [
          "values",
          '<resources><color name="offday_brand_text">#242823</color></resources>',
        ],
        [
          "values-night",
          '<resources><color name="offday_brand_text">#EDEEE6</color></resources>',
        ],
      ]) {
        await mkdir(path.join(root, folder), { recursive: true });
        await writeFile(
          path.join(
            root,
            folder,
            folder === "drawable"
              ? "offday_branding.xml"
              : "offday-branding-colors.xml",
          ),
          contents,
        );
      }
      return config;
    },
  ]);
};
