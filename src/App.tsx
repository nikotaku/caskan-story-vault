import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Staff from "./pages/Staff";
import Shift from "./pages/Shift";
import ShiftSubmission from "./pages/ShiftSubmission";
import Reservations from "./pages/Reservations";
import Customers from "./pages/Customers";
import Design from "./pages/Design";
import Report from "./pages/Report";
import Salary from "./pages/Salary";
import Settings from "./pages/Settings";
import PricingManagement from "./pages/PricingManagement";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import PublicHome from "./pages/public/Home";
import PublicCasts from "./pages/public/Casts";
import PublicCastDetail from "./pages/public/CastDetail";
import PublicSchedule from "./pages/public/Schedule";
import PublicPricing from "./pages/public/Pricing";
import PublicSystem from "./pages/public/System";
import NotionPageView from "./pages/NotionPageView";
import BookingReservation from "./pages/public/BookingReservation";
import TextGeneration from "./pages/TextGeneration";
import EstamaIntegration from "./pages/EstamaIntegration";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/staff" element={<Staff />} />
          <Route path="/shift" element={<Shift />} />
          <Route path="/shift/submission" element={<ShiftSubmission />} />
          <Route path="/reservations" element={<Reservations />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/design" element={<Design />} />
          <Route path="/report" element={<Report />} />
          <Route path="/salary" element={<Salary />} />
          <Route path="/pricing" element={<PricingManagement />} />
          <Route path="/text-generation" element={<TextGeneration />} />
          <Route path="/estama" element={<EstamaIntegration />} />
          <Route path="/shop" element={<Settings />} />
          
          {/* Public Pages */}
          <Route path="/public" element={<PublicHome />} />
          <Route path="/public/casts" element={<PublicCasts />} />
          <Route path="/public/casts/:id" element={<PublicCastDetail />} />
          <Route path="/public/schedule" element={<PublicSchedule />} />
          <Route path="/public/pricing" element={<PublicPricing />} />
          <Route path="/public/system" element={<PublicSystem />} />
          <Route path="/page/:slug" element={<NotionPageView />} />
          <Route path="/public/booking" element={<BookingReservation />} />
          
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;