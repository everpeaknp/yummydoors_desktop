export const config = {
  apiBaseUrl:
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://yummydoorsapi.everacy.com",
  apiPrefix: "/api/v1",
  googleClientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "",
};
