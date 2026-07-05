import sys

file_path = "app/(dashboard)/merchant/page.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

# Find the start of the return statement (around line 491)
start_idx = -1
for i, line in enumerate(lines):
    if "return (" in line and "min-h-screen" in lines[i+1]:
        start_idx = i
        break

if start_idx == -1:
    print("Could not find start index")
    sys.exit(1)

# Keep the top part of the file
new_lines = lines[:start_idx]

# Append the new branched render logic
new_render = """  return (
    <div className="min-h-screen bg-[#faf7f2] text-gray-800 antialiased pb-20">
      <SiteNavbar className="sticky top-0 z-50 bg-white/85 backdrop-blur-xl" />

      {hasApprovedMerchant ? (
        <main>
          {/* Dashboard Header */}
          <section className="bg-white border-b border-[#efe4d8] py-12 lg:py-16">
            <div className="mx-auto w-full max-w-7xl px-6 lg:px-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.32em] text-primary mb-3">Merchant Dashboard</p>
                <h1 className="text-3xl font-semibold tracking-tight text-[#1f2937] md:text-4xl">
                  Welcome back, {contactName || "Partner"}
                </h1>
                <p className="mt-2 text-sm text-[#6b7280]">
                  Manage your restaurant presence, menus, and promotions.
                </p>
              </div>
              
              {/* Active Restaurant Selector */}
              {merchantRestaurants.items.length > 0 && (
                <div className="md:min-w-[280px]">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#6b7280] mb-2">Operating Context</p>
                  <select
                    value={activeRestaurant?.id || ""}
                    onChange={(e) => handleRestaurantSwitch(Number(e.target.value))}
                    disabled={switchingRestaurantId !== null}
                    className="w-full rounded-xl border border-[#efe4d8] bg-[#fcfaf7] px-4 py-3 text-sm font-semibold text-[#1f2937] outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50"
                  >
                    <option value="" disabled>Select a restaurant</option>
                    {merchantRestaurants.items.map((restaurant) => (
                      <option key={restaurant.id} value={restaurant.id}>
                        {restaurant.name} {restaurant.city ? `• ${restaurant.city}` : ""}
                      </option>
                    ))}
                  </select>
                  {switchingRestaurantId && <p className="text-xs text-primary mt-2">Switching context...</p>}
                </div>
              )}
            </div>
          </section>

          <div className="mx-auto w-full max-w-7xl px-6 py-12 lg:px-10 space-y-8">
            {error ? (
              <div className="rounded-[18px] border border-[#ffd8cc] bg-[#fff4ef] px-5 py-4 text-sm text-[#9a3412]">
                {error}
              </div>
            ) : null}

            {success ? (
              <div className="rounded-[18px] border border-[#d4f3db] bg-[#f3fff6] px-5 py-4 text-sm text-[#166534]">
                {success}
              </div>
            ) : null}

            {loading ? (
              <div className="rounded-[24px] border border-[#f0e7dd] bg-white px-6 py-8 text-sm text-[#7a7a7a] shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
                Loading merchant context...
              </div>
            ) : null}

            {!activeRestaurant && merchantRestaurants.items.length > 0 ? (
              <div className="rounded-[28px] border border-primary/20 bg-[#fff4ec] p-10 text-center">
                <Store className="w-12 h-12 text-primary/40 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-[#1f2937]">Select a restaurant to manage</h3>
                <p className="mt-2 text-[#ea580c]">Use the dropdown in the header to enter a restaurant context.</p>
              </div>
            ) : !activeRestaurant && merchantRestaurants.items.length === 0 ? (
              <div className="rounded-[28px] border border-[#efe4d8] bg-white p-10 text-center shadow-sm">
                <h3 className="text-xl font-bold text-[#1f2937]">Pending Restaurant Creation</h3>
                <p className="mt-2 text-[#6b7280]">Your application is approved, but the restaurant hasn't been fully linked yet. Contact support.</p>
              </div>
            ) : (
              <Card className="rounded-[28px] border border-[#efe4d8] bg-white shadow-[0_24px_70px_rgba(15,23,42,0.06)] overflow-hidden">
                <CardContent className="p-0">
                  <div className="border-b border-[#f2e8de] px-7 py-6 bg-[#fcfaf7]">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-white border border-[#efe4d8] rounded-2xl flex items-center justify-center">
                        <Store className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-[#1f2937]">{activeRestaurant?.name}</h2>
                        <p className="text-sm text-[#6b7280]">
                          {[activeRestaurant?.city, activeRestaurant?.area].filter(Boolean).join(" • ")}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-px bg-[#f2e8de] md:grid-cols-2 lg:grid-cols-4">
                    {[
                      {
                        href: "/restaurants",
                        icon: Store,
                        title: "Restaurant presence",
                        description: "Review what is live in the customer-facing restaurant feed.",
                      },
                      {
                        href: "/categories",
                        icon: Layers3,
                        title: "Category structure",
                        description: "Shape how menus and discovery are grouped across restaurants.",
                      },
                      {
                        href: "/menu-items",
                        icon: PanelTop,
                        title: "Menu catalog",
                        description: "Use the current catalog area as the starting point for merchant controls.",
                      },
                      {
                        href: "/promos",
                        icon: Link2,
                        title: "Promos and merchandising",
                        description: "Push offers, banners, and featured placements that reach the homepage.",
                      },
                    ].map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className="group bg-white p-7 transition hover:bg-[#fcfaf7]"
                        >
                          <div className="flex items-center justify-between mb-4">
                            <div className="w-10 h-10 rounded-xl bg-[#fff4ec] flex items-center justify-center">
                              <Icon className="h-5 w-5 text-primary" />
                            </div>
                            <ArrowRight className="h-4 w-4 text-[#c58f6d] transition group-hover:translate-x-1" />
                          </div>
                          <h3 className="text-lg font-semibold text-[#1f2937]">{item.title}</h3>
                          <p className="mt-2 text-sm leading-6 text-[#6b7280]">{item.description}</p>
                        </Link>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      ) : (
        <React.Fragment>
          <section className="relative isolate overflow-hidden">
            <div className="absolute inset-0">
              <img
                src="https://images.unsplash.com/photo-1552566626-52f8b828add9?q=80&w=1800&auto=format&fit=crop"
                alt="Restaurant operations"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-[#0f172acc]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.3),transparent_35%)]" />
            </div>

            <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-10 px-6 py-20 lg:px-10 lg:py-24">
              <div className="max-w-3xl">
                <p className="mb-4 text-xs font-bold uppercase tracking-[0.32em] text-[#ffb085]">
                  Merchant Mode
                </p>
                <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-white md:text-5xl">
                  One YummyDoors account. Customer first, merchant when you are ready.
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-8 text-white/80 md:text-lg">
                  This is the shared business surface inside the same YummyDoors identity. Start a
                  restaurant, claim one that already exists, or request POS-linked access without leaving
                  the product ecosystem.
                </p>
              </div>

              <div className="grid gap-4 lg:grid-cols-2 max-w-2xl">
                <div className="rounded-[20px] border border-white/10 bg-white/10 px-5 py-5 text-white backdrop-blur">
                  <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#ffb085]">Merchant workspace</p>
                  <h2 className="mt-3 text-2xl font-semibold">
                    {merchantWorkspace?.name ?? "Not created yet"}
                  </h2>
                  <p className="mt-2 text-sm text-white/70">
                    {merchantWorkspace ? formatStatus(merchantWorkspace.status) : "Open your first business request"}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <main className="bg-[#faf7f2] pb-20">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-12 lg:px-10">
              {error ? (
                <div className="rounded-[18px] border border-[#ffd8cc] bg-[#fff4ef] px-5 py-4 text-sm text-[#9a3412]">
                  {error}
                </div>
              ) : null}

              {success ? (
                <div className="rounded-[18px] border border-[#d4f3db] bg-[#f3fff6] px-5 py-4 text-sm text-[#166534]">
                  {success}
                </div>
              ) : null}

              {loading ? (
                <div className="rounded-[24px] border border-[#f0e7dd] bg-white px-6 py-8 text-sm text-[#7a7a7a] shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
                  Loading merchant context...
                </div>
              ) : null}

              <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                <Card className="overflow-hidden rounded-[28px] border border-[#efe4d8] bg-white shadow-[0_24px_70px_rgba(15,23,42,0.06)]">
                  <CardContent className="p-0">
                    <div className="border-b border-[#f2e8de] px-7 py-6">
                      <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary">Request Paths</p>
                      <h2 className="mt-3 text-[30px] font-semibold tracking-tight text-[#1f2937]">
                        Build your restaurant presence the right way.
                      </h2>
                      <p className="mt-3 max-w-2xl text-sm leading-7 text-[#6b7280]">
                        Each request path maps to a different backend workflow, but all of them stay under
                        the same merchant identity and workspace.
                      </p>
                    </div>

                    <div className="grid gap-4 px-7 py-7 md:grid-cols-3">
                      {requestTypeCards.map((card) => (
                        <button
                          key={card.type}
                          type="button"
                          onClick={() => setRequestType(card.type)}
                          className={`rounded-[22px] border px-5 py-5 text-left transition ${
                            requestType === card.type
                              ? "border-primary bg-[#fff4ec] shadow-[0_14px_36px_rgba(249,115,22,0.12)]"
                              : "border-[#eee4d7] bg-[#fcfaf7] hover:border-[#ffd5bf]"
                          }`}
                        >
                          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">
                            {card.eyebrow}
                          </p>
                          <h3 className="mt-3 text-lg font-semibold text-[#1f2937]">{card.title}</h3>
                          <p className="mt-3 text-sm leading-7 text-[#6b7280]">{card.description}</p>
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-[28px] border border-[#efe4d8] bg-white shadow-[0_24px_70px_rgba(15,23,42,0.06)]">
                  <CardContent className="space-y-5 p-7">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary">Application state</p>
                      <h2 className="mt-3 text-2xl font-semibold text-[#1f2937]">
                        {latestApplication ? latestApplication.business_name : "No merchant application yet"}
                      </h2>
                      <p className="mt-2 text-sm leading-7 text-[#6b7280]">
                        {latestApplication
                          ? `Latest status: ${formatStatus(latestApplication.status)}`
                          : "Open a request below to create the first merchant application."}
                      </p>
                    </div>

                    {latestApplication ? (
                      <div className="rounded-[22px] border border-[#f3e8dd] bg-[#fcfaf7] px-5 py-5">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
                            {formatStatus(latestApplication.status)}
                          </span>
                          {latestApplication.workspace ? (
                            <span className="rounded-full border border-[#eadfce] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6b7280]">
                              {latestApplication.workspace.name}
                            </span>
                          ) : null}
                        </div>
                        {latestApplication.admin_notes ? (
                          <div className="mt-4 rounded-[18px] border border-[#ffe2cf] bg-[#fff6f0] px-4 py-4 text-sm leading-7 text-[#9a3412]">
                            <div className="mb-2 flex items-center gap-2 font-medium">
                              <CircleAlert className="h-4 w-4" />
                              Ops/admin notes
                            </div>
                            {latestApplication.admin_notes}
                          </div>
                        ) : null}
                        <div className="mt-4 space-y-3">
                          {latestApplication.restaurant_requests.map((request) => (
                            <div
                              key={request.id}
                              className="rounded-[18px] border border-[#eadfce] bg-white px-4 py-4"
                            >
                              <div className="flex flex-wrap items-center gap-3">
                                <span className="text-sm font-semibold text-[#1f2937]">{request.requested_name}</span>
                                <span className="rounded-full bg-[#fcfaf7] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#6b7280]">
                                  {requestTypeMeta(request.request_type).label}
                                </span>
                                <span className="rounded-full bg-[#fff4ec] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                                  {formatStatus(request.status)}
                                </span>
                              </div>
                              <p className="mt-2 text-sm text-[#6b7280]">
                                {[request.city, request.area].filter(Boolean).join(" • ") || "No location attached"}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              </section>

              {!activeApplication ? (
                <Card className="rounded-[28px] border border-[#efe4d8] bg-white shadow-[0_24px_70px_rgba(15,23,42,0.06)]">
                  <CardContent className="grid gap-8 p-0 lg:grid-cols-[0.9fr_1.1fr]">
                    <div className="border-b border-[#f2e8de] bg-[#fcfaf7] px-7 py-8 lg:border-b-0 lg:border-r">
                      <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary">
                        {selectedRequestMeta.label}
                      </p>
                      <h2 className="mt-3 text-[30px] font-semibold tracking-tight text-[#1f2937]">
                        {selectedRequestMeta.title}
                      </h2>
                      <p className="mt-4 text-sm leading-7 text-[#6b7280]">
                        {selectedRequestMeta.description}
                      </p>
                      <div className="mt-8 space-y-3">
                        <div className="rounded-[20px] border border-[#efe4d8] bg-white px-5 py-4 text-sm leading-7 text-[#6b7280]">
                          We create one merchant application, attach the selected request type, and submit it for review.
                        </div>
                        <div className="rounded-[20px] border border-[#efe4d8] bg-white px-5 py-4 text-sm leading-7 text-[#6b7280]">
                          Approved merchants can still open new expansion requests later without creating a second identity.
                        </div>
                      </div>
                    </div>

                    <form className="space-y-5 px-7 py-8" onSubmit={handleRequestSubmit}>
                      <div className="grid gap-5 md:grid-cols-2">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-[#1f2937]">Business name</label>
                          <Input value={businessName} onChange={(event) => setBusinessName(event.target.value)} placeholder="Yummy Hospitality Pvt. Ltd." />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-[#1f2937]">Contact name</label>
                          <Input value={contactName} onChange={(event) => setContactName(event.target.value)} placeholder="Ramon Tiwari" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-[#1f2937]">Contact email</label>
                          <Input type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} placeholder="owner@restaurant.com" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-[#1f2937]">Contact phone</label>
                          <Input value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} placeholder="+97798XXXXXXXX" />
                        </div>
                      </div>

                      {requestType === "create_external" ? (
                        <div className="grid gap-5 md:grid-cols-3">
                          <div className="space-y-2 md:col-span-3">
                            <label className="text-sm font-medium text-[#1f2937]">Restaurant name</label>
                            <Input value={restaurantName} onChange={(event) => setRestaurantName(event.target.value)} placeholder="Yummy Momo House" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-[#1f2937]">City</label>
                            <Input value={city} onChange={(event) => setCity(event.target.value)} placeholder="Pokhara" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-[#1f2937]">Area</label>
                            <Input value={area} onChange={(event) => setArea(event.target.value)} placeholder="Lakeside" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-[#1f2937]">Notes</label>
                            <Input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Anything ops should know before launch" />
                          </div>
                        </div>
                      ) : null}

                      {requestType === "claim_existing" ? (
                        <div className="space-y-5">
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-[#1f2937]">Restaurant to claim</label>
                            <select
                              value={selectedRestaurantId}
                              onChange={(event) => setSelectedRestaurantId(event.target.value)}
                              className="flex h-12 w-full rounded-xl border border-input bg-white px-4 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
                            >
                              <option value="">Choose a restaurant</option>
                              {claimableRestaurants.map((restaurant) => (
                                <option key={restaurant.id} value={restaurant.id}>
                                  {restaurant.name} {restaurant.city ? `• ${restaurant.city}` : ""}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-[#1f2937]">Notes</label>
                            <Input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Explain why this restaurant should be attached to your merchant account" />
                          </div>
                        </div>
                      ) : null}

                      {requestType === "pos_link" ? (
                        <div className="space-y-5">
                          <div className="grid gap-5 md:grid-cols-2">
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-[#1f2937]">Restaurant in YummyDoors</label>
                              <select
                                value={selectedRestaurantId}
                                onChange={(event) => setSelectedRestaurantId(event.target.value)}
                                className="flex h-12 w-full rounded-xl border border-input bg-white px-4 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
                              >
                                <option value="">Choose a restaurant</option>
                                {claimableRestaurants.map((restaurant) => (
                                  <option key={restaurant.id} value={restaurant.id}>
                                    {restaurant.name} {restaurant.city ? `• ${restaurant.city}` : ""}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-[#1f2937]">Matched POS identity</label>
                              <select
                                value={selectedPosRestaurantId}
                                onChange={(event) => setSelectedPosRestaurantId(event.target.value)}
                                className="flex h-12 w-full rounded-xl border border-input bg-white px-4 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
                              >
                                <option value="">Choose a POS restaurant</option>
                                {posMatchedRestaurants.map((restaurant) => (
                                  <option key={restaurant.posRestaurantId} value={restaurant.posRestaurantId}>
                                    {restaurant.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-[#1f2937]">Notes</label>
                            <Input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Describe the POS ownership or admin relationship to speed up review" />
                          </div>
                          {posMatchedRestaurants.length === 0 ? (
                            <div className="rounded-[18px] border border-[#ffe2cf] bg-[#fff7f1] px-4 py-4 text-sm leading-7 text-[#9a3412]">
                              No POS restaurant matches were found on this account yet. That usually means the
                              current user is not linked to a matching Yummy POS identity by email.
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="flex items-center justify-between gap-4 pt-2">
                        <p className="text-sm text-[#6b7280]">
                          This will submit a {selectedRequestMeta.label.toLowerCase()} request to ops/admin.
                        </p>
                        <Button className="rounded-full px-6" disabled={submitting} type="submit">
                          {submitting ? "Submitting..." : "Submit request"}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              ) : (
                <Card className="rounded-[28px] border border-[#efe4d8] bg-white shadow-[0_24px_70px_rgba(15,23,42,0.06)]">
                  <CardContent className="space-y-4 p-7">
                    <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary">Open review</p>
                    <h2 className="text-[28px] font-semibold tracking-tight text-[#1f2937]">
                      You already have an active merchant review running.
                    </h2>
                    <p className="max-w-3xl text-sm leading-7 text-[#6b7280]">
                      We only allow one open merchant application at a time so the ops and ownership flow
                      stays clean. Once this one is approved or rejected, you can open the next restaurant
                      request from the same workspace.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </main>
        </React.Fragment>
      )}
    </div>
  );
}
"""

with open(file_path, "w", encoding="utf-8") as f:
    f.writelines(new_lines)
    f.write(new_render)

print("Successfully replaced render logic!")
