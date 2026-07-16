import { BarcodeImage } from "@/components/labels/BarcodeImage";
import type { LabelSize, StockUnit } from "@/lib/types/database";

interface LabelSheetProps {
  units: StockUnit[];
  productName: string;
  productCode: string;
  productSize?: string | null;
  /** Batch notes / product special note shown under name+size */
  description?: string | null;
  batchCode: string;
  labelSize: LabelSize;
}

const sizeStyles: Record<
  LabelSize,
  {
    width: string;
    height: string;
    /** Product name + size — primary readable text */
    titlePx: number;
    descriptionPx: number;
    balePx: number;
    metaPx: number;
    barcodeHeight: number;
    barcodeWidth: number;
    padding: string;
  }
> = {
  square: {
    width: "100mm",
    height: "100mm",
    titlePx: 40,
    descriptionPx: 18,
    balePx: 14,
    metaPx: 11,
    barcodeHeight: 72,
    barcodeWidth: 2.0,
    padding: "5mm",
  },
  wide: {
    width: "75mm",
    height: "125mm",
    titlePx: 28,
    descriptionPx: 15,
    balePx: 13,
    metaPx: 11,
    barcodeHeight: 80,
    barcodeWidth: 1.7,
    padding: "4mm",
  },
};

export function LabelSheet({
  units,
  productName,
  productCode,
  productSize,
  description,
  batchCode,
  labelSize,
}: LabelSheetProps) {
  const size = sizeStyles[labelSize];
  const note = description?.trim() || null;

  return (
    <div id="label-print-area" className="label-grid">
      {units.map((unit) => (
        <div
          key={unit.id}
          className="label-item flex flex-col bg-white text-black"
          style={{
            width: size.width,
            height: size.height,
            minHeight: size.height,
            padding: size.padding,
            border: "1px dashed #d4d4d8",
          }}
        >
          {/* Top: name + size dominant, then description, then bale # */}
          <div className="flex min-h-0 flex-1 flex-col items-center gap-1 overflow-hidden text-center">
            <p
              className="w-full font-black uppercase leading-none tracking-tight"
              style={{ fontSize: `${size.titlePx}px` }}
            >
              {productName}
            </p>
            {productSize ? (
              <p
                className="w-full font-black leading-none tracking-tight"
                style={{ fontSize: `${size.titlePx}px` }}
              >
                {productSize}
              </p>
            ) : null}
            {note ? (
              <p
                className="mt-1 w-full font-medium leading-snug text-zinc-800"
                style={{
                  fontSize: `${size.descriptionPx}px`,
                  display: "-webkit-box",
                  WebkitLineClamp: labelSize === "square" ? 3 : 4,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {note}
              </p>
            ) : null}
            <p
              className="mt-auto w-full font-semibold text-zinc-700"
              style={{ fontSize: `${size.balePx}px` }}
            >
              Bale {unit.unit_number}/{units.length}
              {productCode ? ` · ${productCode}` : ""}
            </p>
          </div>

          {/* Bottom: barcode */}
          <div className="mt-2 flex w-full shrink-0 flex-col items-center gap-0.5">
            <BarcodeImage
              value={unit.unit_barcode}
              height={size.barcodeHeight}
              width={size.barcodeWidth}
              displayValue
            />
            <p
              className="w-full truncate text-center text-zinc-500"
              style={{ fontSize: `${size.metaPx}px` }}
            >
              {batchCode}
            </p>
          </div>
        </div>
      ))}

      <style jsx global>{`
        .label-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 4mm;
        }
        @media print {
          body * {
            visibility: hidden;
          }
          #label-print-area,
          #label-print-area * {
            visibility: visible;
          }
          #label-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .label-item {
            break-inside: avoid;
            page-break-inside: avoid;
            border-color: #a1a1aa !important;
          }
        }
      `}</style>
    </div>
  );
}
