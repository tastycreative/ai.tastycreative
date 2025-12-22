import { useState, useEffect } from 'react';

export function useIsContentCreator() {
  const [isContentCreator, setIsContentCreator] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkContentCreatorRole = async () => {
      try {
        const response = await fetch('/api/admin/user-role');
        if (response.ok) {
          const data = await response.json();
          setIsContentCreator(data.role === 'CONTENT_CREATOR');
        }
      } catch (error) {
        console.error('Error checking content creator role:', error);
        setIsContentCreator(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkContentCreatorRole();
  }, []);

  return { isContentCreator, isLoading };
}
