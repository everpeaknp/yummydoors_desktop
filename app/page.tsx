"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Search, MapPin, Star, ArrowRight, Instagram, Twitter, Facebook } from "lucide-react";
import { apiFetch } from "@/lib/http";
import { useAuth } from "@/hooks/use-auth";
import { useAuthStore } from "@/stores/auth-store";

function useDraggableScroll() {
  const ref = useRef<HTMLDivElement>(null);
  const [isDown, setIsDown] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const onMouseDown = (e: React.MouseEvent) => {
    if (!ref.current) return;
    setIsDown(true);
    setStartX(e.pageX - ref.current.offsetLeft);
    setScrollLeft(ref.current.scrollLeft);
  };
  const onMouseLeave = () => setIsDown(false);
  const onMouseUp = () => setIsDown(false);
  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDown || !ref.current) return;
    e.preventDefault();
    const x = e.pageX - ref.current.offsetLeft;
    const walk = (x - startX) * 2;
    ref.current.scrollLeft = scrollLeft - walk;
  };

  const scrollRight = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (ref.current) {
      ref.current.scrollBy({ left: 350, behavior: 'smooth' });
    }
  };

  const scrollPrev = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (ref.current) {
      ref.current.scrollBy({ left: -350, behavior: 'smooth' });
    }
  };

  return { 
    ref, 
    events: { onMouseDown, onMouseLeave, onMouseUp, onMouseMove }, 
    scrollRight,
    scrollPrev,
    isDragging: isDown
  };
}

export default function LandingPage() {
  const { hydrated, accessToken } = useAuth();
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const [feed, setFeed] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const lastLoadKeyRef = useRef<string | null>(null);

  const catScroll = useDraggableScroll();
  const restScroll = useDraggableScroll();

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    const loadKey = accessToken ? "auth" : "guest";
    if (lastLoadKeyRef.current === loadKey) {
      return;
    }
    lastLoadKeyRef.current = loadKey;

    let cancelled = false;

    async function loadData() {
      try {
        const feedRes = await apiFetch("/home/feed?latitude=28.2096&longitude=83.9856", {
          auth: Boolean(accessToken),
        });
        if (feedRes.ok) {
           const feedPayload = await feedRes.json();
           if (!cancelled) {
             setFeed(feedPayload.data);
           }
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void loadData();

    return () => {
      cancelled = true;
    };
  }, [hydrated, accessToken]);

  const dummyCategories = [
    { slug: 'pizza', name: 'Pizza', icon_url: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop' },
    { slug: 'japanese', name: 'Japanese', icon_url: 'https://images.unsplash.com/photo-1611143669185-af224c5e3252?q=80&w=400&auto=format&fit=crop' },
    { slug: 'burghers', name: 'Burghers', icon_url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=400&auto=format&fit=crop' },
    { slug: 'vegetarian', name: 'Vegetarian', icon_url: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=400&auto=format&fit=crop' },
    { slug: 'bakery', name: 'Bakery', icon_url: 'https://images.unsplash.com/photo-1486427944299-d1955d23e34d?q=80&w=400&auto=format&fit=crop' },
    { slug: 'chinese', name: 'Chinese', icon_url: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?q=80&w=400&auto=format&fit=crop' },
    { slug: 'mexican', name: 'Mexican', icon_url: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?q=80&w=400&auto=format&fit=crop' },
  ];
  const dummyRestaurants = [
    { slug: 'da-alfredo', name: 'Da Alfredo', city: 'Los Angeles', cover_image_url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=600&auto=format&fit=crop', primary_cuisine_label: 'Italian', has_free_delivery: true, rating_average: '4.8' },
    { slug: 'best-burghers', name: 'Best Burghers', city: 'Los Angeles', cover_image_url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=600&auto=format&fit=crop', primary_cuisine_label: 'American', has_free_delivery: false, rating_average: '4.6' },
    { slug: 'china-town', name: 'China Town', city: 'Los Angeles', cover_image_url: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?q=80&w=600&auto=format&fit=crop', primary_cuisine_label: 'Chinese', has_free_delivery: true, rating_average: '4.5' },
    { slug: 'sushi-bar', name: 'Sushi Bar', city: 'Los Angeles', cover_image_url: 'https://images.unsplash.com/photo-1611143669185-af224c5e3252?q=80&w=600&auto=format&fit=crop', primary_cuisine_label: 'Japanese', has_free_delivery: false, rating_average: '4.9' },
    { slug: 'la-mexicana', name: 'La Mexicana', city: 'Los Angeles', cover_image_url: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?q=80&w=600&auto=format&fit=crop', primary_cuisine_label: 'Mexican', has_free_delivery: true, rating_average: '4.7' },
  ];
  const rawCats = feed?.categories?.length ? feed.categories : dummyCategories;
  const rawRests = feed?.restaurants?.length ? feed.restaurants : dummyRestaurants;
  const safeCategories = [...rawCats, ...rawCats, ...rawCats];
  const safeRestaurants = [...rawRests, ...rawRests, ...rawRests];
  const authReady = hydrated;

  return (
    <div className="min-h-screen bg-white text-gray-800 font-sans antialiased overflow-x-hidden selection:bg-primary selection:text-white">
      <section className="relative flex min-h-[600px] lg:min-h-[700px] flex-col items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src="https://images.unsplash.com/photo-1543353071-10c8ba85a904?q=80&w=2000&auto=format&fit=crop" alt="Friends eating" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gray-900/50" />
        </div>
        
        <div className="absolute bottom-0 left-0 right-0 z-10 w-full overflow-hidden leading-none">
          <svg className="relative block w-full h-[60px] md:h-[100px]" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 120" preserveAspectRatio="none">
            <path d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V120H0V0C73.69,32.39,150.81,59.2,223.4,70.52Z" fill="#ffffff"></path>
          </svg>
        </div>

        <nav className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-6 lg:px-12 text-white">
          <div className="flex items-center gap-3 cursor-pointer">
            <div className="flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
            </div>
            <span className="text-2xl font-bold tracking-tight">YummyDoors</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm font-semibold">
            <Link href="/" className="hover:text-primary transition-colors">Home</Link>
            <Link href="/restaurants" className="hover:text-primary transition-colors">Restaurants</Link>
            {authReady && accessToken ? (
              <>
                <Link href="/profile" className="hover:text-primary transition-colors">Profile</Link>
                <button
                  type="button"
                  onClick={() => clearAuth()}
                  className="hover:text-primary transition-colors"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="hover:text-primary transition-colors">Sign in</Link>
                <Link href="/signup" className="rounded-full border border-white/30 px-4 py-2 text-white transition-colors hover:border-primary hover:text-primary">Create account</Link>
              </>
            )}
          </div>
        </nav>
        
        <div className="relative z-20 flex w-full max-w-3xl flex-col px-6 mt-10 md:mt-20">
          <h1 className="text-white mb-2" style={{fontSize:'42px', fontWeight:600, lineHeight:'42px'}}>
            Delivery or Takeaway Food
          </h1>
          <p className="text-white mb-10" style={{fontSize:'28px', fontWeight:300, lineHeight:'42px'}}>
            The best restaurants at the best price
          </p>

          <div className="w-full bg-white p-1 md:p-1.5 rounded-sm flex flex-col md:flex-row shadow-lg">
            <input 
              type="text" 
              placeholder="What are you looking for..." 
              className="flex-1 bg-transparent px-4 py-3 md:py-4 text-sm outline-none text-gray-700"
            />
            <button className="bg-primary text-white px-8 py-3 md:py-4 text-sm font-semibold rounded-sm hover:bg-primary/90 transition-colors whitespace-nowrap">
              Search
            </button>
          </div>
          
          <div className="mt-4 text-sm text-gray-300 font-light">
            Trending: <span className="font-medium text-white underline cursor-pointer hover:text-primary">Sushi</span>, <span className="font-medium text-white underline cursor-pointer hover:text-primary">Burger</span>, <span className="font-medium text-white underline cursor-pointer hover:text-primary">Chinese</span>, <span className="font-medium text-white underline cursor-pointer hover:text-primary">Pizza</span>
          </div>
        </div>
      </section>

      <main className="bg-white">
        {safeCategories.length > 0 && true && (
          <section className="pt-16 pb-12 overflow-hidden">
            <div className="text-center mb-10">
              <div className="w-[40px] h-[2px] bg-primary mx-auto mb-5"></div>
              <h2 className="text-[34px] font-medium text-[#222222] leading-[1.2]">Popular Categories</h2>
              <p className="text-[21px] font-light text-[#444444] mt-2 leading-[1.5]">Cum doctus civibus efficiantur in imperdiet deterruisset</p>
            </div>

            <div className="relative">
              <button 
                onClick={catScroll.scrollPrev}
                className="absolute top-[50%] left-[16px] -translate-y-1/2 h-[42px] w-[42px] rounded-full bg-white shadow-[0_2px_12px_rgba(0,0,0,0.12)] border border-gray-100 flex items-center justify-center text-gray-500 hover:text-primary transition-all z-50"
              >
                <ArrowRight className="w-[16px] h-[16px] rotate-180" strokeWidth={1.5} />
              </button>

              <div 
                ref={catScroll.ref}
                {...catScroll.events}
                className={`flex gap-[16px] overflow-x-auto pb-4 scrollbar-hide pl-[100px] pr-[80px] ${catScroll.isDragging ? 'cursor-grabbing select-none' : 'cursor-grab'}`} 
                style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}
              >
                {safeCategories.map((cat: any, i: number) => (
                  <div key={`${cat.slug}-${i}`} className="relative h-[280px] w-[195px] rounded-[4px] overflow-hidden shrink-0 pointer-events-none">
                    <img src={cat.icon_url || 'https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=400&auto=format&fit=crop'} alt={cat.name} className="h-full w-full object-cover" />
                    <div className="absolute inset-x-0 bottom-0 h-[120px] bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                    <div className="absolute top-[12px] right-[12px] bg-white text-[#333333] text-[11px] font-semibold w-[30px] h-[30px] rounded-full flex items-center justify-center shadow">
                      98
                    </div>
                    <div className="absolute bottom-[16px] left-[14px] right-[14px]">
                      <h3 className="text-[16px] font-semibold text-white leading-none mb-1">{cat.name}</h3>
                      <p className="text-[12px] text-[#cccccc] font-normal">Avg price $40</p>
                    </div>
                  </div>
                ))}
              </div>
              
              <button 
                onClick={catScroll.scrollRight}
                className="absolute top-[50%] right-[24px] -translate-y-1/2 h-[42px] w-[42px] rounded-full bg-white shadow-[0_2px_12px_rgba(0,0,0,0.12)] border border-gray-100 flex items-center justify-center text-gray-500 hover:text-primary transition-all z-50"
              >
                <ArrowRight className="w-[16px] h-[16px]" strokeWidth={1.5} />
              </button>
            </div>
            
            <style dangerouslySetInnerHTML={{__html: `.scrollbar-hide::-webkit-scrollbar { display: none; }`}} />
          </section>
        )}

        {safeRestaurants.length > 0 && true && (
          <section className="bg-gray-50/60 py-12">
            <div className="pl-[100px] pr-6 flex justify-between items-end mb-8 border-b border-gray-200 pb-5">
              <div>
                <div className="w-[40px] h-[2px] bg-primary mb-4"></div>
                <h2 className="text-[34px] font-medium text-[#222222] leading-[1.2]">Top Rated Restaurants</h2>
                <p className="text-[21px] font-light text-[#444444] mt-2 leading-[1.5]">Cum doctus civibus efficiantur in imperdiet deterruisset.</p>
              </div>
              <Link href="#" className="text-[13px] font-bold text-primary hover:text-gray-700 uppercase tracking-wider">View All</Link>
            </div>
            
            <div className="relative">
              <button 
                onClick={restScroll.scrollPrev}
                className="absolute top-[100px] left-[16px] h-[42px] w-[42px] rounded-full bg-white shadow-[0_2px_12px_rgba(0,0,0,0.12)] border border-gray-100 flex items-center justify-center text-gray-500 hover:text-primary transition-all z-50"
              >
                <ArrowRight className="w-[16px] h-[16px] rotate-180" strokeWidth={1.5} />
              </button>

              <div 
                ref={restScroll.ref}
                {...restScroll.events}
                className={`flex gap-[18px] overflow-x-auto pb-8 scrollbar-hide pl-[120px] ${restScroll.isDragging ? 'cursor-grabbing select-none' : 'cursor-grab'}`} 
                style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}
              >
                {safeRestaurants.map((r: any, i: number) => (
                  <div key={`${r.slug}-${i}`} className="shrink-0 w-[300px] bg-white border border-gray-200/60 rounded-[4px] overflow-hidden flex flex-col hover:shadow-lg transition-shadow duration-300 pointer-events-none">
                    <div className="relative h-[200px] w-full overflow-hidden bg-gray-100">
                      <img src={r.cover_image_url} alt={r.name} className="h-full w-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                      
                      <div className="absolute top-4 left-4 bg-white text-gray-800 text-[10px] font-bold px-2.5 py-1 rounded-[3px] shadow-sm uppercase tracking-wider flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                        {r.primary_cuisine_label}
                      </div>
                      
                      {r.has_free_delivery && (
                        <div className="absolute top-4 right-4 bg-primary text-white text-[10px] font-bold px-2.5 py-1 rounded-[3px] uppercase tracking-wider">
                          -30%
                        </div>
                      )}
                      
                      <div className="absolute bottom-4 left-4 right-4">
                        <h3 className="text-[17px] font-semibold text-white mb-0.5">{r.name}</h3>
                        <p className="text-[12px] text-gray-300">{r.city}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between px-4 py-3 bg-white">
                      <div className="flex items-center gap-3 text-[12px] text-gray-500">
                        <span className="flex items-center gap-1 pointer-events-auto">
                          <svg className="w-[13px] h-[13px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg> Take away
                        </span>
                        <span className="flex items-center gap-1 pointer-events-auto">
                          <svg className="w-[13px] h-[13px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> Delivery
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-[12px] font-bold text-[#32a067]">
                        <Star className="w-[13px] h-[13px] fill-[#32a067]" /> {r.rating_average}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <button 
                onClick={restScroll.scrollRight}
                className="absolute top-[100px] right-6 h-[44px] w-[44px] rounded-full bg-white shadow-[0_4px_16px_rgba(0,0,0,0.12)] border border-gray-100 flex items-center justify-center text-gray-500 hover:text-primary transition-all z-50"
              >
                <ArrowRight className="w-[18px] h-[18px]" strokeWidth={1.5} />
              </button>
            </div>
          </section>
        )}

        <div className="mx-auto max-w-6xl px-6">
        <section className="py-16 grid lg:grid-cols-2 gap-12 items-center">
          <div className="grid grid-cols-2 gap-5 items-start">
            <div className="flex flex-col gap-5">
              <div className="bg-white rounded-[4px] shadow-[0_0_30px_rgba(0,0,0,0.08)] p-6 text-center">
                <figure className="flex justify-center mb-4">
                  <img src="https://ansonika.com/fooyes/img/how_1.svg" alt="Easily Order" width="150" height="167" className="object-contain" />
                </figure>
                <h3 className="text-[15px] font-semibold text-[#333333] mb-2">Easly Order</h3>
                <p className="text-[13px] text-[#777777] leading-relaxed">Faucibus ante, in porttitor tellus blandit et. Phasellus tincidunt metus lectus sollicitudin.</p>
              </div>
              <div className="bg-white rounded-[4px] shadow-[0_0_30px_rgba(0,0,0,0.08)] p-6 text-center">
                <figure className="flex justify-center mb-4">
                  <img src="https://ansonika.com/fooyes/img/how_2.svg" alt="Quick Delivery" width="130" height="145" className="object-contain" />
                </figure>
                <h3 className="text-[15px] font-semibold text-[#333333] mb-2">Quick Delivery</h3>
                <p className="text-[13px] text-[#777777] leading-relaxed">Maecenas pulvinar, risus in facilisis dignissim, quam nisi hendrerit nulla, id vestibulum.</p>
              </div>
            </div>

            <div className="flex items-center self-center">
              <div className="bg-white rounded-[4px] shadow-[0_0_30px_rgba(0,0,0,0.08)] p-6 text-center w-full">
                <figure className="flex justify-center mb-4">
                  <img src="https://ansonika.com/fooyes/img/how_3.svg" alt="Enjoy Food" width="150" height="132" className="object-contain" />
                </figure>
                <h3 className="text-[15px] font-semibold text-[#333333] mb-2">Enjoy Food</h3>
                <p className="text-[13px] text-[#777777] leading-relaxed">Morbi convallis bibendum urna ut viverra. Maecenas quis consequat libero, a feugiat eros.</p>
              </div>
            </div>
          </div>

          <div className="lg:pl-8">
            <div className="mb-5">
              <div className="w-[40px] h-[2px] bg-primary mb-4"></div>
              <h2 className="text-[28px] md:text-[32px] font-bold text-[#222222] leading-tight">Start Ordering Now</h2>
            </div>
            <p className="text-[17px] text-[#555555] leading-relaxed mb-4">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed imperdiet libero id nisi euismod, sed porta est consectetur deserunt.
            </p>
            <p className="text-[14px] text-[#777777] leading-relaxed mb-8">
              Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
            </p>
            <button className="bg-primary text-white px-8 py-3 text-[14px] font-semibold rounded-[4px] hover:bg-primary/90 transition-all shadow-md shadow-primary/20">
              Register
            </button>
          </div>
        </section>
        </div>
      </main>

      <footer className="relative bg-[#FCFBF4] pt-24 pb-10 mt-10">
        <div className="absolute top-0 left-0 right-0 w-full overflow-hidden leading-none transform -translate-y-[99%]">
          <svg className="relative block w-full h-[40px] md:h-[60px]" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 120" preserveAspectRatio="none">
            <path d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V120H0V0C73.69,32.39,150.81,59.2,223.4,70.52Z" fill="#FCFBF4"></path>
          </svg>
        </div>

        <div className="mx-auto max-w-6xl px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
            <div>
              <h4 className="text-xs font-bold text-gray-800 mb-6 uppercase tracking-wider">Quick Links</h4>
              <ul className="space-y-3 text-xs text-gray-500 font-medium">
                <li><a href="#" className="hover:text-primary transition-colors">About us</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Add your restaurant</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Help</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">My account</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Contacts</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-bold text-gray-800 mb-6 uppercase tracking-wider">Categories</h4>
              <ul className="space-y-3 text-xs text-gray-500 font-medium">
                <li><a href="#" className="hover:text-primary transition-colors">Top Categories</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Best Rated</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Best Price</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Latest Submissions</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-bold text-gray-800 mb-6 uppercase tracking-wider">Contacts</h4>
              <ul className="space-y-4 text-xs text-gray-500 font-medium">
                <li className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span>97845 Baker st. 567<br/>Los Angeles - US</span>
                </li>
                <li className="flex items-center gap-3">
                  <svg className="w-4 h-4 text-primary shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                  <span>+94 423-23-221</span>
                </li>
                <li className="flex items-center gap-3">
                  <svg className="w-4 h-4 text-primary shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                  <span>info@domain.com</span>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-bold text-gray-800 mb-6 uppercase tracking-wider">Keep In Touch</h4>
              <div className="flex">
                <input 
                  type="email" 
                  placeholder="Your email" 
                  className="bg-white border border-gray-200 px-3 py-2 text-xs w-full outline-none focus:border-primary"
                />
                <button className="bg-primary text-white px-3 py-2">
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
              
              <h4 className="text-xs font-bold text-gray-800 mt-8 mb-4 uppercase tracking-wider">Follow Us</h4>
              <div className="flex gap-4">
                <a href="#" className="text-gray-400 hover:text-gray-800 transition-colors"><Facebook className="w-4 h-4" /></a>
                <a href="#" className="text-gray-400 hover:text-gray-800 transition-colors"><Twitter className="w-4 h-4" /></a>
                <a href="#" className="text-gray-400 hover:text-gray-800 transition-colors"><Instagram className="w-4 h-4" /></a>
              </div>
            </div>
          </div>
          
          <div className="mt-16 pt-8 border-t border-gray-200/60 flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] text-gray-500 font-medium">
            <div className="flex gap-4 items-center">
              <select className="bg-transparent outline-none cursor-pointer">
                <option>English</option>
              </select>
              <select className="bg-transparent outline-none cursor-pointer">
                <option>US Dollars</option>
              </select>
            </div>
            <div className="flex gap-4">
              <span className="hover:text-gray-800 cursor-pointer">Terms and conditions</span>
              <span className="hover:text-gray-800 cursor-pointer">Privacy</span>
              <span>© FooYes</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
