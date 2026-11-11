const MAX_INPUT_BYTES = 4 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 900 * 1024;
const OUTPUT_SIZE = 900;
export class MediaStorageAdapter {
  async upload() { throw new Error("Media upload 尚未設定。"); } async remove() { throw new Error("Media remove 尚未設定。"); }
  getPublicUrl() { throw new Error("Media public URL 尚未設定。"); } getSignedUrl() { throw new Error("Media signed URL 尚未設定。"); }
  validateFile() { throw new Error("Media validate 尚未設定。"); } async compressImage() { throw new Error("Media compression 尚未設定。"); }
  async createPreview() { throw new Error("Media preview 尚未設定。"); } async process() { throw new Error("Media processing 尚未設定。"); }
  async save() { throw new Error("Media save 尚未設定。"); }
}
export class LocalDemoMediaAdapter extends MediaStorageAdapter {
  validateFile(file) { if (!(file instanceof Blob) || !file.type.startsWith("image/")) throw new Error("請選擇圖片檔案。"); if (file.size > MAX_INPUT_BYTES) throw new Error("圖片不得超過 4 MB。"); return true; }
  async upload(file, options = {}) { return this.save(await this.process(file, options)); }
  async remove() { return { removed: false, reason: "Local Demo 圖片未寫入持久儲存空間。" }; }
  getPublicUrl(record) { return record?.url || ""; }
  getSignedUrl() { throw new Error("Local Demo 不提供 Signed URL。"); }
  async compressImage(file, options = {}) { return this.process(file, options); }
  async createPreview(file, options = {}) { return this.process(file, options); }
  async process(file, { zoom = 1, offsetX = 0, offsetY = 0 } = {}) {
    this.validateFile(file);
    const bitmap = await createImageBitmap(file), originalWidth = bitmap.width, originalHeight = bitmap.height;
    const side = Math.min(bitmap.width, bitmap.height) / Math.max(1, Number(zoom) || 1), maxX = Math.max(0, bitmap.width - side), maxY = Math.max(0, bitmap.height - side);
    const sx = Math.min(maxX, Math.max(0, (bitmap.width - side) / 2 + Number(offsetX || 0))), sy = Math.min(maxY, Math.max(0, (bitmap.height - side) / 2 + Number(offsetY || 0)));
    const canvas = document.createElement("canvas"); canvas.width = OUTPUT_SIZE; canvas.height = OUTPUT_SIZE;
    canvas.getContext("2d", { alpha: false }).drawImage(bitmap, sx, sy, side, side, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE); bitmap.close?.();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", .86));
    if (!blob || blob.size > MAX_OUTPUT_BYTES) throw new Error("壓縮後圖片仍過大，請選擇較小圖片。");
    return { blob, dataUrl: await blobToDataUrl(blob), original: { width: originalWidth, height: originalHeight, bytes: file.size, type: file.type }, output: { width: OUTPUT_SIZE, height: OUTPUT_SIZE, bytes: blob.size, type: blob.type }, ratio: "1:1" };
  }
  async save(processed) { if (!processed?.dataUrl) throw new Error("沒有可儲存的圖片。"); return { url: processed.dataUrl, storage: "local-demo-preview", cloudStored: false }; }
}
export class R2MediaStorageAdapter extends MediaStorageAdapter {
  unavailable() { throw new Error("Production R2 Adapter 尚未設定。"); }
  upload() { return this.unavailable(); } remove() { return this.unavailable(); } getPublicUrl() { return this.unavailable(); } getSignedUrl() { return this.unavailable(); }
  validateFile(file) { return new LocalDemoMediaAdapter().validateFile(file); } compressImage() { return this.unavailable(); } createPreview() { return this.unavailable(); }
}
function blobToDataUrl(blob) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error("圖片讀取失敗。")); reader.readAsDataURL(blob); }); }
let adapter;
export function getMediaStorageAdapter() { adapter ||= new LocalDemoMediaAdapter(); return adapter; }
