"use client";

export type AnalyticsPeriod =
  | "today"
  | "yesterday"
  | "last_week"
  | "last_7_days"
  | "last_month"
  | "last_30_days"
  | "this_year"
  | "custom";

export type AnalyticsDateRange = {
  period: AnalyticsPeriod;
  label: string;
  start_date: string;
  end_date: string;
};

export type AnalyticsSummary = {
  orders_count: number;
  delivered_orders_count: number;
  cancelled_orders_count: number;
  pending_orders_count: number;
  refunded_orders_count: number;
  gross_spend: number;
  net_spend: number;
  cancelled_spend: number;
  pending_spend: number;
  refunded_spend: number;
  average_order_value: number;
};

export type AnalyticsDailyPoint = {
  date: string;
  orders_count: number;
  gross_spend: number;
  net_spend: number;
  cancelled_spend: number;
  pending_spend: number;
  refunded_spend: number;
};

export type AnalyticsStatusBreakdown = {
  status: string;
  orders_count: number;
  spend: number;
};

export type AnalyticsBreakdownItem = {
  id: number | null;
  name: string;
  orders_count: number;
  quantity: number;
  gross_spend: number;
  net_spend: number;
  cancelled_spend: number;
  pending_spend: number;
  refunded_spend: number;
};

export type AnalyticsLoyaltySummary = {
  current_points: number;
  total_orders: number;
  total_spent: number;
  lifetime_points_earned: number;
  lifetime_points_redeemed: number;
  points_earned_in_period: number;
  points_rate: number;
};

export type MerchantAnalyticsResponse = {
  period: AnalyticsDateRange;
  summary: AnalyticsSummary;
  daily_sales: AnalyticsDailyPoint[];
  status_breakdown: AnalyticsStatusBreakdown[];
  top_selling_items: AnalyticsBreakdownItem[];
  category_breakdown: AnalyticsBreakdownItem[];
};

export type CustomerAnalyticsResponse = {
  period: AnalyticsDateRange;
  summary: AnalyticsSummary;
  loyalty: AnalyticsLoyaltySummary;
  daily_spend: AnalyticsDailyPoint[];
  restaurant_breakdown: AnalyticsBreakdownItem[];
  category_breakdown: AnalyticsBreakdownItem[];
  food_breakdown: AnalyticsBreakdownItem[];
  top_ordered_item: AnalyticsBreakdownItem | null;
};

export const ANALYTICS_PERIOD_OPTIONS: Array<{
  value: AnalyticsPeriod;
  label: string;
}> = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last_week", label: "Last week" },
  { value: "last_7_days", label: "Last 7 days" },
  { value: "last_month", label: "Last month" },
  { value: "last_30_days", label: "Last 30 days" },
  { value: "this_year", label: "This year" },
  { value: "custom", label: "Custom range" },
];

export function formatMoney(amount: number, currencyCode = "NPR") {
  const rounded = Number.isInteger(amount) ? amount.toFixed(0) : amount.toFixed(2);
  return currencyCode === "NPR" ? `Rs. ${rounded}` : `${currencyCode} ${rounded}`;
}

export function toLocalDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function shiftLocalDate(date: Date, offsetDays: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + offsetDays);
  return next;
}

export function getDefaultCustomRange(days = 7) {
  const endDate = new Date();
  const startDate = shiftLocalDate(endDate, -(days - 1));
  return {
    startDate: toLocalDateInputValue(startDate),
    endDate: toLocalDateInputValue(endDate),
  };
}

export function buildAnalyticsQuery(params: {
  period: AnalyticsPeriod;
  startDate?: string | null;
  endDate?: string | null;
}) {
  const query = new URLSearchParams();
  query.set("period", params.period);

  if (params.period === "custom") {
    if (params.startDate) {
      query.set("start_date", params.startDate);
    }
    if (params.endDate) {
      query.set("end_date", params.endDate);
    }
  }

  return query;
}

export function formatAnalyticsDateLabel(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatAnalyticsShortDate(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}
