import type {
  PosLinkStatus,
  StoredAuth,
  StoredCustomerAddress,
  StoredUser,
  StoredWorkspace,
} from "@/lib/auth-storage";

function normalizeAvatarUrl(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  let cleaned = value.trim();
  for (const prefix of [
    "https://https://",
    "http://http://",
    "https://http://",
    "http://https://",
  ]) {
    while (cleaned.startsWith(prefix)) {
      cleaned = `${prefix.split("://")[0]}://${cleaned.slice(prefix.length)}`;
    }
  }

  return cleaned || null;
}

function mapPosLinkStatus(payload: any): PosLinkStatus {
  return {
    enabled: Boolean(payload?.enabled),
    status: payload?.status ?? "unknown",
    message: payload?.message ?? "POS status is unavailable.",
    matchedBy: Array.isArray(payload?.matched_by) ? payload.matched_by : [],
    matchedUserId: payload?.matched_user_id ?? null,
    matchedUserName: payload?.matched_user_name ?? null,
    matchedUserEmail: payload?.matched_user_email ?? null,
    matchedRoles: Array.isArray(payload?.matched_roles) ? payload.matched_roles : [],
    matchedRestaurants: Array.isArray(payload?.matched_restaurants)
      ? payload.matched_restaurants.map((restaurant: any) => ({
          posRestaurantId: String(restaurant.pos_restaurant_id),
          name: restaurant.name,
          phone: restaurant.phone ?? null,
          relationshipSources: Array.isArray(restaurant.relationship_sources)
            ? restaurant.relationship_sources
            : [],
          isOwner: Boolean(restaurant.is_owner),
        }))
      : [],
    linkedUserIds: Array.isArray(payload?.linked_user_ids) ? payload.linked_user_ids : [],
    linkedRestaurantIds: Array.isArray(payload?.linked_restaurant_ids)
      ? payload.linked_restaurant_ids
      : [],
  };
}

function mapStoredWorkspace(payload: any): StoredWorkspace {
  return {
    id: Number(payload.id),
    workspaceType: payload.workspace_type ?? "customer",
    name: payload.name ?? "Workspace",
    slug: payload.slug ?? null,
    status: payload.status ?? "unknown",
    membershipRole: payload.membership_role ?? "member",
    isPrimary: Boolean(payload.is_primary),
    primaryRestaurantId: payload.primary_restaurant_id ?? null,
    primaryRestaurantName: payload.primary_restaurant_name ?? null,
  };
}

export function mapStoredAddress(payload: any): StoredCustomerAddress {
  return {
    id: payload.id,
    userId: payload.user_id,
    label: payload.label ?? null,
    recipientName: payload.recipient_name,
    phoneCountryCode: payload.phone_country_code ?? null,
    phoneNumber: payload.phone_number,
    email: payload.email ?? null,
    addressLine1: payload.address_line_1,
    addressLine2: payload.address_line_2 ?? null,
    streetNumber: payload.street_number ?? null,
    city: payload.city ?? null,
    area: payload.area ?? null,
    stateOrProvince: payload.state_or_province ?? null,
    latitude: payload.latitude ?? null,
    longitude: payload.longitude ?? null,
    deliveryNotes: payload.delivery_notes ?? null,
    isActive: Boolean(payload.is_active),
    isDefault: Boolean(payload.is_default),
    locationTitle: payload.location_title ?? "Selected location",
    locationSubtitle: payload.location_subtitle ?? "",
    addressSummary: payload.address_summary ?? "",
  };
}

export function mapStoredUser(data: any): StoredUser {
  const workspaces = Array.isArray(data.workspaces) ? data.workspaces.map(mapStoredWorkspace) : [];
  const activeWorkspace =
    data.active_workspace ? mapStoredWorkspace(data.active_workspace) : null;
  const phoneCountry = data.phone_country
    ? {
        iso2: data.phone_country.iso2,
        name: data.phone_country.name,
        dialCode: data.phone_country.dial_code,
        flagEmoji: data.phone_country.flag_emoji,
      }
    : null;

  return {
    id: data.id,
    fullName: data.full_name,
    email: data.email,
    phone: data.phone,
    phoneCountryCode: data.phone_country_code ?? null,
    phoneNationalNumber: data.phone_national_number ?? null,
    phoneDisplay: data.phone_display ?? data.phone ?? null,
    phoneIsPresent: Boolean(data.phone_is_present ?? data.phone),
    phoneCanEdit: data.phone_can_edit !== false,
    phoneCountry,
    avatarUrl: normalizeAvatarUrl(data.avatar_url),
    status: data.status ?? "unknown",
    isVerified: Boolean(data.is_verified),
    riderWorkMode: data.rider_work_mode ?? "freelance",
    isAcceptingOffers: Boolean(data.is_accepting_offers),
    roles: Array.isArray(data.roles) ? data.roles.map((role: { code: string }) => role.code) : [],
    posLinkStatus: mapPosLinkStatus(data.pos_link_status),
    defaultAddressId: data.default_address_id ?? null,
    savedAddressesCount: data.saved_addresses_count ?? 0,
    defaultAddress: data.default_address ? mapStoredAddress(data.default_address) : null,
    activeRestaurantId: data.active_restaurant_id ?? null,
    activeWorkspaceId: data.active_workspace_id ?? null,
    activeWorkspace,
    workspaces,
  };
}

export function mapStoredAuth(data: any): StoredAuth {
  return {
    accessToken: data.tokens.access_token,
    refreshToken: data.tokens.refresh_token,
    user: mapStoredUser(data.user),
  };
}

export function mergeStoredUserWithProfile(
  user: StoredUser,
  payload: any,
): StoredUser {
  const phoneCountry = payload.phone_country
    ? {
        iso2: payload.phone_country.iso2,
        name: payload.phone_country.name,
        dialCode: payload.phone_country.dial_code,
        flagEmoji: payload.phone_country.flag_emoji,
      }
    : user.phoneCountry;

  return {
    ...user,
    fullName: payload.full_name ?? user.fullName,
    email: payload.email ?? user.email,
    phone: payload.phone ?? user.phone,
    phoneCountryCode: payload.phone_country_code ?? user.phoneCountryCode,
    phoneNationalNumber: payload.phone_national_number ?? user.phoneNationalNumber,
    phoneDisplay: payload.phone_display ?? payload.phone ?? user.phoneDisplay,
    phoneIsPresent:
      typeof payload.phone_is_present === "boolean"
        ? payload.phone_is_present
        : user.phoneIsPresent,
    phoneCanEdit:
      typeof payload.phone_can_edit === "boolean" ? payload.phone_can_edit : user.phoneCanEdit,
    phoneCountry,
    avatarUrl: normalizeAvatarUrl(payload.avatar_url) ?? user.avatarUrl,
    status: payload.status ?? user.status,
    isVerified:
      typeof payload.is_verified === "boolean" ? payload.is_verified : user.isVerified,
    riderWorkMode: payload.rider_work_mode ?? user.riderWorkMode,
    isAcceptingOffers:
      typeof payload.is_accepting_offers === "boolean"
        ? payload.is_accepting_offers
        : user.isAcceptingOffers,
    defaultAddressId: payload.default_address_id ?? null,
    savedAddressesCount: payload.saved_addresses_count ?? 0,
    defaultAddress: payload.default_address ? mapStoredAddress(payload.default_address) : null,
    activeRestaurantId: payload.active_restaurant_id ?? user.activeRestaurantId,
    activeWorkspaceId: payload.active_workspace_id ?? user.activeWorkspaceId,
    activeWorkspace: payload.active_workspace
      ? mapStoredWorkspace(payload.active_workspace)
      : user.activeWorkspace,
    workspaces: Array.isArray(payload.workspaces)
      ? payload.workspaces.map(mapStoredWorkspace)
      : user.workspaces,
  };
}
