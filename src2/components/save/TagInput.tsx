import React, { useState, useEffect, useRef } from 'react';
import { useTags } from '../../shared/hooks';

interface TagInputProps {
  selectedTags: string[];
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
}

const TagInput: React.FC<TagInputProps> = ({ 
  selectedTags, 
  onAddTag, 
  onRemoveTag 
}) => {
  const { filterTags } = useTags();
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Update suggestions when input changes
  useEffect(() => {
    if (inputValue.trim() !== '') {
      // Filter out tags that are already selected
      const filteredSuggestions = filterTags(inputValue).filter(
        tag => !selectedTags.includes(tag)
      );
      setSuggestions(filteredSuggestions);
      setShowSuggestions(filteredSuggestions.length > 0);
      setSelectedIndex(-1);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [inputValue, filterTags, selectedTags]);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  // Add a tag from input
  const addTagFromInput = () => {
    const trimmedValue = inputValue.trim();
    if (trimmedValue && !selectedTags.includes(trimmedValue)) {
      onAddTag(trimmedValue);
      setInputValue('');
      setShowSuggestions(false);
    }
  };

  // Add a selected suggestion
  const addSelectedSuggestion = () => {
    if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
      onAddTag(suggestions[selectedIndex]);
      setInputValue('');
      setShowSuggestions(false);
    } else {
      addTagFromInput();
    }
  };

  // Handle key down events
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        e.preventDefault();
        addSelectedSuggestion();
        break;
      case 'Escape':
        e.preventDefault();
        setShowSuggestions(false);
        break;
      case ',':
      case ' ':
        e.preventDefault();
        addTagFromInput();
        break;
      case 'Backspace':
        if (inputValue === '' && selectedTags.length > 0) {
          onRemoveTag(selectedTags[selectedTags.length - 1]);
        }
        break;
      default:
        break;
    }
  };

  // Handle suggestion click
  const handleSuggestionClick = (tag: string) => {
    onAddTag(tag);
    setInputValue('');
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current && 
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
      <div className="flex flex-wrap items-center gap-2 p-2 border border-gray-300 rounded-md focus-within:border-red-500 focus-within:ring-1 focus-within:ring-red-500">
        {/* Selected tags */}
        {selectedTags.map(tag => (
          <span 
            key={tag} 
            className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-md flex items-center"
          >
            {tag}
            <button
              type="button"
              onClick={() => onRemoveTag(tag)}
              className="ml-1 text-red-600 hover:text-red-800 focus:outline-none"
            >
              &times;
            </button>
          </span>
        ))}
        
        {/* Input field */}
        <div className="relative flex-1 min-w-[100px]">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => inputValue.trim() !== '' && setSuggestions(filterTags(inputValue))}
            className="w-full border-none p-1 focus:outline-none text-sm"
            placeholder="Add tags..."
          />
          
          {/* Suggestions dropdown */}
          {showSuggestions && (
            <div 
              ref={suggestionsRef}
              className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-sm overflow-auto"
            >
              {suggestions.length > 0 ? (
                suggestions.map((suggestion, index) => (
                  <div
                    key={suggestion}
                    className={`px-4 py-2 cursor-pointer hover:bg-gray-100 ${
                      index === selectedIndex ? 'bg-gray-100' : ''
                    }`}
                    onClick={() => handleSuggestionClick(suggestion)}
                  >
                    {suggestion}
                  </div>
                ))
              ) : (
                <div className="px-4 py-2 text-gray-500">No suggestions found</div>
              )}
            </div>
          )}
        </div>
      </div>
      <p className="mt-1 text-xs text-gray-500">
        Press Enter, comma, or space to add a tag
      </p>
    </div>
  );
};

export default TagInput; 