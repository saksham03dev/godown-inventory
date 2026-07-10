import { BarcodeImage } from "@/components/labels/BarcodeImage";
import type { LabelSize, StockUnit } from "@/lib/types/database";

interface LabelSheetProps {
  units: StockUnit[];
  productName: string;
  productCode: string;
  batchCode: string;
  sourceName: string;
  labelSize: LabelSize;
}

const sizeStyles: Record<
  LabelSize,
  { width: string; height: string; barcodeHeight: number }
> = {
  small: { width: "38mm", height: "25mm", barcodeHeight: 28 },
  medium: { width: "50mm", height: "30mm", barcodeHeight: 36 },
  large: { width: "70mm", height: "40mm", barcodeHeight: 48 },
};

export function LabelSheet({
  units,
  productName,
  productCode,
  batchCode,
  sourceName,
  labelSize,
}: LabelSheetProps) {
  const size = sizeStyles[labelSize];

  return (
    <div id="label-print-area" className="label-grid">
      {units.map((unit) => (
        <div
          key={unit.id}
          className="label-item flex flex-col items-center justify-between border border-dashed border-zinc-300 bg-white p-1 text-black"
          style={{ width: size.width, height: size.height, minHeight: size.height }}
        >
          <p className="w-full truncate text-center text-[7px] font-bold leading-tight">
            {productName}
          </p>
          <p className="text-[6px] text-zinc-600">
            {productCode} · Unit {unit.unit_number}/{units.length}
          </p>
          <BarcodeImage
            value={unit.unit_barcode}
            height={size.barcodeHeight}
            width={1.2}
            displayValue={labelSize !== "small"}
          />
          <p className="w-full truncate text-center text-[5px] text-zinc-500">
            {batchCode} · Source: {sourceName}
          </p>
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
