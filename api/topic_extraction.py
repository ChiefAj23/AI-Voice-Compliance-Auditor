"""
Topic Extraction & Clustering Module
Identifies main topics discussed in conversations using topic modeling
"""
from typing import Dict, List, Optional
import re
from collections import Counter
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.decomposition import LatentDirichletAllocation
import numpy as np


def extract_topics(text: str, num_topics: int = 5, min_topic_words: int = 3) -> Dict:
    """
    Extract main topics from conversation text

    Args:
        text: Conversation transcript
        num_topics: Number of topics to extract
        min_topic_words: Minimum words per topic

    Returns:
        Dictionary with topics and keywords
    """
    if not text or len(text.strip()) < 50:
        return {
            "topics": [],
            "num_topics": 0,
            "method": "keyword_based",
            "error": "Text too short for topic extraction"
        }

    # Clean and prepare text
    cleaned_text = clean_text_for_topics(text)

    # Split into sentences
    sentences = split_into_sentences(cleaned_text)

    if len(sentences) < 3:
        # Fallback to simple keyword extraction
        return extract_keyword_topics(cleaned_text, num_topics)

    try:
        # Use LDA for topic modeling
        topics = extract_topics_lda(sentences, num_topics, min_topic_words)

        if topics and len(topics) > 0:
            return {
                "topics": topics,
                "num_topics": len(topics),
                "method": "lda",
                "total_sentences": len(sentences)
            }
        else:
            # Fallback to keyword-based
            return extract_keyword_topics(cleaned_text, num_topics)

    except Exception as e:
        print(f"Error in LDA topic extraction: {str(e)}")
        # Fallback to keyword-based extraction
        return extract_keyword_topics(cleaned_text, num_topics)


def extract_topics_lda(sentences: List[str], num_topics: int, min_topic_words: int) -> List[Dict]:
    """
    Extract topics using Latent Dirichlet Allocation (LDA)

    Args:
        sentences: List of sentences
        num_topics: Number of topics
        min_topic_words: Minimum words per topic

    Returns:
        List of topic dictionaries
    """
    if len(sentences) < num_topics:
        num_topics = max(1, len(sentences) // 2)

    # Vectorize sentences
    vectorizer = TfidfVectorizer(
        max_features=100,
        stop_words='english',
        min_df=1,
        max_df=0.95,
        ngram_range=(1, 2)  # Include bigrams
    )

    try:
        doc_term_matrix = vectorizer.fit_transform(sentences)

        if doc_term_matrix.shape[1] == 0:
            return []

        # Adjust num_topics if needed
        if num_topics > doc_term_matrix.shape[1]:
            num_topics = max(1, doc_term_matrix.shape[1] // 2)

        # Apply LDA
        lda = LatentDirichletAllocation(
            n_components=num_topics,
            random_state=42,
            max_iter=10
        )
        lda.fit(doc_term_matrix)

        # Extract topics
        feature_names = vectorizer.get_feature_names_out()
        topics = []

        for topic_idx, topic in enumerate(lda.components_):
            # Get top words for this topic
            top_word_indices = topic.argsort()[-min_topic_words:][::-1]
            top_words = [feature_names[i] for i in top_word_indices]
            top_scores = [float(topic[i]) for i in top_word_indices]

            # Calculate topic importance (average score)
            importance = float(np.mean(top_scores))

            # Find representative sentences for this topic
            topic_dist = lda.transform(doc_term_matrix[:, top_word_indices])
            if topic_dist.shape[0] > 0:
                top_sentence_idx = int(np.argmax(np.sum(topic_dist, axis=1)))
                representative_sentence = sentences[min(top_sentence_idx, len(sentences) - 1)]
            else:
                representative_sentence = ""

            topics.append({
                "topic_id": topic_idx + 1,
                "keywords": top_words,
                "keywords_scores": top_scores,
                "importance": round(importance, 3),
                "representative_sentence": representative_sentence[:200],  # Limit length
                "word_count": len(top_words)
            })

        # Sort by importance
        topics.sort(key=lambda x: x["importance"], reverse=True)

        return topics

    except Exception as e:
        print(f"Error in LDA processing: {str(e)}")
        return []


def extract_keyword_topics(text: str, num_topics: int) -> Dict:
    """
    Fallback: Extract topics using keyword frequency analysis

    Args:
        text: Conversation text
        num_topics: Number of topics to return

    Returns:
        Dictionary with keyword-based topics
    """
    # Extract significant phrases
    words = extract_significant_words(text)

    if not words:
        return {
            "topics": [],
            "num_topics": 0,
            "method": "keyword_based"
        }

    # Get most common phrases
    word_freq = Counter(words)
    top_phrases = word_freq.most_common(num_topics * 3)  # Get more for grouping

    # Group related phrases into topics
    topics = []
    used_phrases = set()

    for phrase, freq in top_phrases:
        if phrase in used_phrases or len(phrase.split()) < 2:
            continue

        # Find related phrases
        related = [p for p, _ in top_phrases if p != phrase and not p in used_phrases]
        related = [p for p in related if any(word in p.split() for word in phrase.split())][:2]

        keywords = [phrase] + related
        used_phrases.update(keywords)

        topics.append({
            "topic_id": len(topics) + 1,
            "keywords": keywords,
            "importance": round(freq / len(words), 3),
            "frequency": freq,
            "word_count": len(keywords)
        })

        if len(topics) >= num_topics:
            break

    return {
        "topics": topics,
        "num_topics": len(topics),
        "method": "keyword_based",
        "total_phrases": len(words)
    }


def extract_significant_words(text: str, min_length: int = 3) -> List[str]:
    """Extract significant words and phrases from text"""
    # Convert to lowercase and split
    words = re.findall(r'\b[a-z]{3,}\b', text.lower())

    # Common stop words to filter
    stop_words = {
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
        'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
        'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
        'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this',
        'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they'
    }

    # Filter stop words
    words = [w for w in words if w not in stop_words and len(w) >= min_length]

    # Extract bigrams (two-word phrases)
    bigrams = []
    for i in range(len(words) - 1):
        bigram = f"{words[i]} {words[i+1]}"
        bigrams.append(bigram)

    # Combine single words and bigrams
    significant = words + bigrams

    return significant


def split_into_sentences(text: str) -> List[str]:
    """Split text into sentences"""
    # Simple sentence splitting
    sentences = re.split(r'(?<=[.!?])\s+', text)
    sentences = [s.strip() for s in sentences if s.strip() and len(s.strip()) > 10]
    return sentences


def clean_text_for_topics(text: str) -> str:
    """Clean text for topic extraction"""
    # Remove timestamps
    text = re.sub(r'\[\d{2}:\d{2}:\d{2}\]', '', text)

    # Remove speaker labels
    text = re.sub(r'Speaker\s+\d+\s*:', '', text, flags=re.IGNORECASE)

    # Remove URLs
    text = re.sub(r'http[s]?://\S+', '', text)

    # Normalize whitespace
    text = re.sub(r'\s+', ' ', text)

    return text.strip()


def get_topic_trends(conversations: List[str], num_topics: int = 5) -> Dict:
    """
    Analyze topic trends across multiple conversations

    Args:
        conversations: List of conversation texts
        num_topics: Number of topics to extract

    Returns:
        Dictionary with trending topics and statistics
    """
    all_topics = []

    for conv in conversations:
        if conv and len(conv.strip()) > 50:
            topics_result = extract_topics(conv, num_topics=num_topics)
            if topics_result.get("topics"):
                all_topics.extend(topics_result["topics"])

    if not all_topics:
        return {
            "trending_topics": [],
            "topic_frequency": {},
            "total_conversations": len(conversations)
        }

    # Aggregate topics by keywords
    topic_keywords = {}
    for topic in all_topics:
        keywords = tuple(sorted(topic.get("keywords", [])))
        if keywords not in topic_keywords:
            topic_keywords[keywords] = {
                "keywords": list(keywords),
                "count": 0,
                "avg_importance": 0.0
            }

        topic_keywords[keywords]["count"] += 1
        topic_keywords[keywords]["avg_importance"] += topic.get("importance", 0.0)

    # Calculate averages and sort
    for key, data in topic_keywords.items():
        data["avg_importance"] = round(data["avg_importance"] / data["count"], 3)

    trending_topics = sorted(
        topic_keywords.values(),
        key=lambda x: (x["count"], x["avg_importance"]),
        reverse=True
    )[:num_topics]

    return {
        "trending_topics": trending_topics,
        "topic_frequency": {str(t["keywords"]): t["count"] for t in trending_topics},
        "total_conversations": len(conversations),
        "total_topics_found": len(all_topics)
    }

