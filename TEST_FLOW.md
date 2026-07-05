# YummyDoors End-to-End Test Flow

This document outlines the complete QA testing flow for the YummyDoors platform based on the current system architecture. Use this guide to thoroughly test both the Frontend (Next.js Desktop App / Mobile App) and Backend (FastAPI).

## 1. The Customer Flow (User Journey)

### A. Authentication & Onboarding
- [ ] **Sign Up:** Open the app and create a new customer account. Verify that a welcome email or verification step works (if configured).
- [ ] **Login:** Log out and log back in to ensure JWT tokens are successfully generated.
- [ ] **Location Prompt:** On the home page, ensure the browser asks for Location Permissions. 
  - *Test Case 1:* Click "Allow" and verify it fetches local restaurants.
  - *Test Case 2:* Click "Block" and verify it safely defaults to Pokhara coordinates without crashing.

### B. Browsing & Feed (Merchandising Module)
- [ ] **Home Feed Loading:** Verify the `/home/feed` API successfully returns live data (Categories, Featured Restaurants, Promos).
- [ ] **Dynamic Hero Text:** Check that the hero banner text dynamically updates to match the user's neighborhood/street based on their GPS coordinates.
- [ ] **Category Filtering:** Click on a category (e.g., "Pizza") and ensure the restaurant list filters correctly.

### C. Restaurant & Menu (Catalog Module)
- [ ] **Restaurant Page:** Click on a restaurant from the feed. Ensure their cover image, ratings, and delivery times load correctly.
- [ ] **Menu Navigation:** Scroll through the restaurant's menu. Verify categories (e.g., "Starters", "Mains") are accurate.
- [ ] **Item Details:** Click on a specific food item. Ensure the price, description, and image load correctly.

### D. Profile Management (Customer Module)
- [ ] **View Profile:** Navigate to the user profile and ensure name and email are correct.
- [ ] **Update Profile:** Change your display name and save. Verify the update persists on reload.
- [ ] **Address Book:** 
  - Add a new delivery address (e.g., Home, Work).
  - Update an existing address.
  - Set a specific address as the "Default" delivery address.
  - Delete an address.

---

## 2. The Restaurant/Vendor Flow (Business Journey)

### A. Business Registration & Auth
- [ ] **Vendor Sign Up:** Create a new account intended for a restaurant owner.
- [ ] **Workspace Creation:** Create a new Business Workspace. Ensure the workspace isolates this vendor's data from others.

### B. Restaurant Setup
- [ ] **Profile Setup:** Fill in the restaurant's details (Name, Short Description, Cuisine Type).
- [ ] **Image Uploads:** Upload a logo and cover image for the restaurant.
- [ ] **Operational Details:** Set delivery configurations (Free delivery toggles, ETA min/max minutes).

### C. Catalog & Menu Management
- [ ] **Create Categories:** Create menu categories (e.g., "Beverages", "Main Course").
- [ ] **Add Menu Items:** Create new food items.
  - *Test Case:* Ensure pricing, descriptions, and images save correctly.
  - *Test Case:* Toggle an item as "Featured" or "Popular" and verify it appears in the customer's feed.
  - *Test Case:* Mark an item as "Out of Stock" and verify it greys out on the customer app.

---

## 3. The Admin Flow (Platform Management)

### A. Core Management
- [ ] **Platform Categories:** Create global food categories (e.g., "Momo", "Coffee", "Pizza") that restaurants can tag themselves with.
- [ ] **Restaurant Approval:** (If implemented) Verify a newly registered restaurant appears in the admin dashboard and can be approved/activated for the public feed.
- [ ] **Promos & Banners:** Create a platform-wide Promo banner (e.g., "Free Delivery Week") and ensure it shows up dynamically on the customer home feed.

---

> **What's Next? (Orders & Cart)**
> The `Cart` and `Orders` backend modules appear to still be in active development or are handled separately. Once those are fully wired up, a 4th flow (The Checkout & Delivery Flow) will be added here!
