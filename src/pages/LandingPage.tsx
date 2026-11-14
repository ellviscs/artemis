import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArtemisLanding } from '@/components/ArtemisLanding';
import { AboutModal } from '@/components/AboutModal';
import { NewsSlider } from '@/components/NewsSlider';
import { fetchDisasterNews, type DisasterNewsArticle } from '@/data/newsDataApi';

export function LandingPage() {
  const navigate = useNavigate();
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [articles, setArticles] = useState<DisasterNewsArticle[]>([]);
  const [newsError, setNewsError] = useState<string | null>(null);
  const [newsLoading, setNewsLoading] = useState(true);

  const loadNews = useCallback(() => {
    const controller = new AbortController();
    setNewsLoading(true);
    setNewsError(null);
    fetchDisasterNews(controller.signal)
      .then(setArticles)
      .catch((e: unknown) => {
        if (!controller.signal.aborted) setNewsError(e instanceof Error ? e.message : 'Unable to load news.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setNewsLoading(false);
      });
    return () => controller.abort();
  }, []);
  useEffect(() => loadNews(), [loadNews]);

  return (
    <>
      <ArtemisLanding
        onEnterConsole={() => navigate('/dashboard')}
        onOpenAbout={() => setIsAboutOpen(true)}
        onOpen={(path) => navigate(path)}
        news={<NewsSlider articles={articles} isLoading={newsLoading} error={newsError} onRetry={loadNews} />}
      />
      <AboutModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
    </>
  );
}
