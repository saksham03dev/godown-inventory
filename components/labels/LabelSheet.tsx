import { BarcodeImage } from "@/components/labels/BarcodeImage";
import type { LabelSize, StockUnit } from "@/lib/types/database";

interface LabelSheetProps {
  units: StockUnit[];
  productName: string;
  productCode: string;
  productSize?: string | null;
  batchCode: string;
  labelSize: LabelSize;
}

const sizeStyles: Record<
  LabelSize,
  {
    width: string;
    height: string;
    namePx: number;
    detailPx: number;
    metaPx: number;
    barcodeHeight: number;
    barcodeWidth: number;
  }
> = {
  square: {
    width: "100mm",
    height: "100mm",
    namePx: 28,
    detailPx: 20,
    metaPx: 14,
    barcodeHeight: 90,
    barcodeWidth: 2.2,
  },
  wide: {
    width: "75mm",
    height: "125mm",
    namePx: 24,
    detailPx: 17,
    metaPx: 13,
    barcodeHeight: 90,
    barcodeWidth: 1.8,
  },
};

export function LabelSheet({
  units,
  productName,
  productCode,
  productSize,
  batchCode,
  labelSize,
}: LabelSheetProps) {
  const size = sizeStyles[labelSize];

  return (
    <div id="label-print-area" className="label-grid">
      {units.map((unit) => (
        <div
          key={unit.id}
          className="label-item flex flex-col items-center justify-between border border-dashed border-zinc-300 bg-white p-4 text-black"
          style={{ width: size.width, height: size.height, minHeight: size.height }}
        >
          <div className="flex w-full flex-col items-center gap-1.5 text-center">
            <p
              className="w-full font-bold leading-tight"
              style={{ fontSize: `${size.namePx}px` }}
            >
              {productName}
            </p>
            {productSize && (
              <p
                className="font-semibold text-zinc-700"
                style={{ fontSize: `${size.detailPx}px` }}
              >
                {productSize}
              </p>
            )}
            <p
              className="text-zinc-600"
              style={{ fontSize: `${size.detailPx}px` }}
            >
              {productCode} · Bale {unit.unit_number}/{units.length}
            </p>
          </div>

          <div className="flex w-full flex-col items-center gap-1">
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
          }
        }
      `}</style>
    </div>
  );
}
