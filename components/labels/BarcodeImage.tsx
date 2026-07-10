"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

interface BarcodeImageProps {
  value: string;
  height?: number;
  width?: number;
  displayValue?: boolean;
  className?: string;
}

export function BarcodeImage({
  value,
  height = 40,
  width = 1.5,
  displayValue = true,
  className = "",
}: BarcodeImageProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !value) return;
    try {
      JsBarcode(svgRef.current, value, {
        format: "CODE128",
        width,
        height,
        displayValue,
        fontSize: 12,
        margin: 4,
        background: "#ffffff",
        lineColor: "#000000",
      });
    } catch {
      // Invalid barcode value — leave empty
    }
  }, [value, height, width, displayValue]);

  return (
    <svg ref={svgRef} className={className} role="img" aria-label={`Barcode ${value}`} />
  );
}
