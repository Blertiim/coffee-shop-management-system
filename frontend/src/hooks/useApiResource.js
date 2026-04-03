import { useCallback, useEffect, useState } from "react";

export default function useApiResource(loader, options = {}) {
  const {
    deps = [],
    initialData = null,
    errorMessage = "Failed to load data.",
    onUnauthorized,
  } = options;

  const [data, setData] = useState(initialData);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadTick, setReloadTick] = useState(0);

  const reload = useCallback(() => {
    setReloadTick((current) => current + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    const run = async () => {
      setIsLoading(true);
      setError("");

      try {
        const result = await loader(controller.signal);

        if (isMounted) {
          setData(result);
        }
      } catch (requestError) {
        if (!isMounted || requestError.name === "AbortError") {
          return;
        }

        if (requestError.status === 401 && onUnauthorized) {
          onUnauthorized();
          return;
        }

        setError(requestError.message || errorMessage);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    run();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [errorMessage, loader, onUnauthorized, reloadTick, ...deps]);

  return {
    data,
    setData,
    isLoading,
    error,
    reload,
  };
}
