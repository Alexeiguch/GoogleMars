import { ImageBitmapLoader, SRGBColorSpace, Texture, TextureLoader } from "three";

const bitmapLoader = typeof createImageBitmap === "function"
  ? new ImageBitmapLoader().setOptions({ imageOrientation: "flipY", premultiplyAlpha: "none" })
  : undefined;
const textureLoader = new TextureLoader();

export function loadGlobeTexture(url: string, onLoad: (texture: Texture) => void) {
  const ready = (texture: Texture) => {
    texture.colorSpace = SRGBColorSpace;
    texture.needsUpdate = true;
    onLoad(texture);
  };
  const loadImage = () => textureLoader.load(url, ready);
  if (bitmapLoader) {
    bitmapLoader.load(url, (bitmap) => ready(new Texture(bitmap)), undefined, loadImage);
  } else {
    loadImage();
  }
}
