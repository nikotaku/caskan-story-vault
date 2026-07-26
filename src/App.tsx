import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Component, ReactNode } from "react";
import { useGlobalHalfWidth } from "@/hooks/useGlobalHalfWidth";
import { StoreProvider } from "@/hooks/useStore";

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, fontFamily: "sans-serif" }}>
          <h1 style={{ color: "#c00" }}>アプリ読み込みエラー</h1>
          <pre style={{ background: "#f5f5f5", padding: 16, overflow: "auto", fontSize: 13 }}>
            {(this.state.error as Error).message}
            {"\n"}
            {(this.state.error as Error).stack}
          </pre>
          <button onClick={() => window.location.reload()} style={{ marginTop: 16, padding: "8px 16px" }}>
            再読み込み
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
import Staff from "./pages/Staff";
import Shift from "./pages/Shift";
import ShiftSubmission from "./pages/ShiftSubmission";
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
import StoreTop from "./pages/public/StoreTop";
import PublicCasts from "./pages/public/Casts";
import PublicCastDetail from "./pages/public/CastDetail";
import PublicPricing from "./pages/public/Pricing";
import PublicSystem from "./pages/public/System";
import PublicAccess from "./pages/public/Access";
import NotionPageView from "./pages/NotionPageView";
import BookingReservation from "./pages/public/BookingReservation";
import Agreement from "./pages/Agreement";
import RoomSettings from "./pages/RoomSettings";
import SchedulePage from "./pages/Schedule";
import Expenses from "./pages/Expenses";
import Board from "./pages/Board";
import Knowledge from "./pages/Knowledge";
import MonthlyShift from "./pages/MonthlyShift";
import ReservationsList from "./pages/ReservationsList";
import AvailableSlots from "./pages/AvailableSlots";
import ArticleCreation from "./pages/ArticleCreation";
import BusinessFlow from "./pages/BusinessFlow";
import StoreInfo from "./pages/StoreInfo";
import HpSnsLinks from "./pages/HpSnsLinks";
import SalesCustomerInfo from "./pages/SalesCustomerInfo";
import SalesTherapistBreakdown from "./pages/SalesTherapistBreakdown";
import SalesPriceAnalysis from "./pages/SalesPriceAnalysis";
import SalesMonthlySales from "./pages/SalesMonthlySales";
import SalesDailySales from "./pages/SalesDailySales";
import SalesPendingReports from "./pages/SalesPendingReports";
import SalesDeductionSummary from "./pages/SalesDeductionSummary";
import SalesCardSales from "./pages/SalesCardSales";
import SalesPayPaySales from "./pages/SalesPayPaySales";
import SalesAdvertisingCost from "./pages/SalesAdvertisingCost";
import SalesReferralFees from "./pages/SalesReferralFees";
import SalesMonthlySalesTarget from "./pages/SalesMonthlySalesTarget";
import SalesDailySalesTarget from "./pages/SalesDailySalesTarget";
import SalesExpenseInput from "./pages/SalesExpenseInput";
import SalesMonthlyClosing from "./pages/SalesMonthlyClosing";
import SystemCourses from "./pages/SystemCourses";
import SystemOptions from "./pages/SystemOptions";
import SystemDiscounts from "./pages/SystemDiscounts";
import SystemDeductions from "./pages/SystemDeductions";
import SystemPaymentMethods from "./pages/SystemPaymentMethods";
import SystemReferralRewards from "./pages/SystemReferralRewards";
import SystemAllowances from "./pages/SystemAllowances";
import SystemSMS from "./pages/SystemSMS";
import SystemSMSAuto from "./pages/SystemSMSAuto";
import SystemPageContent from "./pages/SystemPageContent";
import TherapistCheckout from "./pages/TherapistCheckout";
import SNSDatabase from "./pages/SNSDatabase";
import PasswordDatabase from "./pages/PasswordDatabase";
import TherapistMyPage from "./pages/TherapistMyPage";
import CustomerDatabase from "./pages/CustomerDatabase";
import FacilitiesRooms from "./pages/FacilitiesRooms";
import FacilitiesContracts from "./pages/FacilitiesContracts";
import FacilitiesContractDetail from "./pages/FacilitiesContractDetail";
import FacilitiesEquipment from "./pages/FacilitiesEquipment";
import CastImport from "./pages/CastImport";
import ReservationImport from "./pages/ReservationImport";
import CustomerImport from "./pages/CustomerImport";
import SalesClosing from "./pages/SalesClosing";
import TextTemplates from "./pages/TextTemplates";
import ImageStock from "./pages/ImageStock";
import MediaStrategy from "./pages/MediaStrategy";
import InquiryStats from "./pages/InquiryStats";
import Tasks from "./pages/Tasks";
import Bios from "./pages/Bios";
import CtiCalls from "./pages/CtiCalls";
import CustomerDetail from "./pages/CustomerDetail";
import CastPostManagement from "./pages/CastPostManagement";
import TherapistPostPage from "./pages/TherapistPostPage";
import RecommendedMenu from "./pages/RecommendedMenu";
import BusinessContinuity from "./pages/BusinessContinuity";
import SalesDashboard from "./pages/SalesDashboard";
import SalesData from "./pages/SalesData";
import ScheduleDashboard from "./pages/ScheduleDashboard";
import PanelPhotoManual from "./pages/PanelPhotoManual";
import CustomerServiceManual from "./pages/CustomerServiceManual";
import ZenryokuBookManual from "./pages/ZenryokuBookManual";
import RecruitmentCriteria from "./pages/RecruitmentCriteria";
import RecruitTalk from "./pages/RecruitTalk";
import InterviewGuide from "./pages/InterviewGuide";
import BusinessVendors from "./pages/BusinessVendors";
import BusinessLogins from "./pages/BusinessLogins";
import BusinessFixedCosts from "./pages/BusinessFixedCosts";
import BusinessBankAccounts from "./pages/BusinessBankAccounts";
import BusinessContracts from "./pages/BusinessContracts";
import Education from "./pages/Education";
import ProductLP from "./pages/public/ProductLP";
import PurchaseOrders from "./pages/PurchaseOrders";
import Survey from "./pages/public/Survey";
import CustomerReview from "./pages/public/CustomerReview";
import Voice from "./pages/public/Voice";
import ReviewMaker from "./pages/public/ReviewMaker";
import CastBooking from "./pages/public/CastBooking";
import KeikaBooking from "./pages/public/KeikaBooking";
import SurveysAdmin from "./pages/SurveysAdmin";
import ReviewsAdmin from "./pages/ReviewsAdmin";

const queryClient = new QueryClient();

const App = () => {
  useGlobalHalfWidth();
  return (
  <ErrorBoundary>
  <QueryClientProvider client={queryClient}>
    <StoreProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public Pages */}
          <Route path="/" element={<StoreTop />} />
          <Route path="/schedule" element={<PublicSchedule />} />
          <Route path="/casts" element={<PublicCasts />} />
          <Route path="/casts/:id" element={<PublicCastDetail />} />
          <Route path="/pricing" element={<PublicPricing />} />
          <Route path="/system" element={<PublicSystem />} />
          <Route path="/access" element={<PublicAccess />} />
          <Route path="/booking" element={<BookingReservation />} />
          <Route path="/page/:slug" element={<NotionPageView />} />
          <Route path="/lp" element={<ProductLP />} />
          <Route path="/survey" element={<Survey />} />
          <Route path="/review" element={<CustomerReview />} />
          <Route path="/review-maker" element={<ReviewMaker />} />
          <Route path="/book/keika" element={<KeikaBooking />} />
          <Route path="/book/:castId" element={<CastBooking />} />
          <Route path="/haru" element={<Navigate to="/book/4b2fc0c8-ccad-48a6-9a32-f7898381f68b" replace />} />
          <Route path="/voice" element={<Voice />} />
          
          {/* Admin/Staff Pages */}
          <Route path="/login" element={<Auth />} />
          <Route path="/dashboard" element={<Navigate to="/admin-schedule" replace />} />
          <Route path="/schedule-dashboard" element={<ScheduleDashboard />} />
          <Route path="/admin-schedule" element={<SchedulePage />} />
          <Route path="/schedule/monthly-shift" element={<MonthlyShift />} />
          <Route path="/schedule/reservations-list" element={<ReservationsList />} />
          <Route path="/schedule/available-slots" element={<AvailableSlots />} />
          <Route path="/staff" element={<Staff />} />
          <Route path="/shift" element={<Shift />} />
          <Route path="/shift/submission" element={<ShiftSubmission />} />
          <Route path="/reservations" element={<Navigate to="/schedule/reservations-list" replace />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/agreement" element={<Agreement />} />
          <Route path="/rooms" element={<RoomSettings />} />
          <Route path="/design" element={<Design />} />
          <Route path="/hp/article-creation" element={<ArticleCreation />} />
          <Route path="/hp/business-flow" element={<BusinessFlow />} />
          <Route path="/hp/store-info" element={<StoreInfo />} />
          <Route path="/hp/sns-links" element={<HpSnsLinks />} />
          <Route path="/hp/recommended-menu" element={<RecommendedMenu />} />
          <Route path="/report" element={<Report />} />
          <Route path="/salary" element={<Salary />} />
          <Route path="/pricing-management" element={<Pricing />} />
          <Route path="/shop" element={<Settings />} />
          <Route path="/expenses" element={<Expenses />} />
          <Route path="/board" element={<Board />} />
          <Route path="/knowledge" element={<Knowledge />} />
          <Route path="/knowledge/passwords" element={<PasswordDatabase />} />
          <Route path="/templates" element={<TextTemplates />} />
          <Route path="/image-stock" element={<ImageStock />} />
          <Route path="/marketing/media" element={<MediaStrategy />} />
          <Route path="/inquiry-stats" element={<InquiryStats />} />
          <Route path="/cti-calls" element={<CtiCalls />} />
          <Route path="/sales" element={<SalesDashboard />} />
          <Route path="/sales/data" element={<SalesData />} />
          <Route path="/sales/customer-info" element={<SalesCustomerInfo />} />
          <Route path="/sales/closing" element={<SalesClosing />} />
          <Route path="/sales/therapist-breakdown" element={<SalesTherapistBreakdown />} />
          <Route path="/sales/price-analysis" element={<SalesPriceAnalysis />} />
          <Route path="/sales/monthly-sales" element={<SalesMonthlySales />} />
          <Route path="/sales/daily-sales" element={<SalesDailySales />} />
          <Route path="/sales/monthly-closing" element={<SalesMonthlyClosing />} />
          <Route path="/sales/pending-reports" element={<SalesPendingReports />} />
          <Route path="/sales/deduction-summary" element={<SalesDeductionSummary />} />
          <Route path="/sales/card-sales" element={<SalesCardSales />} />
          <Route path="/sales/paypay-sales" element={<SalesPayPaySales />} />
          <Route path="/sales/advertising-cost" element={<SalesAdvertisingCost />} />
          <Route path="/sales/referral-fees" element={<SalesReferralFees />} />
          <Route path="/sales/monthly-target" element={<SalesMonthlySalesTarget />} />
          <Route path="/sales/daily-target" element={<SalesDailySalesTarget />} />
          <Route path="/sales/expense-input" element={<SalesExpenseInput />} />
          <Route path="/system/courses" element={<SystemCourses />} />
          <Route path="/system/options" element={<SystemOptions />} />
          <Route path="/system/discounts" element={<SystemDiscounts />} />
          <Route path="/system/payment-methods" element={<SystemPaymentMethods />} />
          <Route path="/system/deductions" element={<SystemDeductions />} />
          <Route path="/system/allowances" element={<SystemAllowances />} />
          <Route path="/system/referral-rewards" element={<SystemReferralRewards />} />
          <Route path="/system/sms" element={<SystemSMS />} />
          <Route path="/system/sms-auto" element={<SystemSMSAuto />} />
          <Route path="/system/page-content" element={<SystemPageContent />} />
          <Route path="/database/knowledge/sns" element={<SNSDatabase />} />
          <Route path="/database/therapist/mypage" element={<TherapistMyPage />} />
          <Route path="/database/customers" element={<CustomerDatabase />} />
          <Route path="/database/customers/:id" element={<CustomerDetail />} />
          <Route path="/database/surveys" element={<SurveysAdmin />} />
          <Route path="/database/reviews" element={<ReviewsAdmin />} />
          <Route path="/facilities/rooms" element={<FacilitiesRooms />} />
          <Route path="/facilities/contracts" element={<FacilitiesContracts />} />
          <Route path="/facilities/contracts/:id" element={<FacilitiesContractDetail />} />
          <Route path="/facilities/equipment" element={<FacilitiesEquipment />} />
          <Route path="/admin/import-casts" element={<CastImport />} />
          <Route path="/admin/import-reservations" element={<ReservationImport />} />
          <Route path="/admin/import-customers" element={<CustomerImport />} />
          
          {/* Therapist Portal - Token-based access */}
          <Route path="/therapist/:token" element={<TherapistPortal />} />
          <Route path="/therapist/:token/shift" element={<TherapistShiftSubmission />} />
          <Route path="/therapist/:token/checkout" element={<TherapistCheckout />} />
          <Route path="/therapist/:token/posts" element={<TherapistPostPage />} />
          <Route path="/post-management" element={<CastPostManagement />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/bios" element={<Bios />} />
          <Route path="/panel-manual" element={<PanelPhotoManual />} />
          <Route path="/service-manual" element={<CustomerServiceManual />} />
          <Route path="/zenryoku-book" element={<ZenryokuBookManual />} />
          <Route path="/recruitment-criteria" element={<RecruitmentCriteria />} />
          <Route path="/recruit-talk" element={<RecruitTalk />} />
          <Route path="/interview" element={<InterviewGuide />} />
          <Route path="/education" element={<Education />} />

          <Route path="/business-continuity" element={<BusinessContinuity />} />
          <Route path="/business-continuity/vendors" element={<BusinessVendors />} />
          <Route path="/business-continuity/logins" element={<BusinessLogins />} />
          <Route path="/business-continuity/fixed-costs" element={<BusinessFixedCosts />} />
          <Route path="/business-continuity/bank-accounts" element={<BusinessBankAccounts />} />
          <Route path="/business-continuity/contracts" element={<BusinessContracts />} />
          <Route path="/purchase-orders" element={<PurchaseOrders />} />

          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
    </StoreProvider>
  </QueryClientProvider>
  </ErrorBoundary>
  );
};

export default App;