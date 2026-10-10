export type ControlType = 'switch' | 'color' | 'number' | 'select' | 'subTab' | 'button' | 'custom';

export interface SwitchControl {
  type: 'switch';
  checked: boolean;
  ariaLabel?: string;
}

export interface ColorControl {
  type: 'color';
  color: string | null;
  dimmed?: boolean;
}

export interface NumberControl {
  type: 'number';
  value: number | null;
  min: number | null;
  max: number | null;
  step: number | null;
  limits?: string | null;
}

export interface SelectControl {
  type: 'select';
  value: string;
  label: string;
  options?: string[];
}

export interface SubTabControl {
  type: 'subTab';
  value: string;
  active: boolean;
}

export interface SettingsField {
  label: string;
  className: string;
  switches: SwitchControl[];
  colors: ColorControl[];
  numbers: NumberControl[];
  selects: SelectControl[];
  subTabs: SubTabControl[];
}

export interface SettingsSection {
  title: string;
  fields: SettingsField[];
}

export interface SettingsTab {
  id: string;
  name: string;
  isSubTab: boolean;
  sections: SettingsSection[];
}

export interface VelaSettingsSchema {
  dialogTitle: string;
  footer: {
    resetDefaultsText: string;
    applyInstantlyText: string;
    doneButtonText: string;
  };
  tabs: SettingsTab[];
}
