export async function loadSpriteSheet(atlasPath) {
  const response = await fetch(atlasPath);
  const atlas = await response.json();
  const image = await loadImage(`./${atlas.meta.image}`);

  const orderedFrames = Object.entries(atlas.frames)
    .sort((a, b) => extractFrameNumber(a[0]) - extractFrameNumber(b[0]))
    .map(([, frameData]) => frameData.frame);

  return {
    image,
    frames: orderedFrames,
  };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function extractFrameNumber(frameName) {
  const match = frameName.match(/(\d+)\.aseprite$/);
  return match ? Number(match[1]) : 0;
}
