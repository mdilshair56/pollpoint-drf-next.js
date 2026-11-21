"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { searchPolls } from "@/services/poll-service";
import { searchQuestions } from "@/services/question-service";

const DEBOUNCE_MS = 2_000;
const CACHE_TTL_MS = 30_000;
const MAX_CACHE_ENTRIES = 20;

export type AutocompleteItem = {
  id: number | string;
  name: string;
};

export type SearchFunction<T extends AutocompleteItem = AutocompleteItem> = (
  query: string,
  signal?: AbortSignal,
) => Promise<T[]>;

export type AutocompleteSearchType = "poll" | "question";

type CachedSuggestions<T> = {
  expiresAt: number;
  suggestions: T[];
};

type KeyedValue<T> = {
  key: string;
  value: T;
};

export type UseAutocompleteOptions<T extends AutocompleteItem = AutocompleteItem> = {
  searchFn?: SearchFunction<T>;
  searchType?: AutocompleteSearchType;
  searchKey?: string;
  value: string;
  onSelect: (suggestion: T) => void;
  disabled?: boolean;
};

function isAbortedRequest(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  );
}

export function useAutocomplete<T extends AutocompleteItem = AutocompleteItem>({
  searchFn,
  searchType,
  searchKey,
  value,
  onSelect,
  disabled = false,
}: UseAutocompleteOptions<T>) {
  const [isActive, setIsActive] = useState(false);
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);
  const [suggestionResult, setSuggestionResult] = useState<KeyedValue<T[]> | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [searchedKey, setSearchedKey] = useState<string | null>(null);
  const [errorResult, setErrorResult] = useState<KeyedValue<string> | null>(null);
  const timerRef = useRef<number | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const cacheRef = useRef(new Map<string, CachedSuggestions<T>>());
  const requestSequenceRef = useRef(0);

  const effectiveSearchFn: SearchFunction<T> | undefined =
    searchFn ??
    (searchType === "poll"
      ? (searchPolls as unknown as SearchFunction<T>)
      : searchType === "question"
      ? (searchQuestions as unknown as SearchFunction<T>)
      : undefined);

  const searchFnRef = useRef(effectiveSearchFn);
  useEffect(() => {
    searchFnRef.current = effectiveSearchFn;
  }, [effectiveSearchFn]);

  const prefix = searchKey ?? searchType ?? searchFn?.name ?? "autocomplete";
  const normalizedQuery = value.trim();
  const queryKey = prefix + ":" + normalizedQuery.toLowerCase();

  const cancelPendingWork = useCallback(() => {
    requestSequenceRef.current += 1;
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    controllerRef.current?.abort();
    controllerRef.current = null;
  }, []);

  useEffect(() => {
    cancelPendingWork();

    if (
      disabled ||
      !isActive ||
      normalizedQuery.length < 2 ||
      dismissedKey === queryKey
    ) {
      return cancelPendingWork;
    }

    timerRef.current = window.setTimeout(async () => {
      timerRef.current = null;

      const now = Date.now();
      for (const [cachedKey, entry] of cacheRef.current) {
        if (entry.expiresAt <= now) cacheRef.current.delete(cachedKey);
      }

      const cached = cacheRef.current.get(queryKey);
      if (cached) {
        // Refresh insertion order so the cache behaves like a small LRU cache.
        cacheRef.current.delete(queryKey);
        cacheRef.current.set(queryKey, cached);
        setSuggestionResult({ key: queryKey, value: cached.suggestions });
        setSearchedKey(queryKey);
        return;
      }

      const currentSearchFn = searchFnRef.current;
      if (!currentSearchFn) {
        return;
      }

      const controller = new AbortController();
      const requestId = ++requestSequenceRef.current;
      controllerRef.current = controller;
      setLoadingKey(queryKey);

      try {
        const result = await currentSearchFn(
          normalizedQuery,
          controller.signal,
        );
        if (!controller.signal.aborted && requestSequenceRef.current === requestId) {
          const limitedSuggestions = result.slice(0, 10);

          while (cacheRef.current.size >= MAX_CACHE_ENTRIES) {
            const oldestKey = cacheRef.current.keys().next().value;
            if (oldestKey === undefined) break;
            cacheRef.current.delete(oldestKey);
          }

          cacheRef.current.set(queryKey, {
            expiresAt: Date.now() + CACHE_TTL_MS,
            suggestions: limitedSuggestions,
          });
          setErrorResult(null);
          setSuggestionResult({ key: queryKey, value: limitedSuggestions });
          setSearchedKey(queryKey);
        }
      } catch (caught) {
        if (!isAbortedRequest(caught) && requestSequenceRef.current === requestId) {
          setErrorResult({
            key: queryKey,
            value: "Suggestions could not be loaded. Try again.",
          });
          setSearchedKey(queryKey);
        }
      } finally {
        if (requestSequenceRef.current === requestId) {
          setLoadingKey(null);
          controllerRef.current = null;
        }
      }
    }, DEBOUNCE_MS);

    return cancelPendingWork;
  }, [
    cancelPendingWork,
    disabled,
    dismissedKey,
    isActive,
    normalizedQuery,
    queryKey,
  ]);

  const focus = useCallback(() => {
    setDismissedKey(null);
    setIsActive(true);
  }, []);

  const inputChanged = useCallback(() => {
    cancelPendingWork();
    setSuggestionResult(null);
    setLoadingKey(null);
    setSearchedKey(null);
    setErrorResult(null);
    setDismissedKey(null);
  }, [cancelPendingWork]);

  const blur = useCallback(() => {
    cancelPendingWork();
    setSuggestionResult(null);
    setLoadingKey(null);
    setSearchedKey(null);
    setErrorResult(null);
    setDismissedKey(null);
    setIsActive(false);
  }, [cancelPendingWork]);

  const dismiss = useCallback(() => {
    cancelPendingWork();
    setSuggestionResult(null);
    setLoadingKey(null);
    setSearchedKey(null);
    setErrorResult(null);
    setDismissedKey(queryKey);
  }, [cancelPendingWork, queryKey]);

  const selectSuggestion = useCallback((suggestion: T) => {
    const selectedKey = prefix + ":" + suggestion.name.trim().toLowerCase();
    cancelPendingWork();
    setSuggestionResult(null);
    setLoadingKey(null);
    setSearchedKey(null);
    setErrorResult(null);
    setDismissedKey(selectedKey);
    onSelect(suggestion);
  }, [cancelPendingWork, onSelect, prefix]);

  return {
    error: errorResult?.key === queryKey ? errorResult.value : null,
    focus,
    inputChanged,
    blur,
    dismiss,
    hasSearched: searchedKey === queryKey,
    isLoading: isActive && !disabled && loadingKey === queryKey,
    isOpen: isActive && !disabled && dismissedKey !== queryKey,
    queryKey,
    selectSuggestion,
    suggestions: suggestionResult?.key === queryKey ? suggestionResult.value : [],
  };
}
