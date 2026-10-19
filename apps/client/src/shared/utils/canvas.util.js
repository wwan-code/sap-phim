/**
 * @file canvas.util.js
 * @module Shared/Utils/CanvasUtil
 * @description Hàm tiện ích xử lý HTML5 Canvas, cắt xén, xoay, lật và nén hình ảnh chất lượng cao.
 */

/**
 * Tạo đối tượng HTMLImageElement từ URL nguồn hình ảnh
 * @param {string} url - Đường dẫn ảnh (http/data/blob)
 * @returns {Promise<HTMLImageElement>}
 */
export const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });

/**
 * Tính toán kích thước hộp bao bọc (Bounding Box) mới của hình chữ nhật khi xoay
 * @param {number} width - Chiều rộng gốc
 * @param {number} height - Chiều cao gốc
 * @param {number} rotation - Góc xoay (độ)
 * @returns {{ width: number, height: number }}
 */
export function getRotatedRectSize(width, height, rotation) {
  const rotRad = (rotation * Math.PI) / 180;

  return {
    width:
      Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
    height:
      Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
  };
}

/**
 * Cắt xén, xoay và lật hình ảnh dựa trên pixelCrop từ react-easy-crop
 * @param {string} imageSrc - URL ảnh nguồn
 * @param {object} pixelCrop - Tọa độ và kích thước vùng cắt { x, y, width, height }
 * @param {number} [rotation=0] - Góc xoay (độ)
 * @param {object} [flip={ horizontal: false, vertical: false }] - Trạng thái lật ảnh
 * @param {object} [options={}] - Tùy chọn xuất file
 * @param {string} [options.outputType='image/jpeg'] - MIME type xuất ra
 * @param {number} [options.quality=0.92] - Mức chất lượng nén (0 - 1)
 * @param {string} [options.filename='cropped-image.jpeg'] - Tên file
 * @returns {Promise<Blob|null>}
 */
export default async function getCroppedImg(
  imageSrc,
  pixelCrop,
  rotation = 0,
  flip = { horizontal: false, vertical: false },
  options = {}
) {
  const {
    filename = 'cropped-image.jpeg',
    outputType = 'image/jpeg',
    quality = 0.92,
  } = options;

  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return null;
  }

  const rotRad = (rotation * Math.PI) / 180;

  // Tính toán bounding box của ảnh khi xoay
  const { width: bBoxWidth, height: bBoxHeight } = getRotatedRectSize(
    image.width,
    image.height,
    rotation
  );

  // Thiết lập kích thước canvas theo bounding box
  canvas.width = bBoxWidth;
  canvas.height = bBoxHeight;

  // Dịch chuyển canvas context về tâm để xoay và lật
  ctx.translate(bBoxWidth / 2, bBoxHeight / 2);
  ctx.rotate(rotRad);
  ctx.scale(flip?.horizontal ? -1 : 1, flip?.vertical ? -1 : 1);
  ctx.translate(-image.width / 2, -image.height / 2);

  // Vẽ ảnh vào context đã xoay/lật
  ctx.drawImage(image, 0, 0);

  // Trích xuất vùng pixel cần cắt
  const croppedData = ctx.getImageData(
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height
  );

  // Resize canvas về đúng kích thước vùng cắt
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  // Đặt lại dữ liệu ảnh đã cắt
  ctx.putImageData(croppedData, 0, 0);

  // Xuất ra Blob với đúng MIME type và chất lượng nén
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          blob.name = filename;
          resolve(blob);
        } else {
          resolve(null);
        }
      },
      outputType,
      quality
    );
  });
}
