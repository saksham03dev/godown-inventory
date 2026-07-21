"use client";

import { Dropdown, type DropdownOption } from "@/components/ui/Dropdown";
import { ALL_GODOWNS_ID } from "@/lib/constants/inventoryView";
import type { Godown } from "@/lib/types/database";

interface GodownFilterProps {
  godowns: Godown[];
  selectedId: string;
  onChange: (godownId: string) => void;
  className?: string;
  showAllOption?: boolean;
}

export function GodownFilter({
  godowns,
  selectedId,
  onChange,
  className,
  showAllOption = false,
}: GodownFilterProps) {
  const options: DropdownOption[] = [
    ...(showAllOption
      ? [{ value: ALL_GODOWNS_ID, label: "All stock" }]
      : []),
    ...godowns.map((g) => ({
      value: g.id,
      label: g.location_name,
    })),
  ];

  return (
    <Dropdown
      label="View stock in"
      options={options}
      value={selectedId}
      onChange={onChange}
      placeholder="Select a godown…"
      className={className}
    />
  );
}
