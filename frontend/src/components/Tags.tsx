import { useState, useEffect, useId, useRef } from 'react';
import type { FormEvent } from 'react';
import clsx from 'clsx';
import { Plus, Search, X } from 'lucide-react';
import { tagsApi } from '../services/api';
import type { Tag, TagCreate } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardBody, CardHeader, Field, Modal, Spinner, useToast } from './ui';
import { errorDetail } from '../utils/errors';

interface TagsProps {
  analysisId: number;
  currentTags?: Tag[];
  onTagsChange?: () => void;
}

// Stable default: a fresh `[]` on every render changed the effect's dependencies each
// time, which re-fetched the tag list in an endless loop.
const NO_TAGS: Tag[] = [];

/** Small round swatch in the tag's own color. The chip text stays in text tokens. */
function TagSwatch({ color }: { color?: string }) {
  return (
    <span
      aria-hidden="true"
      className={clsx('h-2 w-2 shrink-0 rounded-full ring-1 ring-inset ring-fg/10', !color && 'bg-fg-faint')}
      style={color ? { backgroundColor: color } : undefined}
    />
  );
}

interface AddTagMenuProps {
  options: Tag[];
  hasAnyTags: boolean;
  disabled?: boolean;
  onSelect: (tag: Tag) => void;
  onCreate: (name: string) => void;
}

/** "Add tag" button with a searchable popover of the tags not yet on this call. */
function AddTagMenu({ options, hasAnyTags, disabled, onSelect, onCreate }: AddTagMenuProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  const choose = (tag: Tag) => {
    close();
    triggerRef.current?.focus();
    onSelect(tag);
  };

  const trimmed = query.trim();
  const needle = trimmed.toLowerCase();
  const filtered = needle
    ? options.filter((tag) => tag.name.toLowerCase().includes(needle) || tag.category?.toLowerCase().includes(needle))
    : options;

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className="btn btn-secondary btn-sm"
      >
        <Plus />
        Add tag
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Add tag"
          className="absolute right-0 top-full z-20 mt-1.5 w-64 animate-dropdown-in overflow-hidden rounded-lg border border-line bg-surface shadow-overlay"
        >
          <div className="relative border-b border-line p-2">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-faint" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && filtered[0]) {
                  e.preventDefault();
                  choose(filtered[0]);
                }
              }}
              placeholder="Find a tag"
              aria-label="Find a tag"
              className="input py-1 pl-8 text-[13px]"
              autoFocus
            />
          </div>

          {filtered.length > 0 ? (
            <ul className="max-h-60 overflow-y-auto p-1">
              {filtered.map((tag) => (
                <li key={tag.id}>
                  <button
                    type="button"
                    onClick={() => choose(tag)}
                    title={tag.description || undefined}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-fg transition-colors hover:bg-surface-subtle focus-visible:bg-surface-subtle focus-visible:outline-none"
                  >
                    <TagSwatch color={tag.color} />
                    <span className="min-w-0 flex-1 truncate">{tag.name}</span>
                    {tag.category && <span className="shrink-0 text-xs text-fg-subtle">{tag.category}</span>}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-3 text-[13px] text-fg-subtle">
              {trimmed ? 'No matching tags.' : hasAnyTags ? 'Every tag is already on this call.' : 'No tags yet.'}
            </p>
          )}

          <div className="border-t border-line p-1">
            <button
              type="button"
              onClick={() => {
                close();
                // Park focus on the trigger so the create dialog hands it back there on close.
                triggerRef.current?.focus();
                onCreate(trimmed);
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-fg-muted transition-colors hover:bg-surface-subtle hover:text-fg focus-visible:bg-surface-subtle focus-visible:outline-none"
            >
              <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 truncate">{trimmed ? `Create “${trimmed}”` : 'Create tag'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Tags({ analysisId, currentTags = NO_TAGS, onTagsChange }: TagsProps) {
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [tags, setTags] = useState<Tag[]>(currentTags);
  const [showCreate, setShowCreate] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3B82F6');
  const [newTagCategory, setNewTagCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const toast = useToast();
  const formId = useId();

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
      toast.error('Could not load tags', errorDetail(error));
    }
  };

  const handleAddTag = async (tagId: number, tag?: Tag) => {
    setLoading(true);
    try {
      await tagsApi.addTagToAnalysis(analysisId, tagId);
      await loadTags();
      // There is no endpoint here to re-read this call's tags, so show the change locally.
      const added = tag ?? allTags.find((t) => t.id === tagId);
      if (added) setTags((prev) => (prev.some((t) => t.id === added.id) ? prev : [...prev, added]));
      onTagsChange?.();
    } catch (error) {
      console.error('Failed to add tag:', error);
      toast.error('Could not add tag', errorDetail(error));
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveTag = async (tagId: number) => {
    setLoading(true);
    try {
      await tagsApi.removeTagFromAnalysis(analysisId, tagId);
      await loadTags();
      setTags((prev) => prev.filter((t) => t.id !== tagId));
      onTagsChange?.();
    } catch (error) {
      console.error('Failed to remove tag:', error);
      toast.error('Could not remove tag', errorDetail(error));
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

  const handleCreateTag = async (e: FormEvent) => {
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
      await handleAddTag(createdTag.id, createdTag);
      setShowCreate(false);
      setNewTagName('');
      setNewTagCategory('');
      toast.success('Tag created');
    } catch (error) {
      console.error('Failed to create tag:', error);
      toast.error('Could not create tag', errorDetail(error));
    } finally {
      setLoading(false);
    }
  };

  const availableTags = allTags.filter(tag => !tags.some(t => t.id === tag.id));

  return (
    <>
      <Card>
        <CardHeader
          title="Tags"
          description="Label this call for filtering and follow-up."
          actions={
            user && (
              <AddTagMenu
                options={availableTags}
                hasAnyTags={allTags.length > 0}
                disabled={loading}
                onSelect={(tag) => handleAddTag(tag.id, tag)}
                onCreate={(name) => {
                  if (name) setNewTagName(name);
                  setShowCreate(true);
                }}
              />
            )
          }
        />
        <CardBody>
          {tags.length > 0 ? (
            <ul className="flex flex-wrap items-center gap-2" aria-label="Tags on this call">
              {tags.map((tag) => (
                <li
                  key={tag.id}
                  className={clsx('badge badge-neutral text-fg', user && 'pr-1')}
                  title={tag.description || tag.category || undefined}
                >
                  <TagSwatch color={tag.color} />
                  {tag.name}
                  {user && (
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag.id)}
                      disabled={loading}
                      aria-label={`Remove tag ${tag.name}`}
                      title="Remove tag"
                      className="grid h-4 w-4 place-items-center rounded-sm text-fg-faint transition-colors hover:bg-surface-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <X className="h-3 w-3" aria-hidden="true" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-fg-subtle">No tags on this call yet.</p>
          )}
        </CardBody>
      </Card>

      <Modal
        open={showCreate && Boolean(user)}
        onClose={() => setShowCreate(false)}
        title="Create tag"
        description="The new tag is added to this call and can be reused on any analysis."
        footer={
          <>
            <button type="button" onClick={() => setShowCreate(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" form={formId} disabled={loading} className="btn btn-primary">
              {loading && <Spinner />}
              Create tag
            </button>
          </>
        }
      >
        <form id={formId} onSubmit={handleCreateTag} className="space-y-4">
          <Field label="Name" htmlFor={`${formId}-name`} required>
            <input
              id={`${formId}-name`}
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="e.g. Escalation"
              required
              className="input"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Color" htmlFor={`${formId}-color`}>
              <div className="flex items-center gap-3">
                <input
                  id={`${formId}-color`}
                  type="color"
                  value={newTagColor}
                  onChange={(e) => setNewTagColor(e.target.value)}
                  className="h-9 w-12 shrink-0 cursor-pointer rounded-md border border-line-strong bg-surface p-1 shadow-xs focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/15 [&::-moz-color-swatch]:rounded [&::-moz-color-swatch]:border-none [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded [&::-webkit-color-swatch]:border-none"
                />
                <span className="badge badge-neutral min-w-0 text-fg">
                  <TagSwatch color={newTagColor} />
                  <span className="min-w-0 truncate">{newTagName.trim() || 'Preview'}</span>
                </span>
              </div>
            </Field>
            <Field label="Category" htmlFor={`${formId}-category`} help="Optional. Groups related tags.">
              <input
                id={`${formId}-category`}
                type="text"
                value={newTagCategory}
                onChange={(e) => setNewTagCategory(e.target.value)}
                placeholder="e.g. Priority"
                className="input"
              />
            </Field>
          </div>
        </form>
      </Modal>
    </>
  );
}
