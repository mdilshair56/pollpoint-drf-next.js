"use client";

import { useId, useState } from "react";
import { useAutocomplete } from "@/hooks/use-autocomplete";
import type { SuggestionSearchType } from "@/types/suggestion";

type AutocompleteInputProps = {
  id: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  searchType: SuggestionSearchType;
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
  maxLength?: number;
  placeholder?: string;
  required?: boolean;
};

export function AutocompleteInput({
  id,
  name,
  value,
  onChange,
  searchType,
  ariaLabel,
  className = "field",
  disabled = false,
  maxLength,
  placeholder,
  required = false,
}: AutocompleteInputProps) {
  const listboxId = useId();
  const [highlighted, setHighlighted] = useState({ key: "", index: -1 });
  const autocomplete = useAutocomplete({
    searchType,
    value,
    disabled,
    onSelect: (suggestion) => onChange(suggestion.name),
  });
  const showDropdown = autocomplete.isOpen && (
    autocomplete.isLoading ||
    autocomplete.error !== null ||
    autocomplete.suggestions.length > 0 ||
    autocomplete.hasSearched
  );

  const highlightedIndex = highlighted.key === autocomplete.queryKey
    ? highlighted.index
    : -1;

  function selectHighlightedSuggestion() {
    const suggestion = autocomplete.suggestions[highlightedIndex];
    if (suggestion) {
      setHighlighted({ key: "", index: -1 });
      autocomplete.selectSuggestion(suggestion);
    }
  }

  function handleFocus() {
    setHighlighted({ key: "", index: -1 });
    autocomplete.focus();
  }

  function handleBlur() {
    setHighlighted({ key: "", index: -1 });
    autocomplete.blur();
  }

  return (
    <div className="relative min-w-0 flex-1">
      <input
        id={id}
        name={name}
        className={className}
        value={value}
        disabled={disabled}
        maxLength={maxLength}
        placeholder={placeholder}
        required={required}
        aria-label={ariaLabel}
        role="combobox"
        aria-autocomplete="list"
        aria-controls={autocomplete.suggestions.length > 0 ? listboxId : undefined}
        aria-expanded={showDropdown}
        aria-activedescendant={
          highlightedIndex >= 0 ? listboxId + "-option-" + highlightedIndex : undefined
        }
        onChange={(event) => {
          setHighlighted({ key: "", index: -1 });
          autocomplete.inputChanged();
          onChange(event.target.value);
        }}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && autocomplete.suggestions.length > 0) {
            event.preventDefault();
            setHighlighted((current) => ({
              key: autocomplete.queryKey,
              index: Math.min(
                current.key === autocomplete.queryKey ? current.index + 1 : 0,
                autocomplete.suggestions.length - 1,
              ),
            }));
          }
          if (event.key === "ArrowUp" && autocomplete.suggestions.length > 0) {
            event.preventDefault();
            setHighlighted((current) => ({
              key: autocomplete.queryKey,
              index: Math.max(
                current.key === autocomplete.queryKey ? current.index - 1 : 0,
                0,
              ),
            }));
          }
          if (event.key === "Enter" && highlightedIndex >= 0) {
            event.preventDefault();
            selectHighlightedSuggestion();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            setHighlighted({ key: "", index: -1 });
            autocomplete.dismiss();
          }
        }}
      />
      {showDropdown && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-white shadow-lg">
          {autocomplete.isLoading && (
            <p className="px-3 py-2 text-sm text-muted" role="status">Loading suggestions…</p>
          )}
          {autocomplete.error && (
            <p className="px-3 py-2 text-sm text-red-700" role="alert">{autocomplete.error}</p>
          )}
          {!autocomplete.isLoading && !autocomplete.error && autocomplete.hasSearched && autocomplete.suggestions.length === 0 && (
            <p className="px-3 py-2 text-sm text-muted">No suggestions found.</p>
          )}
          {autocomplete.suggestions.length > 0 && (
            <ul id={listboxId} role="listbox" className="max-h-60 overflow-y-auto py-1">
              {autocomplete.suggestions.map((suggestion, index) => (
                <li
                  key={suggestion.id}
                  id={listboxId + "-option-" + index}
                  role="option"
                  aria-selected={highlightedIndex === index}
                  className={"cursor-pointer px-3 py-2 text-sm " + (
                    highlightedIndex === index ? "bg-blue-50 text-brand" : "text-ink hover:bg-slate-50"
                  )}
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setHighlighted({ key: "", index: -1 });
                    autocomplete.selectSuggestion(suggestion);
                  }}
                >
                  <span className="block font-medium">{suggestion.name}</span>
                  {suggestion.question_name && (
                    <span className="block text-xs text-muted">{suggestion.question_name}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
