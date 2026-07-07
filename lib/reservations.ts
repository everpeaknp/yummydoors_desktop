export type ReservationStatus =
  | "pending"
  | "confirmed"
  | "seated"
  | "completed"
  | "cancelled"
  | "no_show";

export type RestaurantTableSummary = {
  id: number;
  code: string;
  label: string;
  zone: string | null;
  min_guest_count: number;
  max_guest_count: number;
  seat_capacity: number;
  category: string;
  status: string;
  sort_order: number;
};

export type ReservationStatusEvent = {
  status: ReservationStatus;
  note: string | null;
  created_at: string;
};

export type ReservationAvailabilitySlot = {
  time: string;
  is_available: boolean;
  remaining_tables: number;
  available_table_ids: number[];
};

export type ReservationTableAvailability = {
  table: RestaurantTableSummary;
  status: string;
};

export type ReservationAvailabilityResponse = {
  restaurant_id: number;
  restaurant_slug: string;
  reservation_date: string;
  reservation_time: string | null;
  guest_count: number | null;
  available_tables: RestaurantTableSummary[];
  slots: ReservationAvailabilitySlot[];
  table_inventory: ReservationTableAvailability[];
};

export type ReservationResponse = {
  id: number;
  reservation_code: string;
  status: ReservationStatus;
  restaurant_id: number;
  restaurant_name: string;
  restaurant_slug: string;
  restaurant_logo_url: string | null;
  reservation_date: string;
  reservation_time: string;
  guest_count: number;
  contact_name: string;
  contact_phone: string;
  contact_email: string | null;
  occasion: string | null;
  special_request: string | null;
  cancellation_reason: string | null;
  source: string;
  selected_table: RestaurantTableSummary | null;
  selected_table_label: string | null;
  selected_table_zone: string | null;
  created_at: string;
  updated_at: string;
  status_events: ReservationStatusEvent[];
};

export type RestaurantTableForm = {
  code: string;
  label: string;
  zone: string;
  min_guest_count: number;
  max_guest_count: number;
  status: string;
  sort_order: number;
};

export const RESERVATION_STATUS_OPTIONS: Array<{
  value: ReservationStatus;
  label: string;
}> = [
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "seated", label: "Seated" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "no_show", label: "No Show" },
];

export const DEFAULT_TABLE_FORM: RestaurantTableForm = {
  code: "",
  label: "",
  zone: "",
  min_guest_count: 1,
  max_guest_count: 4,
  status: "active",
  sort_order: 0,
};

export function extractApiErrorMessage(payload: any) {
  if (typeof payload?.detail === "string" && payload.detail.trim()) {
    return payload.detail;
  }

  if (Array.isArray(payload?.detail) && payload.detail.length > 0) {
    return payload.detail
      .map((issue: { msg?: string }) => issue.msg)
      .filter(Boolean)
      .join(" ");
  }

  if (typeof payload?.message === "string" && payload.message.trim()) {
    return payload.message;
  }

  return "Something went wrong.";
}

export function formatReservationStatus(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatReservationDate(dateValue: string) {
  const parsed = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return dateValue;
  }
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatReservationTime(value: string) {
  const [hours, minutes] = value.split(":");
  const parsedHours = Number(hours);
  const parsedMinutes = Number(minutes);
  if (!Number.isFinite(parsedHours) || !Number.isFinite(parsedMinutes)) {
    return value;
  }

  const reference = new Date();
  reference.setHours(parsedHours, parsedMinutes, 0, 0);
  return reference.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function canCancelReservation(status: ReservationStatus) {
  return status !== "cancelled" && status !== "completed" && status !== "no_show";
}

export function getStatusTone(status: ReservationStatus) {
  if (status === "completed") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "confirmed" || status === "seated") {
    return "bg-blue-50 text-blue-700 border-blue-200";
  }
  if (status === "cancelled" || status === "no_show") {
    return "bg-red-50 text-red-700 border-red-200";
  }
  return "bg-amber-50 text-amber-700 border-amber-200";
}
