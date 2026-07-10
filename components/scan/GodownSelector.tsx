"use client";

import { Dropdown, type DropdownOption } from "@/components/ui/Dropdown";
import type { Godown } from "@/lib/types/database";

interface GodownSelectorProps {
  godowns: Godown[];
  selectedId: string;
  onChange: (godownId: string) => void;
  disabled?: boolean;
}

export function GodownSelector({
  godowns,
  selectedId,
  onChange,
  disabled,
}: GodownSelectorProps) {
  const options: DropdownOption[] = godowns.map((g) => ({
    value: g.id,
    label: `${g.location_name} (cap. ${g.capacity})`,
  }));

  return (
    <Dropdown
      label="Active Godown"
      options={options}
      value={selectedId}
      onChange={onChange}
      placeholder="Where are you standing?"
      disabled={disabled}
    />
  );
}
