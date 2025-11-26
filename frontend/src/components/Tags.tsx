import { useState, useEffect } from 'react';
import { tagsApi, Tag, TagCreate } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface TagsProps {
  analysisId: number;
  currentTags?: Tag[];
  onTagsChange?: () => void;
}

export default function Tags({ analysisId, currentTags = [], onTagsChange }: TagsProps) {
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [tags, setTags] = useState<Tag[]>(currentTags);
  const [showCreate, setShowCreate] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3B82F6');
  const [newTagCategory, setNewTagCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    loadAllTags();
    if (currentTags.length > 0) {
      setTags(currentTags);
    }
  }, [analysisId, currentTags]);

  const loadAllTags = async () => {
    try {
      const data = await tagsApi.listTags();
      setAllTags(data);
    } catch (error) {
      console.error('Failed to load tags:', error);
    }
  };

  const handleAddTag = async (tagId: number) => {
    setLoading(true);
    try {
      await tagsApi.addTagToAnalysis(analysisId, tagId);
      await loadTags();
      onTagsChange?.();
    } catch (error) {
      console.error('Failed to add tag:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveTag = async (tagId: number) => {
    setLoading(true);
    try {
      await tagsApi.removeTagFromAnalysis(analysisId, tagId);
      await loadTags();
      onTagsChange?.();
    } catch (error) {
      console.error('Failed to remove tag:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTags = async () => {
    // In a real implementation, you'd fetch tags for this analysis
    // For now, we'll use the currentTags prop
    if (currentTags.length > 0) {
      setTags(currentTags);
    }
  };

  const handleCreateTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim()) return;

    setLoading(true);
    try {
      const tagData: TagCreate = {
        name: newTagName,
        color: newTagColor,
        category: newTagCategory || undefined,
      };
      const createdTag = await tagsApi.createTag(tagData);
      await loadAllTags();
      // Automatically add the new tag to this analysis
      await handleAddTag(createdTag.id);
      setShowCreate(false);
      setNewTagName('');
      setNewTagCategory('');
    } catch (error: any) {
      console.error('Failed to create tag:', error);
      alert(error.response?.data?.detail || 'Failed to create tag');
    } finally {
      setLoading(false);
    }
  };

  const availableTags = allTags.filter(tag => !tags.some(t => t.id === tag.id));

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">🏷️ Tags</h3>
        {user && (
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="text-sm px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700"
          >
            {showCreate ? 'Cancel' : '+ Create Tag'}
          </button>
        )}
      </div>

      {showCreate && user && (
        <form onSubmit={handleCreateTag} className="mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="space-y-3">
            <input
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="Tag name"
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <div className="flex space-x-2">
              <input
                type="color"
                value={newTagColor}
                onChange={(e) => setNewTagColor(e.target.value)}
                className="h-10 w-20 border border-gray-300 dark:border-gray-600 rounded"
              />
              <input
                type="text"
                value={newTagCategory}
                onChange={(e) => setNewTagCategory(e.target.value)}
                placeholder="Category (optional)"
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Tag'}
            </button>
          </div>
        </form>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        {tags.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium"
            style={{
              backgroundColor: tag.color ? `${tag.color}20` : '#3B82F620',
              color: tag.color || '#3B82F6',
            }}
          >
            {tag.name}
            {user && (
              <button
                onClick={() => handleRemoveTag(tag.id)}
                className="ml-2 text-red-600 hover:text-red-800"
                title="Remove tag"
              >
                ×
              </button>
            )}
          </span>
        ))}
      </div>

      {availableTags.length > 0 && user && (
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Add existing tags:</p>
          <div className="flex flex-wrap gap-2">
            {availableTags.map((tag) => (
              <button
                key={tag.id}
                onClick={() => handleAddTag(tag.id)}
                disabled={loading}
                className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                + {tag.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

