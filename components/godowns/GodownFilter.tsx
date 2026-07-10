"use client";

import { Dropdown, type DropdownOption } from "@/components/ui/Dropdown";
import type { Godown } from "@/lib/types/database";

interface GodownFilterProps {
  godowns: Godown[];
  selectedId: string;
  onChange: (godownId: string) => void;
  className?: string;
}

export function GodownFilter({
  godowns,
  selectedId,
  onChange,
  className,
}: GodownFilterProps) {
  const options: DropdownOption[] = godowns.map((g) => ({
    value: g.id,
    label: g.location_name,
  }));

  return (
    <Dropdown
      label="Filter by Godown"
      options={options}
      value={selectedId}
      onChange={onChange}
      placeholder="Select a godown…"
      className={className}
    />
  );
}
