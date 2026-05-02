import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Staff from "./pages/Staff";
import Shift from "./pages/Shift";
import ShiftSubmission from "./pages/ShiftSubmission";
import Reservations from "./pages/Reservations";
import Customers from "./pages/Customers";
import Design from "./pages/Design";
import Report from "./pages/Report";
import Salary from "./pages/Salary";
import Settings from "./pages/Settings";
import Pricing from "./pages/PricingManagement";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import TherapistPortal from "./pages/TherapistPortal";
import TherapistShiftSubmission from "./pages/TherapistShiftSubmission";
import PublicSchedule from "./pages/public/Schedule";
import PublicCasts from "./pages/public/Casts";
import PublicCastDetail from "./pages/public/CastDetail";
import PublicPricing from "./pages/public/Pricing";
import PublicSystem from "./pages/public/System";
import PublicAccess from "./pages/public/Access";
import NotionPageView from "./pages/NotionPageView";
import BookingReservation from "./pages/public/BookingReservation";
import TextGeneration from "./pages/TextGeneration";
import Agreement from "./pages/Agreement";
import RoomSettings from "./pages/RoomSettings";
import SchedulePage from "./pages/Schedule";
import Expenses from "./pages/Expenses";
import Board from "./pages/Board";
import Knowledge from "./pages/Knowledge";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public Pages */}
          <Route path="/" element={<PublicSchedule />} />
          <Route path="/casts" element={<PublicCasts />} />
          <Route path="/casts/:id" element={<PublicCastDetail />} />
          <Route path="/pricing" element={<PublicPricing />} />
          <Route path="/system" element={<PublicSystem />} />
          <Route path="/access" element={<PublicAccess />} />
          <Route path="/booking" element={<BookingReservation />} />
          <Route path="/page/:slug" element={<NotionPageView />} />
          
          {/* Admin/Staff Pages */}
          <Route path="/login" element={<Auth />} />
          <Route path="/dashboard" element={<Navigate to="/admin-schedule" replace />} />
          <Route path="/admin-schedule" element={<SchedulePage />} />
          <Route path="/staff" element={<Staff />} />
          <Route path="/shift" element={<Shift />} />
          <Route path="/shift/submission" element={<ShiftSubmission />} />
          <Route path="/reservations" element={<Reservations />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/agreement" element={<Agreement />} />
          <Route path="/rooms" element={<RoomSettings />} />
          <Route path="/design" element={<Design />} />
          <Route path="/report" element={<Report />} />
          <Route path="/salary" element={<Salary />} />
          <Route path="/pricing-management" element={<Pricing />} />
          <Route path="/text-generation" element={<TextGeneration />} />
          <Route path="/shop" element={<Settings />} />
          <Route path="/expenses" element={<Expenses />} />
          <Route path="/board" element={<Board />} />
          <Route path="/knowledge" element={<Knowledge />} />
          
          {/* Therapist Portal - Token-based access */}
          <Route path="/therapist/:token" element={<TherapistPortal />} />
          <Route path="/therapist/:token/shift" element={<TherapistShiftSubmission />} />
          
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;