import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArtemisLanding } from '@/components/ArtemisLanding';
import { AboutModal } from '@/components/AboutModal';

export function LandingPage() {
  const navigate = useNavigate();
  const [isAboutOpen, setIsAboutOpen] = useState(false);

  return (
    <>
      <ArtemisLanding
        onEnterConsole={() => navigate('/dashboard')}
        onOpenAbout={() => setIsAboutOpen(true)}
      />
      <AboutModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
    </>
  );
}
