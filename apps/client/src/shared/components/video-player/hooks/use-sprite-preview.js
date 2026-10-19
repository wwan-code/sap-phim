/**
 * @file use-sprite-preview.js
 * @module Components/VideoPlayer/Hooks
 * @description Hook phân tích cú pháp WebVTT Storyboard, preload hình ảnh Sprite Sheets với AbortController và Binary Search O(log N) tối ưu hiệu năng.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Phân tích chuỗi thời gian WebVTT (HH:MM:SS.mmm hoặc MM:SS.mmm) sang số giây
 * @param {string} timeStr
 * @returns {number}
 */
function parseVttTime(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(':');
  if (parts.length === 3) {
    return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
  } else if (parts.length === 2) {
    return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
  }
  return parseFloat(timeStr) || 0;
}

/**
 * Phân tích dòng media fragment dạng URL#xywh=x,y,w,h
 * @param {string} line
 * @param {string} baseUrl
 * @returns {Object}
 */
function parseFragment(line, baseUrl) {
  const [filePart, frag] = line.trim().split('#');
  let x = 0, y = 0, w = 160, h = 90;

  if (frag && frag.startsWith('xywh=')) {
    const coords = frag.replace('xywh=', '').split(',').map(Number);
    if (coords.length === 4) {
      [x, y, w, h] = coords;
    }
  }

  let fullUrl = filePart;
  if (!fullUrl.startsWith('http') && !fullUrl.startsWith('/')) {
    const baseDir = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1);
    fullUrl = baseDir + filePart;
  }

  return { url: fullUrl, x, y, w, h };
}

export function useSpritePreview({ vttUrl, defaultSpriteUrl }) {
  const [cues, setCues] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const imageCacheRef = useRef(new Map());
  const pendingImagesRef = useRef([]);

  // Tải và phân tích tệp WebVTT với AbortController
  useEffect(() => {
    if (!vttUrl) {
      setIsLoaded(false);
      setCues([]);
      return;
    }

    const abortController = new AbortController();
    let isMounted = true;

    async function loadVtt() {
      try {
        const res = await fetch(vttUrl, { signal: abortController.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();

        const lines = text.split(/\r?\n/);
        const parsedCues = [];
        let currentStart = 0;
        let currentEnd = 0;

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();

          // Dòng chứa thời gian: 00:00:00.000 --> 00:00:05.000
          if (line.includes('-->')) {
            const [start, end] = line.split('-->');
            currentStart = parseVttTime(start);
            currentEnd = parseVttTime(end);
          } else if (
            line &&
            currentEnd > 0 &&
            (line.includes('.jpg') || line.includes('.webp') || line.includes('#xywh='))
          ) {
            const frag = parseFragment(line, vttUrl);
            parsedCues.push({
              start: currentStart,
              end: currentEnd,
              ...frag,
            });
            currentStart = 0;
            currentEnd = 0;
          }
        }

        if (isMounted) {
          setCues(parsedCues);
          setIsLoaded(parsedCues.length > 0);

          // Preload các sprite sheet duy nhất
          const uniqueUrls = [...new Set(parsedCues.map((c) => c.url))];
          uniqueUrls.forEach((url) => {
            if (!imageCacheRef.current.has(url)) {
              const img = new Image();
              img.src = url;
              pendingImagesRef.current.push(img);
              img.onload = () => {
                imageCacheRef.current.set(url, img);
              };
            }
          });
        }
      } catch (err) {
        if (err.name === 'AbortError') return;
        if (isMounted) {
          setIsLoaded(false);
          // Dự phòng nếu có defaultSpriteUrl
          if (defaultSpriteUrl) {
            const fallbackImg = new Image();
            fallbackImg.src = defaultSpriteUrl;
            imageCacheRef.current.set('default', fallbackImg);
          }
        }
      }
    }

    loadVtt();

    return () => {
      isMounted = false;
      abortController.abort();
      // Dọn dẹp listeners của các ảnh đang preload dở dang
      pendingImagesRef.current.forEach((img) => {
        img.onload = null;
        img.onerror = null;
      });
      pendingImagesRef.current = [];
    };
  }, [vttUrl, defaultSpriteUrl]);

  // Tìm cue tương ứng bằng Binary Search O(log N) thay vì Array.find O(N)
  const getPreviewCue = useCallback(
    (time) => {
      if (!cues.length) return null;

      let low = 0;
      let high = cues.length - 1;

      while (low <= high) {
        const mid = (low + high) >> 1;
        const cue = cues[mid];

        if (time >= cue.start && time < cue.end) {
          return cue;
        } else if (time < cue.start) {
          high = mid - 1;
        } else {
          low = mid + 1;
        }
      }

      if (time <= cues[0].start) return cues[0];
      return cues[cues.length - 1];
    },
    [cues],
  );

  // Vẽ hình ảnh thumbnail lên Canvas
  const renderPreviewToCanvas = useCallback(
    (canvas, time) => {
      if (!canvas) return;
      const cue = getPreviewCue(time);
      if (!cue) return;

      const img = imageCacheRef.current.get(cue.url);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      if (img && img.complete) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, cue.x, cue.y, cue.w, cue.h, 0, 0, canvas.width, canvas.height);
      } else {
        // Nếu ảnh chưa cache xong, tạo mới và vẽ khi tải xong
        const newImg = new Image();
        newImg.src = cue.url;
        newImg.onload = () => {
          imageCacheRef.current.set(cue.url, newImg);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(newImg, cue.x, cue.y, cue.w, cue.h, 0, 0, canvas.width, canvas.height);
        };
      }
    },
    [getPreviewCue],
  );

  return {
    isLoaded,
    cues,
    getPreviewCue,
    renderPreviewToCanvas,
  };
}

export default useSpritePreview;
