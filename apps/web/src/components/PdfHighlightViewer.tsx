import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { runLocalDocumentOcr } from '../utils/tesseractOcr';
import type { PageHighlightRect } from '../utils/manualRateConCapture';
import { normalizeCapturedText } from '../utils/manualRateConCapture';

export interface SelectionResult {
  text: string;
  rect: Omit<PageHighlightRect, 'fieldKey' | 'instanceId' | 'label' | 'color'>;
  usedOcr: boolean;
}

interface PdfHighlightViewerProps {
  file: File;
  highlights?: PageHighlightRect[];
  selectionEnabled?: boolean;
  activeColor?: string;
  onSelect?: (result: SelectionResult) => void;
  className?: string;
}

type TextItemBox = {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

type PdfDoc = {
  numPages: number;
  getPage: (n: number) => Promise<{
    getViewport: (opts: { scale: number }) => {
      width: number;
      height: number;
      scale: number;
      transform: number[];
      convertToViewportPoint: (x: number, y: number) => number[];
    };
    getTextContent: () => Promise<{ items: Array<Record<string, unknown>> }>;
    render: (opts: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => {
      promise: Promise<void>;
    };
  }>;
  destroy: () => Promise<void>;
};

const RENDER_SCALE = 1.5;
const MIN_TEXT_CHARS = 2;

async function loadPdfJs() {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();
  return pdfjs;
}

function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

function boxesIntersect(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
): boolean {
  return !(
    a.x + a.width < b.x ||
    b.x + b.width < a.x ||
    a.y + a.height < b.y ||
    b.y + b.height < a.y
  );
}

function extractTextFromBoxes(boxes: TextItemBox[], selection: TextItemBox): string {
  const hits = boxes
    .filter((box) => box.str.trim() && boxesIntersect(box, selection))
    .sort((a, b) => (Math.abs(a.y - b.y) > 4 ? a.y - b.y : a.x - b.x));

  if (hits.length === 0) return '';

  let text = '';
  let lastY: number | null = null;
  for (const hit of hits) {
    if (lastY != null && Math.abs(hit.y - lastY) > 4) {
      text += '\n';
    } else if (text && !text.endsWith('\n') && !text.endsWith(' ')) {
      text += ' ';
    }
    text += hit.str;
    lastY = hit.y;
  }
  return normalizeCapturedText(text);
}

function textItemsToBoxes(
  items: Array<Record<string, unknown>>,
  viewport: { scale: number; convertToViewportPoint: (x: number, y: number) => number[] }
): TextItemBox[] {
  const boxes: TextItemBox[] = [];
  for (const item of items) {
    const str = typeof item.str === 'string' ? item.str : '';
    if (!str || !Array.isArray(item.transform)) continue;
    const transform = item.transform as number[];
    const [vx, vy] = viewport.convertToViewportPoint(transform[4], transform[5]);
    const fontHeight = Math.hypot(transform[2], transform[3]) * viewport.scale;
    const itemWidth =
      typeof item.width === 'number' ? item.width * viewport.scale : str.length * fontHeight * 0.5;
    boxes.push({
      str,
      x: vx,
      y: vy - fontHeight,
      width: Math.max(itemWidth, 2),
      height: Math.max(fontHeight, 8),
    });
  }
  return boxes;
}

export default function PdfHighlightViewer({
  file,
  highlights = [],
  selectionEnabled = true,
  activeColor = 'rgba(137, 206, 255, 0.45)',
  onSelect,
  className = '',
}: PdfHighlightViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<PdfDoc | null>(null);
  const textBoxesRef = useRef<TextItemBox[]>([]);
  const imageUrlRef = useRef<string | null>(null);
  const loadGenRef = useRef(0);
  const initialPageRendered = useRef(false);
  const lastRenderedPage = useRef<number | null>(null);

  const [page, setPage] = useState(1);
  const [numPages, setNumPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState('');
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number } | null>(null);

  const isPdf = isPdfFile(file);

  const renderCurrent = useCallback(
    async (pageNumber: number, doc: PdfDoc | null) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      if (isPdf && doc) {
        const pdfPage = await doc.getPage(pageNumber);
        const viewport = pdfPage.getViewport({ scale: RENDER_SCALE });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await pdfPage.render({ canvasContext: ctx, viewport }).promise;
        setPageSize({ width: viewport.width, height: viewport.height });
        const content = await pdfPage.getTextContent();
        textBoxesRef.current = textItemsToBoxes(content.items, viewport);
        return;
      }

      if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current);
      const url = URL.createObjectURL(file);
      imageUrlRef.current = url;
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = url;
      });
      const maxWidth = 900;
      const scale = Math.min(1, maxWidth / img.width);
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      setPageSize({ width: canvas.width, height: canvas.height });
      textBoxesRef.current = [];
    },
    [file, isPdf]
  );

  useEffect(() => {
    const gen = ++loadGenRef.current;
    setLoading(true);
    setError('');
    setDragStart(null);
    setDragCurrent(null);
    setPage(1);
    initialPageRendered.current = false;
    lastRenderedPage.current = null;

    (async () => {
      try {
        if (pdfDocRef.current) {
          await pdfDocRef.current.destroy().catch(() => undefined);
          pdfDocRef.current = null;
        }
        if (isPdf) {
          const pdfjs = await loadPdfJs();
          const data = new Uint8Array(await file.arrayBuffer());
          const doc = (await pdfjs.getDocument({ data }).promise) as unknown as PdfDoc;
          if (gen !== loadGenRef.current) {
            await doc.destroy().catch(() => undefined);
            return;
          }
          pdfDocRef.current = doc;
          setNumPages(doc.numPages);
          await renderCurrent(1, doc);
        } else {
          setNumPages(1);
          await renderCurrent(1, null);
        }
        if (gen === loadGenRef.current) setLoading(false);
      } catch (err) {
        if (gen === loadGenRef.current) {
          setError(err instanceof Error ? err.message : 'Failed to open document');
          setLoading(false);
        }
      }
    })();

    return () => {
      loadGenRef.current += 1;
      pdfDocRef.current?.destroy?.().catch(() => undefined);
      pdfDocRef.current = null;
      if (imageUrlRef.current) {
        URL.revokeObjectURL(imageUrlRef.current);
        imageUrlRef.current = null;
      }
    };
  }, [file, isPdf, renderCurrent]);

  useEffect(() => {
    if (!isPdf || !pdfDocRef.current || page < 1) return;
    if (!initialPageRendered.current) {
      // First successful load renders page 1 in the file effect.
      if (!loading && pageSize.width > 0) {
        initialPageRendered.current = true;
        lastRenderedPage.current = page;
      }
      return;
    }
    if (lastRenderedPage.current === page) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await renderCurrent(page, pdfDocRef.current);
        if (!cancelled) lastRenderedPage.current = page;
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to render page');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [page, isPdf, loading, pageSize.width, renderCurrent]);

  const pointerToLocal = (event: React.MouseEvent) => {
    const overlay = overlayRef.current;
    if (!overlay) return { x: 0, y: 0 };
    const rect = overlay.getBoundingClientRect();
    const scaleX = pageSize.width / rect.width;
    const scaleY = pageSize.height / rect.height;
    return {
      x: Math.max(0, Math.min((event.clientX - rect.left) * scaleX, pageSize.width)),
      y: Math.max(0, Math.min((event.clientY - rect.top) * scaleY, pageSize.height)),
    };
  };

  const finishSelection = async (start: { x: number; y: number }, end: { x: number; y: number }) => {
    if (!onSelect || !selectionEnabled) return;
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const width = Math.abs(end.x - start.x);
    const height = Math.abs(end.y - start.y);
    if (width < 6 || height < 6 || pageSize.width === 0) return;

    const selectionBox = { x, y, width, height, str: '' };
    let text = extractTextFromBoxes(textBoxesRef.current, selectionBox);
    let usedOcr = false;

    if (text.replace(/\s/g, '').length < MIN_TEXT_CHARS) {
      const canvas = canvasRef.current;
      if (canvas) {
        setExtracting(true);
        try {
          const crop = document.createElement('canvas');
          crop.width = Math.max(1, Math.round(width));
          crop.height = Math.max(1, Math.round(height));
          const ctx = crop.getContext('2d');
          if (ctx) {
            ctx.drawImage(canvas, x, y, width, height, 0, 0, crop.width, crop.height);
            const blob = await new Promise<Blob | null>((resolve) =>
              crop.toBlob(resolve, 'image/png')
            );
            if (blob) {
              const ocr = await runLocalDocumentOcr(blob);
              text = normalizeCapturedText(ocr.rawText);
              usedOcr = true;
            }
          }
        } finally {
          setExtracting(false);
        }
      }
    }

    onSelect({
      text,
      usedOcr,
      rect: {
        page,
        x: x / pageSize.width,
        y: y / pageSize.height,
        width: width / pageSize.width,
        height: height / pageSize.height,
      },
    });
  };

  const marquee =
    dragStart && dragCurrent
      ? {
          left: `${(Math.min(dragStart.x, dragCurrent.x) / pageSize.width) * 100}%`,
          top: `${(Math.min(dragStart.y, dragCurrent.y) / pageSize.height) * 100}%`,
          width: `${(Math.abs(dragCurrent.x - dragStart.x) / pageSize.width) * 100}%`,
          height: `${(Math.abs(dragCurrent.y - dragStart.y) / pageSize.height) * 100}%`,
        }
      : null;

  const pageHighlights = highlights.filter((h) => h.page === page);

  return (
    <div className={`flex flex-col ${className}`}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-xs uppercase tracking-wider text-on-surface-variant">
          {isPdf ? `Page ${page} of ${numPages}` : 'Image'}
          {selectionEnabled ? ' · Drag to highlight' : ''}
        </p>
        {isPdf && numPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-1.5 text-on-surface-variant hover:text-primary disabled:opacity-30"
              aria-label="Previous page"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              disabled={page >= numPages || loading}
              onClick={() => setPage((p) => Math.min(numPages, p + 1))}
              className="p-1.5 text-on-surface-variant hover:text-primary disabled:opacity-30"
              aria-label="Next page"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="border border-error/40 bg-error-container/20 text-error px-3 py-2 text-sm mb-3">
          {error}
        </div>
      )}

      <div className="relative overflow-auto border border-outline-variant bg-surface max-h-[70vh]">
        {(loading || extracting) && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-surface/70">
            <Loader2 className="text-primary animate-spin" size={28} />
            <span className="ml-2 text-sm text-on-surface-variant">
              {extracting ? 'Reading selection…' : 'Loading document…'}
            </span>
          </div>
        )}
        <div className="relative inline-block w-full" style={{ aspectRatio: pageSize.width && pageSize.height ? `${pageSize.width} / ${pageSize.height}` : undefined }}>
          <canvas ref={canvasRef} className="block w-full h-auto" />
          <div
            ref={overlayRef}
            className={`absolute inset-0 z-10 ${selectionEnabled ? 'cursor-crosshair' : 'pointer-events-none'}`}
            onMouseDown={(event) => {
              if (!selectionEnabled || extracting) return;
              event.preventDefault();
              const pt = pointerToLocal(event);
              setDragStart(pt);
              setDragCurrent(pt);
            }}
            onMouseMove={(event) => {
              if (!dragStart) return;
              setDragCurrent(pointerToLocal(event));
            }}
            onMouseUp={() => {
              if (!dragStart || !dragCurrent) {
                setDragStart(null);
                setDragCurrent(null);
                return;
              }
              const start = dragStart;
              const end = dragCurrent;
              setDragStart(null);
              setDragCurrent(null);
              void finishSelection(start, end);
            }}
            onMouseLeave={() => {
              if (dragStart && dragCurrent) {
                const start = dragStart;
                const end = dragCurrent;
                setDragStart(null);
                setDragCurrent(null);
                void finishSelection(start, end);
              } else {
                setDragStart(null);
                setDragCurrent(null);
              }
            }}
          >
            {pageHighlights.map((h) => (
              <div
                key={h.instanceId}
                title={h.label}
                className="absolute border border-primary/80 pointer-events-none"
                style={{
                  left: `${h.x * 100}%`,
                  top: `${h.y * 100}%`,
                  width: `${h.width * 100}%`,
                  height: `${h.height * 100}%`,
                  background: h.color,
                }}
              />
            ))}
            {marquee && pageSize.width > 0 && (
              <div
                className="absolute border-2 border-primary pointer-events-none"
                style={{
                  left: marquee.left,
                  top: marquee.top,
                  width: marquee.width,
                  height: marquee.height,
                  background: activeColor,
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
