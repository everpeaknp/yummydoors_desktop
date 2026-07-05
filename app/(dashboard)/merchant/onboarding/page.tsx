"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, ChevronLeft, Store, Building2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { apiFetch } from "@/lib/http";
import { useAuthStore } from "@/stores/auth-store";
import { mapStoredUser } from "@/lib/auth-mappers";
import dynamic from "next/dynamic";

const MapPicker = dynamic(() => import("@/components/ui/map-picker"), { ssr: false });

function extractErrorMessage(payload: any) {
  if (typeof payload?.detail === "string" && payload.detail.trim()) {
    return payload.detail;
  }
  if (Array.isArray(payload?.detail) && payload.detail.length > 0) {
    return payload.detail.map((issue: { msg?: string }) => issue.msg).filter(Boolean).join(" ");
  }
  if (typeof payload?.message === "string" && payload.message.trim()) {
    return payload.message;
  }
  return "Something went wrong.";
}

export default function MerchantOnboardingWizard() {
  const router = useRouter();
  const { hydrated, accessToken, user } = useAuth();
  const setUser = useAuthStore((state) => state.setUser);
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [businessName, setBusinessName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  
  const [restaurantName, setRestaurantName] = useState("");
  const [city, setCity] = useState("");
  const [area, setArea] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  // Pre-fill user data
  useEffect(() => {
    if (hydrated && user) {
      setContactName(user.fullName || "");
      setContactEmail(user.email || "");
      setContactPhone(user.phone || "");
      
      // If they already have an active merchant workspace, they shouldn't be here
      const merchantWorkspace = user.workspaces?.find(w => w.workspaceType === "merchant");
      if (merchantWorkspace && merchantWorkspace.status === "active") {
        router.replace("/merchant");
      }
    }
  }, [hydrated, user, router]);

  if (!hydrated || !accessToken) return null;

  async function handleNextStep() {
    setError(null);
    if (step === 1) {
      if (!businessName.trim() || !contactName.trim()) {
        setError("Business name and contact name are required.");
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!restaurantName.trim() || !city.trim() || !area.trim()) {
        setError("Restaurant name, city, and area are required.");
        return;
      }
      if (latitude === null || longitude === null) {
        setError("Please pin your restaurant's exact location on the map.");
        return;
      }
      setStep(3);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // 1. Create Application
      const appRes = await apiFetch("/merchant/applications", {
        method: "POST",
        auth: true,
        body: JSON.stringify({
          business_name: businessName.trim(),
          contact_name: contactName.trim(),
          contact_email: contactEmail.trim() || null,
          contact_phone: contactPhone.trim() || null,
        }),
      });
      const appPayload = await appRes.json();
      if (!appRes.ok) throw new Error(extractErrorMessage(appPayload));
      const applicationId = appPayload.data.id;

      // 2. Create Restaurant Request
      const reqRes = await apiFetch(`/merchant/applications/${applicationId}/restaurant-requests`, {
        method: "POST",
        auth: true,
        body: JSON.stringify({
          request_type: "create_external",
          requested_name: restaurantName.trim(),
          city: city.trim(),
          area: area.trim(),
          latitude: latitude,
          longitude: longitude,
        }),
      });
      if (!reqRes.ok) throw new Error(extractErrorMessage(await reqRes.json()));

      // 3. Submit Application
      const submitRes = await apiFetch(`/merchant/applications/${applicationId}/submit`, {
        method: "POST",
        auth: true,
        body: JSON.stringify({}),
      });
      if (!submitRes.ok) throw new Error(extractErrorMessage(await submitRes.json()));

      // 4. Refresh User to get the new workspace in their JWT/State
      const userRes = await apiFetch("/auth/me", { auth: true });
      if (userRes.ok) {
        const userPayload = await userRes.json();
        setUser(mapStoredUser(userPayload.data));
      }

      // 5. Success! Route to merchant dashboard
      router.replace("/merchant");

    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to set up business.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#faf7f2] flex flex-col items-center justify-center p-6 selection:bg-primary selection:text-white">
      <div className="w-full max-w-2xl bg-white rounded-[2rem] shadow-[0_24px_80px_rgba(15,23,42,0.06)] border border-[#efe4d8] overflow-hidden relative">
        
        {/* Progress Header */}
        <div className="bg-[#fcfaf7] border-b border-[#eee4d7] px-8 py-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary">Onboarding</span>
            <span className="text-sm font-semibold text-gray-500">Step {step} of 3</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5 mt-4 overflow-hidden">
            <div 
              className="bg-primary h-1.5 rounded-full transition-all duration-500 ease-in-out" 
              style={{ width: `${(step / 3) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Form Body */}
        <div className="px-8 py-10">
          <form onSubmit={handleSubmit} className="min-h-[300px] flex flex-col justify-between">
            
            {/* STEP 1 */}
            {step === 1 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Your Business Profile</h2>
                    <p className="text-gray-500 text-sm mt-1">Let&apos;s start with the company details.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-semibold text-gray-700 block mb-2">Legal Business Name</label>
                    <Input 
                      value={businessName} 
                      onChange={e => setBusinessName(e.target.value)} 
                      placeholder="e.g. Yummy Foods LLC" 
                      className="h-12 bg-gray-50/50"
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm font-semibold text-gray-700 block mb-2">Manager / Contact Name</label>
                    <Input 
                      value={contactName} 
                      onChange={e => setContactName(e.target.value)} 
                      placeholder="Full name" 
                      className="h-12 bg-gray-50/50"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-semibold text-gray-700 block mb-2">Contact Email (Optional)</label>
                      <Input 
                        value={contactEmail} 
                        onChange={e => setContactEmail(e.target.value)} 
                        type="email"
                        placeholder="email@example.com" 
                        className="h-12 bg-gray-50/50"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-gray-700 block mb-2">Contact Phone (Optional)</label>
                      <Input 
                        value={contactPhone} 
                        onChange={e => setContactPhone(e.target.value)} 
                        placeholder="+977..." 
                        className="h-12 bg-gray-50/50"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2 */}
            {step === 2 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Store className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Your First Restaurant</h2>
                    <p className="text-gray-500 text-sm mt-1">What is the public name and location?</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-semibold text-gray-700 block mb-2">Restaurant Name</label>
                    <Input 
                      value={restaurantName} 
                      onChange={e => setRestaurantName(e.target.value)} 
                      placeholder="e.g. Yummy Momo House" 
                      className="h-12 bg-gray-50/50"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-semibold text-gray-700 block mb-2">City</label>
                      <Input 
                        value={city} 
                        onChange={e => setCity(e.target.value)} 
                        onBlur={async () => {
                          if (city && area) {
                            const geocoder = new window.google.maps.Geocoder();
                            geocoder.geocode({ address: `${area}, ${city}, Nepal` }, (results, status) => {
                              if (status === "OK" && results && results[0]) {
                                setLatitude(results[0].geometry.location.lat());
                                setLongitude(results[0].geometry.location.lng());
                              }
                            });
                          }
                        }}
                        placeholder="e.g. Pokhara" 
                        className="h-12 bg-gray-50/50"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-gray-700 block mb-2">Area / Street</label>
                      <Input 
                        value={area} 
                        onChange={e => setArea(e.target.value)} 
                        onBlur={async () => {
                          if (city && area) {
                            const geocoder = new window.google.maps.Geocoder();
                            geocoder.geocode({ address: `${area}, ${city}, Nepal` }, (results, status) => {
                              if (status === "OK" && results && results[0]) {
                                setLatitude(results[0].geometry.location.lat());
                                setLongitude(results[0].geometry.location.lng());
                              }
                            });
                          }
                        }}
                        placeholder="e.g. Lakeside" 
                        className="h-12 bg-gray-50/50"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-semibold text-gray-700 block mb-2">Latitude</label>
                      <Input 
                        value={latitude !== null ? latitude.toFixed(6) : ""} 
                        readOnly
                        placeholder="e.g. 28.2096" 
                        className="h-12 bg-gray-100 text-gray-500 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-gray-700 block mb-2">Longitude</label>
                      <Input 
                        value={longitude !== null ? longitude.toFixed(6) : ""} 
                        readOnly
                        placeholder="e.g. 83.9856" 
                        className="h-12 bg-gray-100 text-gray-500 cursor-not-allowed"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-gray-700 block mb-2">Pin Exact Location (Drag pin or tap map to set location)</label>
                    <MapPicker 
                      latitude={latitude}
                      longitude={longitude}
                      onChange={async (lat, lng) => {
                        setLatitude(lat);
                        setLongitude(lng);
                        try {
                          const geocoder = new window.google.maps.Geocoder();
                          geocoder.geocode({ location: { lat, lng }, language: 'en' }, (results, status) => {
                            console.log("Geocoder status:", status, "Results:", results);
                            
                            if (status === "OK" && results && results.length > 0) {
                              let foundCity = "";
                              let foundArea = "";

                              // 1. Find the city by checking all results
                              for (const res of results) {
                                const cityComp = res.address_components.find((c: any) => 
                                  c.types.includes("locality") || c.types.includes("administrative_area_level_2")
                                );
                                if (cityComp) {
                                  foundCity = cityComp.long_name;
                                  break;
                                }
                              }

                              // 2. Find the exact street/area
                              // Google sometimes forgets to tag plus codes with "plus_code", so we check if the first part looks like "6X5P+V62"
                              const exactResult = results.find(res => {
                                if (res.types.includes("plus_code")) return false;
                                const firstPart = res.formatted_address.split(",")[0];
                                // Check if it's a Plus Code (e.g., contains a '+' and is short, like '6X5P+V62')
                                if (firstPart.includes("+") && firstPart.length <= 15) return false;
                                return true;
                              });
                              
                              if (exactResult) {
                                // Split by comma and take the first part (e.g., "City Bus Stand", "Nayabazar Rd")
                                foundArea = exactResult.formatted_address.split(",")[0];
                              }

                              if (foundCity) setCity(foundCity);
                              if (foundArea && foundArea !== foundCity) setArea(foundArea);
                            } else {
                              console.error("Geocoder failed due to:", status);
                            }
                          });
                        } catch (err) {
                          console.error("Geocoding failed", err);
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3 */}
            {step === 3 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Ready to launch!</h2>
                    <p className="text-gray-500 text-sm mt-1">Please review your details before submitting.</p>
                  </div>
                </div>

                <div className="bg-[#fcfaf7] border border-[#eee4d7] rounded-[1.5rem] p-6 space-y-4">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Business Identity</p>
                    <p className="font-semibold text-gray-800 mt-1">{businessName}</p>
                    <p className="text-sm text-gray-500">{contactName}</p>
                  </div>
                  <div className="h-px bg-gray-200"></div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Restaurant Profile</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Store className="w-4 h-4 text-primary" />
                      <p className="font-semibold text-gray-800">{restaurantName}</p>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <p className="text-sm text-gray-500">{area}, {city}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Footer / Controls */}
            <div className="mt-10 flex items-center justify-between">
              {step > 1 ? (
                <Button 
                  type="button" 
                  variant="ghost" 
                  onClick={() => setStep(step - 1)}
                  disabled={loading}
                  className="text-gray-500 hover:text-gray-900 font-semibold"
                >
                  <ChevronLeft className="w-4 h-4 mr-2" /> Back
                </Button>
              ) : <div></div>}

              {error && (
                <p className="text-red-500 text-sm font-medium animate-in fade-in">{error}</p>
              )}

              {step < 3 ? (
                <Button 
                  type="button" 
                  onClick={handleNextStep}
                  className="bg-gray-900 text-white rounded-full px-8 hover:bg-gray-800 h-12"
                >
                  Next <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button 
                  type="submit" 
                  disabled={loading}
                  className="bg-primary text-white rounded-full px-8 hover:bg-primary/90 h-12 min-w-[140px]"
                >
                  {loading ? "Creating..." : "Launch Business"}
                </Button>
              )}
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}
