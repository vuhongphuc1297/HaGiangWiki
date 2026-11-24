import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { MobileContainer } from './components/layout/MobileContainer';
import { DemoTripProvider, TripProvider, useTrip } from './context/TripContext';
import { HomePage } from './features/itinerary/HomePage';
import { LandingPage } from './features/landing/LandingPage';
import { OnboardingPage } from './features/trip/OnboardingPage';
import { JoinTripPage } from './features/invite/JoinTripPage';
import { ExpensesProvider } from './features/expenses/ExpenseContext';
import { PackingProvider } from './features/packing/PackingContext';

function ScrollToTop() {
  const { pathname, search } = useLocation();
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'auto' }); }, [pathname, search]);
  return null;
}

function EntryPage() {
  const { trip } = useTrip();
  const { search } = useLocation();
  const tab = new URLSearchParams(search).get('tab');
  // Keep existing tab links usable for a verified personal trip.
  if (trip && tab && ['itinerary', 'map', 'expenses', 'packing'].includes(tab)) {
    return <Navigate to={{ pathname: '/trip', search }} replace />;
  }
  return <LandingPage />;
}

function TripWorkspace() {
  return <ExpensesProvider><PackingProvider><HomePage /></PackingProvider></ExpensesProvider>;
}

function PersonalTripPage() {
  const { trip, loading } = useTrip();
  return trip || loading ? <TripWorkspace /> : <Navigate to="/" replace />;
}

export default function App() {
  return <BrowserRouter><TripProvider><ScrollToTop /><MobileContainer><Routes>
    <Route path="/" element={<EntryPage />} />
    <Route path="/trip" element={<PersonalTripPage />} />
    <Route path="/demo" element={<DemoTripProvider><TripWorkspace /></DemoTripProvider>} />
    <Route path="/onboarding" element={<OnboardingPage />} />
    <Route path="/join/:token" element={<JoinTripPage />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></MobileContainer></TripProvider></BrowserRouter>;
}
