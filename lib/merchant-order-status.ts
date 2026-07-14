export type MerchantOrderStatusMeta = {
  label: string;
  tone: string;
};

const STATUS_META: Record<string, MerchantOrderStatusMeta> = {
  toPay: { label: "To Pay", tone: "bg-[#6c757d]" },
  placed: { label: "Placed", tone: "bg-[#0d84ff]" },
  preparing: { label: "Preparing", tone: "bg-[#f5b800]" },
  delivered: { label: "Delivered", tone: "bg-[#25b546]" },
  cancelled: { label: "Cancelled", tone: "bg-[#e53e4f]" },
};

function formatStatusLabel(status: string) {
  return status
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function getMerchantOrderStatusMeta(status: string | null | undefined): MerchantOrderStatusMeta {
  const normalizedStatus = String(status || "unknown");
  return STATUS_META[normalizedStatus] ?? {
    label: formatStatusLabel(normalizedStatus),
    tone: "bg-[#6c757d]",
  };
}
