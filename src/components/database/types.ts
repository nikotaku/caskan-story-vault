export type PropertyType =
  | "text"
  | "number"
  | "select"
  | "multi_select"
  | "date"
  | "phone"
  | "url"
  | "email"
  | "checkbox";

export interface SelectOption {
  label: string;
  color: string;
}

export interface Property {
  id: string;
  name: string;
  type: PropertyType;
  options?: SelectOption[];
  width?: number;
  hidden?: boolean;
  /** Calculated/system fields are displayed but cannot be edited. */
  readOnly?: boolean;
  /** Read-only after creation, but available in the new-record form. */
  allowOnCreate?: boolean;
  format?: "currency" | "days" | "percent";
}

export interface DatabaseRecord {
  id: string;
  [key: string]: unknown;
}
