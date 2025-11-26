import { useState, useEffect } from 'react';
import { commentsApi, Comment, CommentCreate } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface CommentsProps {
  analysisId: number;
}

export default function Comments({ analysisId }: CommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    loadComments();
  }, [analysisId]);

  const loadComments = async () => {
    try {
      const data = await commentsApi.getComments(analysisId);
      setComments(data);
    } catch (error) {
      console.error('Failed to load comments:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
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
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (commentId: number) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;

    setLoading(true);
    try {
      await commentsApi.deleteComment(commentId);
      await loadComments();
    } catch (error) {
      console.error('Failed to delete comment:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const renderComment = (comment: Comment, level = 0) => {
    const isAuthor = user && comment.user_id === user.id;
    const isEditing = editingId === comment.id;
    const isReplying = replyingTo === comment.id;
    const replies = comments.filter(c => c.parent_comment_id === comment.id);

    return (
      <div key={comment.id} className={`${level > 0 ? 'ml-8 mt-4' : 'mt-4'}`}>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-gray-900 dark:text-white">
                  {comment.author_name || comment.author}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {formatDate(comment.created_at)}
                </span>
                {comment.is_edited && (
                  <span className="text-xs text-gray-400 dark:text-gray-500">(edited)</span>
                )}
              </div>
              {isEditing ? (
                <div className="mt-2">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    rows={3}
                  />
                  <div className="mt-2 flex space-x-2">
                    <button
                      onClick={() => handleEdit(comment.id)}
                      className="px-3 py-1 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditingId(null);
                        setEditText('');
                      }}
                      className="px-3 py-1 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded text-sm hover:bg-gray-300 dark:hover:bg-gray-500"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {comment.content}
                </p>
              )}
            </div>
            {(isAuthor || user?.is_superuser) && !isEditing && (
              <div className="flex space-x-2 ml-4">
                <button
                  onClick={() => {
                    setEditingId(comment.id);
                    setEditText(comment.content);
                  }}
                  className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(comment.id)}
                  className="text-sm text-red-600 dark:text-red-400 hover:underline"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
          {!isEditing && (
            <div className="mt-2">
              <button
                onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                {isReplying ? 'Cancel' : 'Reply'}
              </button>
            </div>
          )}
          {isReplying && (
            <div className="mt-3">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Write a reply..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                rows={2}
              />
              <div className="mt-2 flex space-x-2">
                <button
                  onClick={() => handleReply(comment.id)}
                  className="px-3 py-1 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700"
                >
                  Post Reply
                </button>
                <button
                  onClick={() => {
                    setReplyingTo(null);
                    setReplyText('');
                  }}
                  className="px-3 py-1 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded text-sm hover:bg-gray-300 dark:hover:bg-gray-500"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
        {replies.length > 0 && (
          <div className="mt-2">
            {replies.map((reply) => renderComment(reply, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const topLevelComments = comments.filter(c => !c.parent_comment_id);

  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">💬 Comments</h3>

      {user ? (
        <form onSubmit={handleSubmit} className="mb-6">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            rows={3}
          />
          <button
            type="submit"
            disabled={loading || !newComment.trim()}
            className="mt-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Posting...' : 'Post Comment'}
          </button>
        </form>
      ) : (
        <p className="text-gray-500 dark:text-gray-400 mb-4">
          Please <a href="/login" className="text-indigo-600 dark:text-indigo-400 hover:underline">login</a> to add comments.
        </p>
      )}

      <div className="space-y-4">
        {topLevelComments.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">No comments yet. Be the first to comment!</p>
        ) : (
          topLevelComments.map((comment) => renderComment(comment))
        )}
      </div>
    </div>
  );
}

