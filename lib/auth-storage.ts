export const AUTH_STORAGE_KEY = "yummydoors.auth";

export type PosRestaurantMatch = {
  posRestaurantId: string;
  name: string;
  phone: string | null;
  relationshipSources: string[];
  isOwner: boolean;
};

export type PosLinkStatus = {
  enabled: boolean;
  status: string;
  message: string;
  matchedBy: string[];
  matchedUserId: string | null;
  matchedUserName: string | null;
  matchedUserEmail: string | null;
  matchedRoles: string[];
  matchedRestaurants: PosRestaurantMatch[];
  linkedUserIds: string[];
  linkedRestaurantIds: string[];
};

export type StoredCustomerAddress = {
  id: number;
  userId: number;
  label: string | null;
  recipientName: string;
  phoneCountryCode: string | null;
  phoneNumber: string;
  email: string | null;
  addressLine1: string;
  addressLine2: string | null;
  streetNumber: string | null;
  city: string | null;
  area: string | null;
  stateOrProvince: string | null;
  latitude: number | null;
  longitude: number | null;
  deliveryNotes: string | null;
  isActive: boolean;
  isDefault: boolean;
  locationTitle: string;
  locationSubtitle: string;
  addressSummary: string;
};

export type StoredUser = {
  id: number;
  fullName: string;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  status: string;
  isVerified: boolean;
  roles: string[];
  posLinkStatus: PosLinkStatus;
  defaultAddressId: number | null;
  savedAddressesCount: number;
  defaultAddress: StoredCustomerAddress | null;
};

export type StoredAuth = {
  accessToken: string;
  refreshToken: string;
  user: StoredUser;
};

export function loadStoredAuth(): StoredAuth | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredAuth;
  } catch {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

export function saveStoredAuth(value: StoredAuth | null) {
  if (typeof window === "undefined") return;
  if (!value) {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(value));
}
