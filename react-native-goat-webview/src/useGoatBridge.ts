import { useEffect, useState, useCallback } from 'react';
import { goatBridge } from './GoatBridge';

export function useGoatBridge() {
  const [isPrewarmed, setIsPrewarmed] = useState(false);
  const [bundleVersion, setBundleVersion] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const prewarmOk = await goatBridge.prewarm();
      const version = await goatBridge.getBundleVersion();
      if (mounted) {
        setIsPrewarmed(prewarmOk);
        setBundleVersion(version);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const clearCache = useCallback(async () => {
    return await goatBridge.clearCache();
  }, []);

  return {
    isPrewarmed,
    bundleVersion,
    clearCache,
  };
}
