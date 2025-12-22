import { useState, useEffect } from 'react';

export function useIsManager() {
  const [isManager, setIsManager] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkManagerRole = async () => {
      try {
        const response = await fetch('/api/admin/user-role');
        if (response.ok) {
          const data = await response.json();
          setIsManager(['MANAGER', 'ADMIN'].includes(data.role));
        }
      } catch (error) {
        console.error('Error checking manager role:', error);
        setIsManager(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkManagerRole();
  }, []);

  return { isManager, isLoading };
}