const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const Jimp = require("jimp-compact");

async function main() {
  const source = await Jimp.read("assets/brand/on-source.png");
  const background = Jimp.intToRGBA(source.getPixelColor(0, 0));
  const mark = source.clone();
  let left = source.bitmap.width,
    top = source.bitmap.height,
    right = -1,
    bottom = -1;
  mark.scan(
    0,
    0,
    mark.bitmap.width,
    mark.bitmap.height,
    function (x, y, index) {
      const gray = this.bitmap.data[index];
      const alpha = Math.round(
        this.bitmap.data[index + 3] *
          Math.max(0, (background.r - gray) / background.r),
      );
      this.bitmap.data[index] =
        this.bitmap.data[index + 1] =
        this.bitmap.data[index + 2] =
          0;
      this.bitmap.data[index + 3] = alpha;
      if (alpha > 2) {
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
    },
  );
  assert.equal(
    Jimp.intToRGBA(mark.getPixelColor(0, mark.bitmap.height - 1)).a,
    0,
    "The source transparent border must remain transparent.",
  );
  assert.ok(
    right >= left && bottom >= top,
    "The supplied image must contain a visible mark.",
  );
  mark.crop(left, top, right - left + 1, bottom - top + 1);
  function centered(size, width, color, backdrop = 0x00000000) {
    const scaled = mark.clone().resize(width, Jimp.AUTO, Jimp.RESIZE_BICUBIC);
    const ink = Jimp.intToRGBA(color);
    scaled.scan(
      0,
      0,
      scaled.bitmap.width,
      scaled.bitmap.height,
      function (_x, _y, i) {
        this.bitmap.data[i] = ink.r;
        this.bitmap.data[i + 1] = ink.g;
        this.bitmap.data[i + 2] = ink.b;
      },
    );
    return new Jimp(size, size, backdrop).composite(
      scaled,
      Math.round((size - scaled.bitmap.width) / 2),
      Math.round((size - scaled.bitmap.height) / 2),
    );
  }
  assert.ok(
    Math.hypot(490, (490 * mark.bitmap.height) / mark.bitmap.width) <=
      (1024 * 2) / 3,
    "The launcher mark must fit the circular adaptive safe zone.",
  );
  const icon = centered(1024, 490, 0x000000ff, 0xd9d9d9ff);
  const foreground = centered(1024, 490, 0x000000ff);
  const monochrome = centered(1024, 490, 0xffffffff);
  const splash = centered(1024, 700, 0x000000ff);
  const splashDark = centered(1024, 700, 0xedeee6ff);
  for (const [name, asset] of Object.entries({
    "offday-icon": icon,
    "offday-foreground": foreground,
    "offday-monochrome": monochrome,
    "offday-splash": splash,
    "offday-splash-dark": splashDark,
  })) {
    assert.equal(asset.bitmap.width, 1024);
    assert.equal(asset.bitmap.height, 1024);
    await asset.writeAsync(`assets/images/${name}.png`);
  }
  assert.equal(Jimp.intToRGBA(icon.getPixelColor(0, 0)).a, 255);
  assert.equal(Jimp.intToRGBA(foreground.getPixelColor(0, 0)).a, 0);
  await icon
    .clone()
    .resize(64, 64, Jimp.RESIZE_BICUBIC)
    .writeAsync("assets/images/offday-favicon.png");
  const lightPreview = new Jimp(480, 960, 0xf8f6f0ff).composite(
    splash.clone().resize(180, 180),
    150,
    390,
  );
  const darkPreview = new Jimp(480, 960, 0x20231fff).composite(
    splashDark.clone().resize(180, 180),
    150,
    390,
  );
  await new Jimp(960, 960, 0xf8f6f0ff)
    .composite(lightPreview, 0, 0)
    .composite(darkPreview, 480, 0)
    .writeAsync("assets/brand/splash-preview.png");
  const png = (await fs.readFile("assets/brand/on-source.png")).toString(
    "base64",
  );
  await fs.writeFile(
    "assets/brand/mark.svg",
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 201 205"><image width="201" height="205" href="data:image/png;base64,${png}"/></svg>\n`,
  );
  console.log(
    "Prepared ON launcher, adaptive/monochrome, light/dark splash and favicon assets.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
