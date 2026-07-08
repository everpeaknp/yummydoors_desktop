import { ArrowRight, Facebook, Instagram, MapPin, Twitter } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="relative bg-[#FCFBF4] pt-24 pb-10 mt-10">
      <div className="absolute top-0 left-0 right-0 w-full overflow-hidden leading-none transform -translate-y-[99%]">
        <svg className="relative block w-full h-[40px] md:h-[60px]" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 120" preserveAspectRatio="none">
          <path d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V120H0V0C73.69,32.39,150.81,59.2,223.4,70.52Z" fill="#FCFBF4"></path>
        </svg>
      </div>

      <div className="mx-auto max-w-6xl px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          <div>
            <h4 className="text-[13px] font-bold text-[#111] mb-6 uppercase tracking-wider">Quick Links</h4>
            <ul className="space-y-3 text-[13px] text-gray-500 font-medium">
              <li><a href="#" className="hover:text-primary transition-colors">About us</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Add your restaurant</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Help</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">My account</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Blog</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Contacts</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-[13px] font-bold text-[#111] mb-6 uppercase tracking-wider">Categories</h4>
            <ul className="space-y-3 text-[13px] text-gray-500 font-medium">
              <li><a href="#" className="hover:text-primary transition-colors">Top Categories</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Best Rated</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Best Price</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Latest Submissions</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-[13px] font-bold text-[#111] mb-6 uppercase tracking-wider">Contacts</h4>
            <ul className="space-y-4 text-[13px] text-gray-500 font-medium">
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
            <h4 className="text-[13px] font-bold text-[#111] mb-6 uppercase tracking-wider">Keep In Touch</h4>
            <div className="flex">
              <input 
                type="email" 
                placeholder="Your email" 
                className="bg-white border border-gray-200 px-3 py-2 text-[13px] w-full outline-none focus:border-primary shadow-sm"
              />
              <button className="bg-primary text-white px-3 py-2">
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            
            <h4 className="text-[13px] font-bold text-[#111] mt-8 mb-4 uppercase tracking-wider">Follow Us</h4>
            <div className="flex gap-4">
              <a href="#" className="text-gray-400 hover:text-gray-800 transition-colors"><Facebook className="w-4 h-4" /></a>
              <a href="#" className="text-gray-400 hover:text-gray-800 transition-colors"><Twitter className="w-4 h-4" /></a>
              <a href="#" className="text-gray-400 hover:text-gray-800 transition-colors"><Instagram className="w-4 h-4" /></a>
            </div>
          </div>
        </div>
        
        <div className="mt-16 pt-8 border-t border-gray-200/60 flex flex-col md:flex-row justify-between items-center gap-4 text-[12px] text-gray-500 font-medium">
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
  );
}
