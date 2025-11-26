import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to include auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Add response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export interface AnalysisResult {
  transcription: string;
  analysis: {
    sentiment: string;
    sentiment_confidence: number;
    emotion: string;
    emotion_confidence: number;
    toxicity_score: number;
    compliance_score: number;
  };
  explanation: any;
  enhanced_explanation: any;
  keyword_detection: any;
  audio_quality: any;
  sentiment_timeline: any;
  language: {
    whisper_detected: string;
    whisper_language_name: string;
    text_detected?: string;
    text_language_name?: string;
    final_detected?: string;
    final_language_name?: string;
    confidence: number;
    whisper_confidence?: number;
    text_confidence?: number;
    agreement?: boolean;
    model_used?: string;
    all_possible_languages?: Array<{code: string; name: string; confidence: number}>;
  };
  speaker_diarization: {
    segments: Array<{
      start: number;
      end: number;
      speaker: string;
      speaker_id: number;
    }>;
    speaker_stats: Record<string, {
      total_segments: number;
      total_time: number;
      percentage: number;
    }>;
    num_speakers_detected: number;
  } | null;
  speaker_timeline: Array<{
    start: number;
    end: number;
    text: string;
    speaker: string;
    speaker_id: number;
  }>;
  speaker_turns: any;
  conversation_analysis: any;
  alerts: {
    total: number;
    critical: number;
    warning: number;
    has_alerts: boolean;
    alerts?: Array<{
      level: string;
      message: string;
      metric: string;
      value: number;
      threshold: number;
      timestamp: string;
    }>;
  };
  custom_compliance_rules?: Array<{
    rule_id: number;
    rule_name: string;
    matched: boolean;
    severity: string;
    matches?: Array<{
      text: string;
      start: number;
      end: number;
      context?: string;
    }>;
    message?: string;
    value?: any;
    timestamp: string;
  }>;
  action_items?: {
    action_items: Array<{
      text: string;
      item_type: string;
      assigned_to?: string;
      deadline?: string;
      confidence: number;
      context?: string;
      start_pos: number;
      end_pos: number;
      timestamp: string;
    }>;
    statistics: {
      total: number;
      by_type: Record<string, number>;
      by_assignee: Record<string, number>;
      with_deadlines: number;
      deadline_distribution: Record<string, number>;
    };
  };
  summary?: {
    summary: string;
    summary_type: string;
    word_count: number;
    summary_word_count: number;
    compression_ratio: number;
    model?: string;
    note?: string;
  };
  topics?: {
    topics: Array<{
      topic_id: number;
      keywords: string[];
      keywords_scores?: number[];
      importance: number;
      representative_sentence?: string;
      word_count: number;
      frequency?: number;
    }>;
    num_topics: number;
    method: string;
    total_sentences?: number;
    total_phrases?: number;
  };
  intent?: {
    primary_intent: string;
    confidence: number;
    all_intents: Array<{
      intent: string;
      confidence: number;
      match_count?: number;
      matched_keywords?: string[];
    }>;
    method: string;
    matched_keywords?: string[];
    note?: string;
  };
  record_id?: number;
}

export interface HistoryRecord {
  id: number;
  filename: string;
  transcription: string;
  created_at: string;
  analysis: any;
}

export const apiService = {
  // Analyze audio
  analyzeAudio: async (file: File): Promise<AnalysisResult> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post<AnalysisResult>('/analyze_audio', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  },

  // Batch analyze
  batchAnalyze: async (files: File[]): Promise<any> => {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });

    const response = await api.post('/analyze_batch', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  },

  // Get history
  getHistory: async (params?: {
    limit?: number;
    offset?: number;
    min_score?: number;
    max_score?: number;
    days_back?: number;
    search?: string;
  }): Promise<{ records: HistoryRecord[]; total: number }> => {
    const response = await api.get('/history', { params });
    return response.data;
  },

  // Get single record
  getRecord: async (id: number): Promise<HistoryRecord> => {
    const response = await api.get(`/history/${id}`);
    return response.data;
  },

  // Delete record
  deleteRecord: async (id: number): Promise<void> => {
    await api.delete(`/history/${id}`);
  },

  // Get statistics
  getStatistics: async (days: number = 30): Promise<any> => {
    const response = await api.get('/statistics', { params: { days } });
    return response.data;
  },

  // Compare analyses
  compareAnalyses: async (recordIds: number[]): Promise<any> => {
    const response = await api.post('/compare', { record_ids: recordIds });
    return response.data;
  },

  // Generate PDF report
  generateReport: async (data: any): Promise<Blob> => {
    const response = await api.post('/generate_report', data, {
      responseType: 'blob',
    });
    return response.data;
  },

  // Export JSON
  exportJSON: async (recordId: number): Promise<any> => {
    const response = await api.get(`/export/json/${recordId}`);
    return response.data;
  },

  // Export CSV
  exportCSV: async (params?: {
    min_score?: number;
    max_score?: number;
    days_back?: number;
  }): Promise<Blob> => {
    const response = await api.get('/export/csv', {
      params,
      responseType: 'blob',
    });
    return response.data;
  },

  // Get supported languages
  getSupportedLanguages: async (): Promise<any> => {
    const response = await api.get('/supported_languages');
    return response.data;
  },

  // Compliance Rules API
  getComplianceRules: async (category?: string, isActive?: boolean): Promise<{ rules: ComplianceRule[]; count: number }> => {
    const params: any = {};
    if (category) params.category = category;
    if (isActive !== undefined) params.is_active = isActive;
    const response = await api.get('/compliance_rules', { params });
    return response.data;
  },

  getComplianceRule: async (id: number): Promise<ComplianceRule> => {
    const response = await api.get(`/compliance_rules/${id}`);
    return response.data;
  },

  createComplianceRule: async (rule: Partial<ComplianceRule>): Promise<ComplianceRule> => {
    const response = await api.post('/compliance_rules', rule);
    return response.data;
  },

  updateComplianceRule: async (id: number, rule: Partial<ComplianceRule>): Promise<ComplianceRule> => {
    const response = await api.put(`/compliance_rules/${id}`, rule);
    return response.data;
  },

  deleteComplianceRule: async (id: number): Promise<void> => {
    await api.delete(`/compliance_rules/${id}`);
  },

  testComplianceRule: async (id: number, text: string, analysis?: any): Promise<any> => {
    const response = await api.post(`/compliance_rules/${id}/test`, null, {
      params: { text, ...(analysis && { analysis }) },
    });
    return response.data;
  },

  // Scheduled Reports API
  getScheduledReports: async (isActive?: boolean): Promise<{ reports: ScheduledReport[]; count: number }> => {
    const params: any = {};
    if (isActive !== undefined) params.is_active = isActive;
    const response = await api.get('/scheduled_reports', { params });
    return response.data;
  },

  getScheduledReport: async (id: number): Promise<ScheduledReport> => {
    const response = await api.get(`/scheduled_reports/${id}`);
    return response.data;
  },

  createScheduledReport: async (report: Partial<ScheduledReport>): Promise<ScheduledReport> => {
    const response = await api.post('/scheduled_reports', report);
    return response.data;
  },

  updateScheduledReport: async (id: number, report: Partial<ScheduledReport>): Promise<ScheduledReport> => {
    const response = await api.put(`/scheduled_reports/${id}`, report);
    return response.data;
  },

  deleteScheduledReport: async (id: number): Promise<void> => {
    await api.delete(`/scheduled_reports/${id}`);
  },

  runScheduledReportNow: async (id: number): Promise<void> => {
    await api.post(`/scheduled_reports/${id}/run_now`);
  },

  // Webhooks API
  getWebhooks: async (isActive?: boolean): Promise<{ webhooks: Webhook[]; count: number }> => {
    const params: any = {};
    if (isActive !== undefined) params.is_active = isActive;
    const response = await api.get('/webhooks', { params });
    return response.data;
  },

  getWebhook: async (id: number): Promise<Webhook> => {
    const response = await api.get(`/webhooks/${id}`);
    return response.data;
  },

  createWebhook: async (webhook: Partial<Webhook>): Promise<Webhook> => {
    const response = await api.post('/webhooks', webhook);
    return response.data;
  },

  updateWebhook: async (id: number, webhook: Partial<Webhook>): Promise<Webhook> => {
    const response = await api.put(`/webhooks/${id}`, webhook);
    return response.data;
  },

  deleteWebhook: async (id: number): Promise<void> => {
    await api.delete(`/webhooks/${id}`);
  },

  testWebhook: async (id: number): Promise<any> => {
    const response = await api.post(`/webhooks/${id}/test`);
    return response.data;
  },

  // Notification Configs API
  getNotificationConfigs: async (isActive?: boolean): Promise<{ configs: NotificationConfig[]; count: number }> => {
    const params: any = {};
    if (isActive !== undefined) params.is_active = isActive;
    const response = await api.get('/notification_configs', { params });
    return response.data;
  },

  getNotificationConfig: async (id: number): Promise<NotificationConfig> => {
    const response = await api.get(`/notification_configs/${id}`);
    return response.data;
  },

  createNotificationConfig: async (config: Partial<NotificationConfig>): Promise<NotificationConfig> => {
    const response = await api.post('/notification_configs', config);
    return response.data;
  },

  updateNotificationConfig: async (id: number, config: Partial<NotificationConfig>): Promise<NotificationConfig> => {
    const response = await api.put(`/notification_configs/${id}`, config);
    return response.data;
  },

  deleteNotificationConfig: async (id: number): Promise<void> => {
    await api.delete(`/notification_configs/${id}`);
  },

  testNotificationConfig: async (id: number): Promise<any> => {
    const response = await api.post(`/notification_configs/${id}/test`);
    return response.data;
  },
};

export interface Webhook {
  id?: number;
  name: string;
  description?: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT';
  headers?: Record<string, string>;
  auth_type: 'none' | 'bearer' | 'basic' | 'custom';
  auth_config?: Record<string, any>;
  trigger_on_critical: boolean;
  trigger_on_warning: boolean;
  trigger_on_compliance_low: boolean;
  trigger_on_custom_rule: boolean;
  min_compliance_score?: number;
  payload_template?: Record<string, any>;
  include_transcription: boolean;
  include_analysis: boolean;
  is_active: boolean;
  last_triggered?: string;
  success_count: number;
  failure_count: number;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface NotificationConfig {
  id?: number;
  name: string;
  description?: string;
  email_recipients: string[];
  notify_on_critical: boolean;
  notify_on_warning: boolean;
  notify_on_compliance_low: boolean;
  notify_on_custom_rule: boolean;
  min_compliance_score?: number;
  email_subject_template?: string;
  email_body_template?: string;
  rate_limit_minutes: number;
  is_active: boolean;
  last_sent?: string;
  sent_count: number;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ScheduledReport {
  id?: number;
  name: string;
  description?: string;
  schedule_type: 'daily' | 'weekly' | 'monthly' | 'custom';
  schedule_config: {
    hour?: number;
    minute?: number;
    day_of_week?: number;
    day?: number;
    cron_expression?: string;
  };
  timezone: string;
  report_type: 'summary' | 'detailed';
  filters?: {
    start_date?: string;
    end_date?: string;
    min_score?: number;
    max_score?: number;
  };
  email_recipients: string[];
  email_subject?: string;
  email_body_template?: string;
  is_active: boolean;
  last_run?: string;
  next_run?: string;
  run_count: number;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ComplianceRule {
  id?: number;
  name: string;
  description?: string;
  rule_type: 'regex' | 'keyword' | 'sentiment' | 'toxicity' | 'emotion' | 'compliance_score' | 'custom';
  pattern?: string;
  condition: string;
  threshold?: number;
  severity: 'critical' | 'warning' | 'info';
  category?: string;
  is_active: boolean;
  priority: number;
  created_by?: string;
  config?: any;
  created_at?: string;
  updated_at?: string;
}

// ============================================================================
// Authentication APIs
// ============================================================================

export interface User {
  id: number;
  username: string;
  email: string;
  full_name?: string;
  is_active: boolean;
  is_superuser: boolean;
  roles: string[];
  teams: string[];
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  full_name?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
}

export const authApi = {
  login: async (credentials: LoginRequest): Promise<AuthResponse> => {
    const response = await api.post('/api/auth/login', credentials);
    const { access_token } = response.data;
    localStorage.setItem('auth_token', access_token);
    return response.data;
  },

  register: async (userData: RegisterRequest): Promise<User> => {
    const response = await api.post('/api/auth/register', userData);
    return response.data;
  },

  getCurrentUser: async (): Promise<User> => {
    const response = await api.get('/api/auth/me');
    localStorage.setItem('user', JSON.stringify(response.data));
    return response.data;
  },

  logout: () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
  },

  isAuthenticated: (): boolean => {
    return !!localStorage.getItem('auth_token');
  },

  getStoredUser: (): User | null => {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },
};

// ============================================================================
// Users Management APIs
// ============================================================================

export interface Role {
  id: number;
  name: string;
  description?: string;
}

export interface DatabaseResetRequest {
  confirm: boolean;
  reset_analyses?: boolean;
  reset_users?: boolean;
  reset_rules?: boolean;
  reset_schedules?: boolean;
}

export const usersApi = {
  listUsers: async (skip: number = 0, limit: number = 100): Promise<User[]> => {
    const response = await api.get('/api/users', { params: { skip, limit } });
    return response.data;
  },

  getUser: async (userId: number): Promise<User> => {
    const response = await api.get(`/api/users/${userId}`);
    return response.data;
  },

  updateUser: async (userId: number, userData: Partial<User>): Promise<User> => {
    const response = await api.put(`/api/users/${userId}`, userData);
    return response.data;
  },

  deleteUser: async (userId: number): Promise<{ message: string }> => {
    const response = await api.delete(`/api/users/${userId}`);
    return response.data;
  },

  listRoles: async (): Promise<Role[]> => {
    const response = await api.get('/api/roles');
    return response.data;
  },

  assignRole: async (userId: number, roleId: number): Promise<{ message: string }> => {
    const response = await api.post(`/api/users/${userId}/roles`, { role_id: roleId });
    return response.data;
  },

  removeRole: async (userId: number, roleId: number): Promise<{ message: string }> => {
    const response = await api.delete(`/api/users/${userId}/roles/${roleId}`);
    return response.data;
  },

  resetDatabase: async (resetRequest: DatabaseResetRequest): Promise<{
    message: string;
    reset_analyses: boolean;
    reset_users: boolean;
    reset_rules: boolean;
    reset_schedules: boolean;
  }> => {
    const response = await api.post('/api/admin/reset-database', resetRequest);
    return response.data;
  },
};

// ============================================================================
// Comments APIs
// ============================================================================

export interface Comment {
  id: number;
  analysis_id: number;
  user_id: number;
  author: string;
  author_name?: string;
  content: string;
  parent_comment_id?: number;
  created_at: string;
  updated_at: string;
  is_edited: boolean;
  reply_count: number;
}

export interface CommentCreate {
  analysis_id: number;
  content: string;
  parent_comment_id?: number;
}

export const commentsApi = {
  getComments: async (analysisId: number): Promise<Comment[]> => {
    const response = await api.get(`/api/comments/analysis/${analysisId}`);
    return response.data;
  },

  createComment: async (comment: CommentCreate): Promise<Comment> => {
    const response = await api.post('/api/comments', comment);
    return response.data;
  },

  updateComment: async (commentId: number, content: string): Promise<Comment> => {
    const response = await api.put(`/api/comments/${commentId}`, { content });
    return response.data;
  },

  deleteComment: async (commentId: number): Promise<void> => {
    await api.delete(`/api/comments/${commentId}`);
  },
};

// ============================================================================
// Tags APIs
// ============================================================================

export interface Tag {
  id: number;
  name: string;
  color?: string;
  description?: string;
  category?: string;
  created_at: string;
  created_by?: number;
  usage_count: number;
}

export interface TagCreate {
  name: string;
  color?: string;
  description?: string;
  category?: string;
}

export const tagsApi = {
  listTags: async (category?: string): Promise<Tag[]> => {
    const params = category ? { category } : {};
    const response = await api.get('/api/tags', { params });
    return response.data;
  },

  createTag: async (tag: TagCreate): Promise<Tag> => {
    const response = await api.post('/api/tags', tag);
    return response.data;
  },

  updateTag: async (tagId: number, tag: Partial<TagCreate>): Promise<Tag> => {
    const response = await api.put(`/api/tags/${tagId}`, tag);
    return response.data;
  },

  deleteTag: async (tagId: number): Promise<void> => {
    await api.delete(`/api/tags/${tagId}`);
  },

  addTagToAnalysis: async (analysisId: number, tagId: number): Promise<void> => {
    await api.post(`/api/analyses/${analysisId}/tags/${tagId}`);
  },

  removeTagFromAnalysis: async (analysisId: number, tagId: number): Promise<void> => {
    await api.delete(`/api/analyses/${analysisId}/tags/${tagId}`);
  },
};

// ============================================================================
// Teams APIs
// ============================================================================

export interface Team {
  id: number;
  name: string;
  description?: string;
  department?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by?: number;
  member_count: number;
  members: Array<{ id: number; username: string; full_name?: string }>;
}

export interface TeamCreate {
  name: string;
  description?: string;
  department?: string;
}

export const teamsApi = {
  listTeams: async (department?: string): Promise<Team[]> => {
    const params = department ? { department } : {};
    const response = await api.get('/api/teams', { params });
    return response.data;
  },

  getTeam: async (teamId: number): Promise<Team> => {
    const response = await api.get(`/api/teams/${teamId}`);
    return response.data;
  },

  createTeam: async (team: TeamCreate): Promise<Team> => {
    const response = await api.post('/api/teams', team);
    return response.data;
  },

  updateTeam: async (teamId: number, team: Partial<TeamCreate>): Promise<Team> => {
    const response = await api.put(`/api/teams/${teamId}`, team);
    return response.data;
  },

  deleteTeam: async (teamId: number): Promise<void> => {
    await api.delete(`/api/teams/${teamId}`);
  },

  addMember: async (teamId: number, userId: number): Promise<void> => {
    await api.post(`/api/teams/${teamId}/members/${userId}`);
  },

  removeMember: async (teamId: number, userId: number): Promise<void> => {
    await api.delete(`/api/teams/${teamId}/members/${userId}`);
  },
};

export default api;

