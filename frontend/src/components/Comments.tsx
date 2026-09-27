import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import clsx from 'clsx';
import { MessageSquare, Pencil, Reply, Trash2 } from 'lucide-react';
import { commentsApi } from '../services/api';
import type { Comment, CommentCreate } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { formatDateTime, formatRelative } from '../utils/format';
import { Avatar, Card, CardHeader, EmptyState, IconButton, LoadingState, useConfirm, useToast } from './ui';
import { errorDetail } from '../utils/errors';

interface CommentsProps {
  analysisId: number;
}

// The API sends naive UTC timestamps ("2025-11-24T10:00:00"). Read them as UTC so
// relative times ("3 minutes ago") are right in every time zone.
const HAS_ZONE = /(?:[zZ]|[+-]\d{2}:?\d{2})$/;
const asUtc = (value: string) => (value && !HAS_ZONE.test(value) ? `${value}Z` : value);

export default function Comments({ analysisId }: CommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  useEffect(() => {
    loadComments();
  }, [analysisId]);

  const loadComments = async () => {
    try {
      const data = await commentsApi.getComments(analysisId);
      setComments(data);
    } catch (error) {
      console.error('Failed to load comments:', error);
      toast.error('Could not load comments', errorDetail(error));
    } finally {
      setInitialLoad(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setLoading(true);
    try {
      const commentData: CommentCreate = {
        analysis_id: analysisId,
        content: newComment,
      };
      await commentsApi.createComment(commentData);
      setNewComment('');
      await loadComments();
    } catch (error) {
      console.error('Failed to create comment:', error);
      toast.error('Could not post comment', errorDetail(error));
    } finally {
      setLoading(false);
    }
  };

  const handleReply = async (parentId: number) => {
    if (!replyText.trim()) return;

    setLoading(true);
    try {
      const commentData: CommentCreate = {
        analysis_id: analysisId,
        content: replyText,
        parent_comment_id: parentId,
      };
      await commentsApi.createComment(commentData);
      setReplyText('');
      setReplyingTo(null);
      await loadComments();
    } catch (error) {
      console.error('Failed to create reply:', error);
      toast.error('Could not post reply', errorDetail(error));
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async (commentId: number) => {
    if (!editText.trim()) return;

    setLoading(true);
    try {
      await commentsApi.updateComment(commentId, editText);
      setEditingId(null);
      setEditText('');
      await loadComments();
    } catch (error) {
      console.error('Failed to update comment:', error);
      toast.error('Could not save changes', errorDetail(error));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (commentId: number) => {
    const confirmed = await confirm({
      title: 'Delete comment?',
      description: 'This comment will be permanently removed. This can’t be undone.',
      confirmLabel: 'Delete comment',
    });
    if (!confirmed) return;

    setLoading(true);
    try {
      await commentsApi.deleteComment(commentId);
      toast.success('Comment deleted');
      await loadComments();
    } catch (error) {
      console.error('Failed to delete comment:', error);
      toast.error('Could not delete comment', errorDetail(error));
    } finally {
      setLoading(false);
    }
  };

  const renderComment = (comment: Comment, level = 0) => {
    const isAuthor = user && comment.user_id === user.id;
    const isEditing = editingId === comment.id;
    const isReplying = replyingTo === comment.id;
    const replies = comments.filter(c => c.parent_comment_id === comment.id);
    const authorName = comment.author_name || comment.author || 'Unknown user';

    return (
      <div key={comment.id} className="flex gap-3">
        <Avatar name={authorName} size={level > 0 ? 'sm' : 'md'} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 pt-1">
              <span className="truncate text-sm font-medium text-fg">{authorName}</span>
              <time dateTime={asUtc(comment.created_at)} title={formatDateTime(asUtc(comment.created_at))} className="text-xs text-fg-subtle">
                {formatRelative(asUtc(comment.created_at))}
              </time>
              {comment.is_edited && <span className="text-xs text-fg-faint">Edited</span>}
            </div>
            {!isEditing && (
              <div className="-mr-2 -mt-0.5 flex shrink-0 items-center gap-0.5">
                <IconButton
                  icon={Reply}
                  label="Reply"
                  aria-expanded={isReplying}
                  onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                  className={clsx(isReplying && 'bg-surface-subtle text-fg')}
                />
                {(isAuthor || user?.is_superuser) && (
                  <>
                    <IconButton
                      icon={Pencil}
                      label="Edit comment"
                      onClick={() => {
                        setEditingId(comment.id);
                        setEditText(comment.content);
                      }}
                    />
                    <IconButton icon={Trash2} label="Delete comment" tone="danger" onClick={() => handleDelete(comment.id)} />
                  </>
                )}
              </div>
            )}
          </div>

          {isEditing ? (
            <div className="mt-2 space-y-2">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                aria-label="Edit comment"
                className="input"
                rows={3}
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setEditText('');
                  }}
                  className="btn btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleEdit(comment.id)}
                  disabled={loading || !editText.trim()}
                  className="btn btn-primary btn-sm"
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-fg">{comment.content}</p>
          )}

          {isReplying && (
            <div className="mt-3 space-y-2">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder={`Reply to ${authorName}`}
                aria-label={`Reply to ${authorName}`}
                className="input"
                rows={2}
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setReplyingTo(null);
                    setReplyText('');
                  }}
                  className="btn btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleReply(comment.id)}
                  disabled={loading || !replyText.trim()}
                  className="btn btn-primary btn-sm"
                >
                  Reply
                </button>
              </div>
            </div>
          )}

          {replies.length > 0 && (
            <div className="mt-4 space-y-4 border-l border-line pl-4">
              {replies.map((reply) => renderComment(reply, level + 1))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const topLevelComments = comments.filter(c => !c.parent_comment_id);

  return (
    <Card>
      <CardHeader title="Comments" description="Discuss this call with your team." />

      {initialLoad ? (
        <LoadingState label="Loading comments…" className="py-10" />
      ) : topLevelComments.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No comments yet"
          description="Start the discussion with a note or question about this call."
          className="py-10"
        />
      ) : (
        <ul className="divide-y divide-line">
          {topLevelComments.map((comment) => (
            <li key={comment.id} className="px-5 py-4">
              {renderComment(comment)}
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-line px-5 py-4">
        {user ? (
          <form onSubmit={handleSubmit} className="flex gap-3">
            <Avatar name={user.full_name || user.username} />
            <div className="min-w-0 flex-1 space-y-2">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment"
                aria-label="Add a comment"
                className="input"
                rows={3}
              />
              <div className="flex justify-end">
                <button type="submit" disabled={loading || !newComment.trim()} className="btn btn-primary">
                  Comment
                </button>
              </div>
            </div>
          </form>
        ) : (
          <p className="text-sm text-fg-subtle">
            <a href="/login" className="link">
              Sign in
            </a>{' '}
            to join the discussion.
          </p>
        )}
      </div>
    </Card>
  );
}
