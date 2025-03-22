import React, { useState, useEffect } from 'react';
import { useTab, usePocketApi, useTags } from '../../shared/hooks';
import { Spinner, ErrorMessage } from '..';
import TagInput from './TagInput';

interface SaveFormProps {
  onSaved?: () => void;
}

const SaveForm: React.FC<SaveFormProps> = ({ onSaved }) => {
  const { tabState } = useTab();
  const { saveItem, isSaving, saveError, clearError } = usePocketApi();
  const { tagsState, getContentSuggestions } = useTags();
  
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [autoTagsLoading, setAutoTagsLoading] = useState(false);
  const [savedItem, setSavedItem] = useState(false);
  const [showTagInput, setShowTagInput] = useState(false);
  
  // Update form based on current tab
  useEffect(() => {
    if (tabState.tab) {
      setTitle(tabState.tab.title || '');
      setUrl(tabState.tab.url || '');
    }
  }, [tabState.tab]);

  // Auto-suggest tags based on content
  useEffect(() => {
    const suggestTags = async () => {
      if (url && title && !selectedTags.length) {
        setAutoTagsLoading(true);
        try {
          const suggestedTags = await getContentSuggestions(url, title);
          if (suggestedTags.length > 0) {
            setSelectedTags(suggestedTags);
          }
        } catch (err) {
          console.error('Failed to get tag suggestions:', err);
        } finally {
          setAutoTagsLoading(false);
        }
      }
    };

    suggestTags();
  }, [url, title, getContentSuggestions, selectedTags.length]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!url) {
      return;
    }
    
    try {
      await saveItem({
        url,
        title,
        tags: selectedTags
      });
      
      setSavedItem(true);
      if (onSaved) {
        onSaved();
      }
    } catch (error) {
      console.error('Error saving to Pocket:', error);
    }
  };

  // Add a tag to the selected tags
  const handleAddTag = (tag: string) => {
    if (!selectedTags.includes(tag)) {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  // Remove a tag from the selected tags
  const handleRemoveTag = (tagToRemove: string) => {
    setSelectedTags(selectedTags.filter(tag => tag !== tagToRemove));
  };

  // Toggle tag input visibility
  const toggleTagInput = () => {
    setShowTagInput(!showTagInput);
  };

  if (savedItem) {
    return (
      <div className="p-4 text-center">
        <div className="text-green-600 text-lg font-semibold mb-2">Saved to Pocket!</div>
        <p className="text-gray-600 text-sm mb-4">This article has been saved to your Pocket list.</p>
        <button
          onClick={() => window.close()}
          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="p-4">
      {saveError && (
        <div className="mb-4">
          <ErrorMessage message={saveError} />
          <button
            type="button"
            onClick={clearError}
            className="mt-2 text-sm text-red-600 hover:text-red-800"
          >
            Dismiss
          </button>
        </div>
      )}
      
      <div className="mb-4">
        <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
          Title
        </label>
        <input
          type="text"
          id="title"
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 text-sm"
        />
      </div>
      
      <div className="mb-4">
        <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-1">
          URL
        </label>
        <input
          type="url"
          id="url"
          value={url}
          onChange={e => setUrl(e.target.value)}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 text-sm"
        />
      </div>
      
      {/* Tag section */}
      <div className="mb-6">
        {!showTagInput ? (
          <button
            type="button"
            onClick={toggleTagInput}
            className="text-red-600 hover:text-red-800 text-sm font-medium focus:outline-none flex items-center"
          >
            {selectedTags.length > 0 ? `Edit tags (${selectedTags.length})` : 'Add tags'} 
            {autoTagsLoading && (
              <span className="ml-2 inline-block w-4 h-4">
                <Spinner />
              </span>
            )}
          </button>
        ) : (
          <div>
            <TagInput 
              selectedTags={selectedTags}
              onAddTag={handleAddTag}
              onRemoveTag={handleRemoveTag}
            />
            <button
              type="button"
              onClick={toggleTagInput}
              className="mt-2 text-sm text-gray-600 hover:text-gray-800"
            >
              Done
            </button>
          </div>
        )}
      </div>
      
      <div className="flex justify-between items-center">
        <button
          type="submit"
          disabled={isSaving || !url}
          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? (
            <span className="flex items-center">
              <span className="mr-2 inline-block w-4 h-4">
                <Spinner />
              </span>
              Saving...
            </span>
          ) : (
            'Save to Pocket'
          )}
        </button>
        
        <button
          type="button"
          onClick={() => window.close()}
          className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};

export default SaveForm; 