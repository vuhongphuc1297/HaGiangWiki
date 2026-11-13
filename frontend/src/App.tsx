import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { MobileContainer } from './components/layout/MobileContainer';
import { TripProvider } from './context/TripContext';
import { HomePage } from './features/itinerary/HomePage';
import { OnboardingPage } from './features/trip/OnboardingPage';
import { JoinTripPage } from './features/invite/JoinTripPage';

function ScrollToTop() {
  const { pathname, search } = useLocation();
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'auto' }); }, [pathname, search]);
  return null;
}

export default function App() {
  return <BrowserRouter><TripProvider><ScrollToTop /><MobileContainer><Routes>
    <Route path="/" element={<HomePage />} />
    <Route path="/onboarding" element={<OnboardingPage />} />
    <Route path="/join/:token" element={<JoinTripPage />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></MobileContainer></TripProvider></BrowserRouter>;
}
