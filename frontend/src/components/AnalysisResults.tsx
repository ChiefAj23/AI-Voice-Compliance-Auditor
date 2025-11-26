import { AnalysisResult } from '../services/api';
import { AlertTriangle, CheckCircle2, AlertCircle, Users, Languages, MessageSquare, Shield, CheckSquare, Calendar, User, FileText, Tag, Target } from 'lucide-react';
import ComplianceGauge from './ComplianceGauge';
import SentimentTimeline from './SentimentTimeline';
import AudioPlayer from './AudioPlayer';
import Comments from './Comments';
import Tags from './Tags';

interface AnalysisResultsProps {
  result: AnalysisResult;
  audioFile?: File | null;
}

export default function AnalysisResults({ result, audioFile }: AnalysisResultsProps) {
  const analysis = result.analysis;
  const alerts = result.alerts;

  return (
    <div className="space-y-6">
      {/* Alerts Section */}
      {alerts?.has_alerts && (
        <div className="card border-l-4 border-red-500">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <AlertTriangle className="mr-2 h-5 w-5 text-red-600" />
            Compliance Alerts
          </h2>

          {alerts.critical > 0 && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center mb-2">
                <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
                <span className="font-semibold text-red-800">
                  {alerts.critical} Critical Alert(s)
                </span>
              </div>
              <p className="text-sm text-red-700">Immediate attention required!</p>
            </div>
          )}

          {alerts.warning > 0 && (
            <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center mb-2">
                <AlertCircle className="h-5 w-5 text-yellow-600 mr-2" />
                <span className="font-semibold text-yellow-800">
                  {alerts.warning} Warning(s)
                </span>
              </div>
              <p className="text-sm text-yellow-700">Review recommended</p>
            </div>
          )}

          {alerts.alerts && alerts.alerts.length > 0 && (
            <div className="mt-4 space-y-2">
              {alerts.alerts.map((alert, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg ${
                    alert.level === 'critical'
                      ? 'bg-red-50 border border-red-200'
                      : 'bg-yellow-50 border border-yellow-200'
                  }`}
                >
                  <p className="text-sm font-medium">{alert.message}</p>
                  <p className="text-xs text-gray-600 mt-1">
                    {new Date(alert.timestamp).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Custom Compliance Rules */}
      {result.custom_compliance_rules && result.custom_compliance_rules.length > 0 && (
        <div className="card border-l-4 border-purple-500">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <Shield className="mr-2 h-5 w-5 text-purple-600" />
            Custom Compliance Rules Violations
          </h2>
          <div className="space-y-3">
            {result.custom_compliance_rules.map((rule: any, idx: number) => (
              <div
                key={idx}
                className={`p-4 rounded-lg border ${
                  rule.severity === 'critical'
                    ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                    : rule.severity === 'warning'
                    ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                    : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {rule.severity === 'critical' && (
                        <AlertTriangle className="h-5 w-5 text-red-600" />
                      )}
                      {rule.severity === 'warning' && (
                        <AlertCircle className="h-5 w-5 text-yellow-600" />
                      )}
                      {rule.severity === 'info' && (
                        <CheckCircle2 className="h-5 w-5 text-blue-600" />
                      )}
                      <span className="font-semibold capitalize">
                        {rule.severity}: {rule.rule_name}
                      </span>
                    </div>
                    {rule.message && (
                      <p className="text-sm mb-2">{rule.message}</p>
                    )}
                    {rule.matches && rule.matches.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-semibold mb-1">Found {rule.matches.length} match(es):</p>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {rule.matches.map((match: any, matchIdx: number) => (
                            <div key={matchIdx} className="text-xs bg-white dark:bg-gray-800 p-2 rounded">
                              <span className="font-mono bg-yellow-100 dark:bg-yellow-900/30 px-1 rounded">
                                {match.text}
                              </span>
                              {match.context && (
                                <p className="text-gray-600 dark:text-gray-400 mt-1">
                                  ...{match.context}...
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {rule.value !== undefined && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        Value: {rule.value}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Language Detection */}
      {result.language && (
        <div className="card bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center mb-4">
            <Languages className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2" />
            <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-300">Language Detection</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            <div>
              <p className="text-sm text-blue-700 dark:text-blue-400 mb-1">Detected Language</p>
              <p className="text-xl font-bold text-blue-900 dark:text-blue-200">
                {result.language.final_language_name || result.language.whisper_language_name || result.language.text_language_name || 'Unknown'}
              </p>
              {result.language.agreement !== undefined && (
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  {result.language.agreement ? '✓ Both methods agree' : '⚠ Methods differ'}
                </p>
              )}
            </div>
            <div>
              <p className="text-sm text-blue-700 dark:text-blue-400 mb-1">Confidence</p>
              <p className="text-xl font-bold text-blue-900 dark:text-blue-200">
                {((result.language.confidence || 0) * 100).toFixed(1)}%
              </p>
              {result.language.whisper_confidence && result.language.text_confidence && (
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  Whisper: {((result.language.whisper_confidence || 0) * 100).toFixed(0)}% |
                  Text: {((result.language.text_confidence || 0) * 100).toFixed(0)}%
                </p>
              )}
            </div>
            <div>
              <p className="text-sm text-blue-700 dark:text-blue-400 mb-1">Language Code</p>
              <p className="text-xl font-bold text-blue-900 dark:text-blue-200">
                {result.language.final_detected || result.language.whisper_detected || result.language.text_detected || 'N/A'}
              </p>
              {result.language.model_used && (
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  Model: {result.language.model_used}
                </p>
              )}
            </div>
          </div>
          {result.language.all_possible_languages && result.language.all_possible_languages.length > 0 && (
            <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-700">
              <p className="text-sm text-blue-700 dark:text-blue-400 mb-2">Other Possible Languages:</p>
              <div className="flex flex-wrap gap-2">
                {result.language.all_possible_languages.slice(0, 5).map((lang: any, idx: number) => (
                  <span
                    key={idx}
                    className="px-2 py-1 bg-blue-100 dark:bg-blue-800 rounded text-xs text-blue-800 dark:text-blue-200"
                  >
                    {lang.name} ({(lang.confidence * 100).toFixed(0)}%)
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Speaker Diarization */}
      {result.speaker_diarization && result.speaker_diarization.num_speakers_detected > 0 && (
        <div className="card">
          <div className="flex items-center mb-4">
            <Users className="h-5 w-5 text-gray-600 dark:text-gray-400 mr-2" />
            <h2 className="text-xl font-semibold dark:text-white">👥 Speaker Analysis</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Speakers Detected</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {result.speaker_diarization.num_speakers_detected}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Segments</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {result.speaker_diarization.segments.length}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Speaker Distribution</p>
              <div className="space-y-1">
                {Object.entries(result.speaker_diarization.speaker_stats || {}).map(([speaker, stats]: [string, any]) => (
                  <div key={speaker} className="flex justify-between text-sm">
                    <span className="text-gray-700 dark:text-gray-300">{speaker}:</span>
                    <span className="font-semibold text-gray-900 dark:text-white">{stats.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Conversation Analysis */}
      {result.conversation_analysis && (
        <div className="card">
          <div className="flex items-center mb-4">
            <MessageSquare className="h-5 w-5 text-gray-600 dark:text-gray-400 mr-2" />
            <h2 className="text-xl font-semibold dark:text-white">💬 Conversation Analysis</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Turns</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {result.conversation_analysis.summary?.total_turns || 0}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Interruptions</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {result.conversation_analysis.interruptions?.count || 0}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Quality</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white capitalize">
                {result.conversation_analysis.summary?.conversation_quality || 'Unknown'}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Balance Score</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {result.conversation_analysis.summary?.balance_score?.toFixed(1) || '0.0'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Action Items & Commitments */}
      {result.action_items && result.action_items.action_items && result.action_items.action_items.length > 0 && (
        <div className="card border-l-4 border-green-500">
          <div className="flex items-center mb-4">
            <CheckSquare className="h-5 w-5 text-green-600 mr-2" />
            <h2 className="text-xl font-semibold dark:text-white">✅ Action Items & Commitments</h2>
          </div>

          {/* Statistics */}
          {result.action_items.statistics && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Items</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {result.action_items.statistics.total}
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">With Deadlines</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {result.action_items.statistics.with_deadlines}
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Types</p>
                <div className="space-y-1">
                  {Object.entries(result.action_items.statistics.by_type || {}).map(([type, count]: [string, any]) => (
                    <div key={type} className="flex justify-between text-sm">
                      <span className="text-gray-700 dark:text-gray-300 capitalize">{type.replace('_', ' ')}:</span>
                      <span className="font-semibold text-gray-900 dark:text-white">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Assignees</p>
                <div className="space-y-1 max-h-20 overflow-y-auto">
                  {Object.entries(result.action_items.statistics.by_assignee || {}).map(([assignee, count]: [string, any]) => (
                    <div key={assignee} className="flex justify-between text-sm">
                      <span className="text-gray-700 dark:text-gray-300">{assignee}:</span>
                      <span className="font-semibold text-gray-900 dark:text-white">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Action Items List */}
          <div className="space-y-3">
            {result.action_items.action_items.map((item: any, idx: number) => (
              <div
                key={idx}
                className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckSquare className="h-4 w-4 text-green-600" />
                      <span className="font-semibold text-green-900 dark:text-green-200 capitalize">
                        {item.item_type.replace('_', ' ')}
                      </span>
                      <span className="text-xs bg-green-200 dark:bg-green-800 px-2 py-1 rounded">
                        {(item.confidence * 100).toFixed(0)}% confidence
                      </span>
                    </div>
                    <p className="text-gray-900 dark:text-white mb-2">{item.text}</p>
                    <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
                      {item.assigned_to && (
                        <div className="flex items-center gap-1">
                          <User className="h-4 w-4" />
                          <span>Assigned to: {item.assigned_to}</span>
                        </div>
                      )}
                      {item.deadline && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <span>Deadline: {item.deadline}</span>
                        </div>
                      )}
                    </div>
                    {item.context && (
                      <div className="mt-2 p-2 bg-white dark:bg-gray-800 rounded text-xs text-gray-600 dark:text-gray-400">
                        <p className="font-semibold mb-1">Context:</p>
                        <p className="italic">...{item.context}...</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI-Powered Summary */}
      {result.summary && result.summary.summary && (
        <div className="card border-l-4 border-purple-500">
          <div className="flex items-center mb-4">
            <FileText className="h-5 w-5 text-purple-600 mr-2" />
            <h2 className="text-xl font-semibold dark:text-white">📝 Conversation Summary</h2>
          </div>
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 mb-4">
            <p className="text-gray-900 dark:text-white whitespace-pre-line">{result.summary.summary}</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-600 dark:text-gray-400">Word Count:</span>{' '}
              <span className="font-semibold">{result.summary.word_count}</span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Summary Length:</span>{' '}
              <span className="font-semibold">{result.summary.summary_word_count} words</span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Compression:</span>{' '}
              <span className="font-semibold">{(result.summary.compression_ratio * 100).toFixed(1)}%</span>
            </div>
            {result.summary.model && (
              <div>
                <span className="text-gray-600 dark:text-gray-400">Model:</span>{' '}
                <span className="font-semibold capitalize">{result.summary.model.replace('_', ' ')}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Topic Extraction */}
      {result.topics && result.topics.topics && result.topics.topics.length > 0 && (
        <div className="card border-l-4 border-indigo-500">
          <div className="flex items-center mb-4">
            <Tag className="h-5 w-5 text-indigo-600 mr-2" />
            <h2 className="text-xl font-semibold dark:text-white">🏷️ Main Topics</h2>
            <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
              ({result.topics.num_topics} topics detected via {result.topics.method})
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {result.topics.topics.map((topic: any) => (
              <div
                key={topic.topic_id}
                className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-indigo-900 dark:text-indigo-200">
                    Topic {topic.topic_id}
                  </span>
                  <span className="text-xs bg-indigo-200 dark:bg-indigo-800 px-2 py-1 rounded">
                    {(topic.importance * 100).toFixed(0)}% importance
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 mb-2">
                  {topic.keywords.map((keyword: string, idx: number) => (
                    <span
                      key={idx}
                      className="px-2 py-1 bg-white dark:bg-gray-800 rounded text-xs text-indigo-800 dark:text-indigo-200"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
                {topic.representative_sentence && (
                  <p className="text-sm text-gray-700 dark:text-gray-300 italic mt-2">
                    "{topic.representative_sentence}"
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Intent Classification */}
      {result.intent && result.intent.primary_intent && (
        <div className="card border-l-4 border-teal-500">
          <div className="flex items-center mb-4">
            <Target className="h-5 w-5 text-teal-600 mr-2" />
            <h2 className="text-xl font-semibold dark:text-white">🎯 Conversation Intent</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-teal-50 dark:bg-teal-900/20 rounded-lg p-4">
              <p className="text-sm text-teal-700 dark:text-teal-400 mb-1">Primary Intent</p>
              <p className="text-2xl font-bold text-teal-900 dark:text-teal-200 capitalize">
                {result.intent.primary_intent}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                Confidence: {(result.intent.confidence * 100).toFixed(1)}%
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Method: {result.intent.method.replace('_', ' ')}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">All Possible Intents</p>
              <div className="space-y-2">
                {result.intent.all_intents && result.intent.all_intents.map((intent: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center">
                    <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">
                      {intent.intent}
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                        <div
                          className="bg-teal-600 h-2 rounded-full"
                          style={{ width: `${intent.confidence * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-600 dark:text-gray-400 w-10 text-right">
                        {(intent.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {result.intent.matched_keywords && result.intent.matched_keywords.length > 0 && (
            <div className="mt-4 pt-4 border-t border-teal-200 dark:border-teal-700">
              <p className="text-sm text-teal-700 dark:text-teal-400 mb-2">Matched Keywords:</p>
              <div className="flex flex-wrap gap-2">
                {result.intent.matched_keywords.slice(0, 10).map((keyword: string, idx: number) => (
                  <span
                    key={idx}
                    className="px-2 py-1 bg-teal-100 dark:bg-teal-800 rounded text-xs text-teal-800 dark:text-teal-200"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Audio Player with Synchronized Transcript */}
      {audioFile && result.speaker_timeline && result.speaker_timeline.length > 0 && (
        <AudioPlayer
          audioUrl={audioFile}
          segments={result.speaker_timeline.map(seg => ({
            start: seg.start,
            end: seg.end,
            text: seg.text,
            speaker: seg.speaker
          }))}
        />
      )}

      {/* Fallback: Use sentiment timeline segments if no speaker timeline */}
      {audioFile && (!result.speaker_timeline || result.speaker_timeline.length === 0) && result.sentiment_timeline?.timeline && (
        <AudioPlayer
          audioUrl={audioFile}
          segments={result.sentiment_timeline.timeline.map((seg: any) => ({
            start: seg.start_time,
            end: seg.end_time,
            text: seg.text
          }))}
        />
      )}

      {/* Transcript */}
      <div className="card">
        <h2 className="text-xl font-semibold mb-4 dark:text-white">🧾 Full Transcript</h2>
        <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{result.transcription}</p>
      </div>

      {/* Analytics Summary */}
      <div className="card">
        <h2 className="text-xl font-semibold mb-6 dark:text-white">📊 Model Analysis</h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Sentiment</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{analysis.sentiment}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {(analysis.sentiment_confidence * 100).toFixed(1)}% confidence
            </p>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Emotion</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{analysis.emotion}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {(analysis.emotion_confidence * 100).toFixed(1)}% confidence
            </p>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Toxicity</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {(analysis.toxicity_score * 100).toFixed(1)}%
            </p>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Compliance Score</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{analysis.compliance_score.toFixed(2)}</p>
          </div>
        </div>

        {/* Compliance Gauge */}
        <ComplianceGauge score={analysis.compliance_score} />
      </div>

      {/* Sentiment Timeline */}
      {result.sentiment_timeline && result.sentiment_timeline.timeline && (
        <SentimentTimeline timeline={result.sentiment_timeline} />
      )}

      {/* Comments Section */}
      {result.record_id && (
        <Comments analysisId={result.record_id} />
      )}

      {/* Tags Section */}
      {result.record_id && (
        <Tags analysisId={result.record_id} />
      )}
    </div>
  );
}

