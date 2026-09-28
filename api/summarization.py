"""
AI-Powered Summarization Module
Generates concise summaries of conversations using transformer models
"""
from typing import Dict
import re


class _Summarizer:
    """
    A sequence-to-sequence summarization model, loaded directly: transformers 5 no longer ships a
    "summarization" pipeline. Called the way that pipeline was, it returns [{"summary_text": ...}].
    """

    def __init__(self, model_name: str):
        import torch
        from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

        self.name = model_name.split("/")[-1]
        self.device = "cuda" if torch.cuda.is_available() else ("mps" if torch.backends.mps.is_available() else "cpu")
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        self.model = AutoModelForSeq2SeqLM.from_pretrained(model_name).to(self.device).eval()

    def __call__(self, text: str, max_length: int, min_length: int, do_sample: bool = False):
        import torch

        inputs = self.tokenizer(text, truncation=True, max_length=1024, return_tensors="pt").to(self.device)
        with torch.no_grad():
            ids = self.model.generate(**inputs, max_length=max_length, min_length=min_length, do_sample=do_sample)
        return [{"summary_text": self.tokenizer.decode(ids[0], skip_special_tokens=True).strip()}]


# Loaded on first use
_summarization_pipeline = None


def get_summarization_pipeline():
    """Get or initialize the summarization model"""
    global _summarization_pipeline
    if _summarization_pipeline is None:
        try:
            _summarization_pipeline = _Summarizer("facebook/bart-large-cnn")
        except Exception as e:
            print(f"Warning: Failed to load BART model, using fallback: {str(e)}")
            try:
                # Fallback to smaller model
                _summarization_pipeline = _Summarizer("sshleifer/distilbart-cnn-12-6")
            except Exception as e2:
                print(f"Warning: Failed to load summarization model: {str(e2)}")
                _summarization_pipeline = None
    return _summarization_pipeline


def summarize_conversation(
    text: str,
    max_length: int = 150,
    min_length: int = 30,
    summary_type: str = "concise"
) -> Dict:
    """
    Generate a summary of the conversation

    Args:
        text: Full conversation transcript
        max_length: Maximum length of summary
        min_length: Minimum length of summary
        summary_type: Type of summary ("concise", "detailed", "bullet")

    Returns:
        Dictionary with summary and metadata
    """
    if not text or len(text.strip()) < 50:
        return {
            "summary": "Text too short for summarization.",
            "summary_type": summary_type,
            "word_count": len(text.split()) if text else 0,
            "model": None,
            "error": "Text too short"
        }

    # Clean and prepare text
    cleaned_text = clean_text_for_summarization(text)

    if len(cleaned_text.split()) < 20:
        return {
            "summary": cleaned_text,
            "summary_type": summary_type,
            "word_count": len(cleaned_text.split()),
            "model": None,
            "note": "Text too short, returning original"
        }

    # Get pipeline
    summarizer = get_summarization_pipeline()

    if summarizer is None:
        # Fallback: extract first few sentences
        return generate_fallback_summary(cleaned_text, summary_type)

    try:
        # Adjust length based on text size
        text_word_count = len(cleaned_text.split())

        # Calculate appropriate summary length
        if text_word_count < 200:
            actual_max_length = min(max_length, 80)
            actual_min_length = min(min_length, 30)
        elif text_word_count < 500:
            actual_max_length = min(max_length, 100)
            actual_min_length = min(min_length, 40)
        else:
            actual_max_length = max_length
            actual_min_length = min_length

        # Split text into chunks if too long (BART has token limit)
        max_chunk_size = 1024  # Approximate token limit

        if len(cleaned_text) > max_chunk_size:
            chunks = split_text_into_chunks(cleaned_text, max_chunk_size)
            summaries = []

            for chunk in chunks:
                chunk_summary = summarizer(
                    chunk,
                    max_length=actual_max_length // len(chunks) + 20,
                    min_length=actual_min_length // len(chunks) + 10,
                    do_sample=False
                )
                summaries.append(chunk_summary[0]["summary_text"])

            # Combine chunk summaries and summarize again if needed
            combined = " ".join(summaries)
            if len(combined.split()) > actual_max_length * 2:
                final_summary = summarizer(
                    combined,
                    max_length=actual_max_length,
                    min_length=actual_min_length,
                    do_sample=False
                )[0]["summary_text"]
            else:
                final_summary = combined
        else:
            # Single pass summarization
            result = summarizer(
                cleaned_text,
                max_length=actual_max_length,
                min_length=actual_min_length,
                do_sample=False
            )
            final_summary = result[0]["summary_text"]

        # Format summary based on type
        formatted_summary = format_summary(final_summary, summary_type)

        return {
            "summary": formatted_summary,
            "summary_type": summary_type,
            "word_count": len(text.split()),
            "summary_word_count": len(formatted_summary.split()),
            "compression_ratio": round(len(formatted_summary.split()) / len(text.split()), 3) if text.split() else 0,
            "model": summarizer.name
        }

    except Exception as e:
        print(f"Error in summarization: {str(e)}")
        # Fallback to extractive summary
        return generate_fallback_summary(cleaned_text, summary_type)


def clean_text_for_summarization(text: str) -> str:
    """Clean and prepare text for summarization"""
    # Remove extra whitespace
    text = re.sub(r'\s+', ' ', text)

    # Remove timestamps if present (format: [00:12:34])
    text = re.sub(r'\[\d{2}:\d{2}:\d{2}\]', '', text)

    # Remove speaker labels if present (format: Speaker 1:)
    text = re.sub(r'Speaker\s+\d+\s*:', '', text, flags=re.IGNORECASE)

    # Remove URLs
    text = re.sub(r'http[s]?://\S+', '', text)

    # Ensure proper sentence endings
    text = text.strip()

    return text


def split_text_into_chunks(text: str, max_size: int) -> list:
    """Split text into chunks of approximately max_size characters"""
    sentences = re.split(r'(?<=[.!?])\s+', text)
    chunks = []
    current_chunk = []
    current_size = 0

    for sentence in sentences:
        sentence_size = len(sentence)
        if current_size + sentence_size > max_size and current_chunk:
            chunks.append(" ".join(current_chunk))
            current_chunk = [sentence]
            current_size = sentence_size
        else:
            current_chunk.append(sentence)
            current_size += sentence_size + 1  # +1 for space

    if current_chunk:
        chunks.append(" ".join(current_chunk))

    return chunks


def format_summary(summary: str, summary_type: str) -> str:
    """Format summary based on type"""
    if summary_type == "bullet":
        # Convert sentences to bullet points
        sentences = re.split(r'(?<=[.!?])\s+', summary)
        bullets = [f"• {s.strip()}" for s in sentences if s.strip()]
        return "\n".join(bullets)
    elif summary_type == "detailed":
        # Ensure proper paragraph formatting
        summary = re.sub(r'\s+', ' ', summary)
        return summary
    else:  # concise (default)
        # Clean up and ensure single line
        summary = re.sub(r'\s+', ' ', summary).strip()
        return summary


def generate_fallback_summary(text: str, summary_type: str) -> Dict:
    """Generate a simple extractive summary as fallback"""
    sentences = re.split(r'(?<=[.!?])\s+', text)

    # Simple extractive summary: take first 3-5 sentences
    num_sentences = min(5, max(3, len(sentences) // 3))
    summary_sentences = sentences[:num_sentences]

    summary = " ".join(summary_sentences)
    formatted_summary = format_summary(summary, summary_type)

    return {
        "summary": formatted_summary,
        "summary_type": summary_type,
        "word_count": len(text.split()),
        "summary_word_count": len(formatted_summary.split()),
        "compression_ratio": round(len(formatted_summary.split()) / len(text.split()), 3) if text.split() else 0,
        "model": "extractive",
        "note": "Using extractive summarization fallback"
    }


def generate_multi_format_summary(text: str) -> Dict:
    """Generate multiple summary formats"""
    concise = summarize_conversation(text, summary_type="concise")
    detailed = summarize_conversation(text, summary_type="detailed", max_length=250, min_length=100)
    bullet = summarize_conversation(text, summary_type="bullet")

    return {
        "concise": concise.get("summary", ""),
        "detailed": detailed.get("summary", ""),
        "bullet_points": bullet.get("summary", ""),
        "word_count": len(text.split()),
        "compression_ratios": {
            "concise": concise.get("compression_ratio", 0),
            "detailed": detailed.get("compression_ratio", 0),
            "bullet": bullet.get("compression_ratio", 0)
        }
    }

