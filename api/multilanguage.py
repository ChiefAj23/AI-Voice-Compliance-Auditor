"""
Multi-language Support Module
Auto-detect language and provide language-specific analysis
"""
from typing import Dict, Optional
import re
from collections import Counter
import whisper
from langdetect import detect, detect_langs, LangDetectException


# Language code to name mapping
LANGUAGE_NAMES = {
    "en": "English",
    "es": "Spanish",
    "fr": "French",
    "de": "German",
    "it": "Italian",
    "pt": "Portuguese",
    "ru": "Russian",
    "ja": "Japanese",
    "zh": "Chinese",
    "ko": "Korean",
    "ar": "Arabic",
    "hi": "Hindi",
    "nl": "Dutch",
    "pl": "Polish",
    "tr": "Turkish",
    "sv": "Swedish",
    "da": "Danish",
    "no": "Norwegian",
    "fi": "Finnish",
    "cs": "Czech",
    "hu": "Hungarian",
    "ro": "Romanian",
    "el": "Greek",
    "th": "Thai",
    "vi": "Vietnamese",
    "id": "Indonesian",
    "ms": "Malay",
    "uk": "Ukrainian",
    "he": "Hebrew",
    "fa": "Persian",
    "ur": "Urdu",
    "bn": "Bengali",
    "ta": "Tamil",
    "te": "Telugu",
    "ml": "Malayalam",
    "kn": "Kannada",
    "gu": "Gujarati",
    "pa": "Punjabi",
    "mr": "Marathi",
    "ne": "Nepali",
    "si": "Sinhala",
    "my": "Myanmar",
    "km": "Khmer",
    "lo": "Lao",
    "ka": "Georgian",
    "am": "Amharic",
    "az": "Azerbaijani",
    "be": "Belarusian",
    "bg": "Bulgarian",
    "bs": "Bosnian",
    "ca": "Catalan",
    "hr": "Croatian",
    "et": "Estonian",
    "gl": "Galician",
    "is": "Icelandic",
    "lv": "Latvian",
    "lt": "Lithuanian",
    "mk": "Macedonian",
    "mt": "Maltese",
    "sr": "Serbian",
    "sk": "Slovak",
    "sl": "Slovenian",
    "sq": "Albanian",
    "eu": "Basque",
    "cy": "Welsh",
    "ga": "Irish",
    "gd": "Scottish Gaelic",
    "br": "Breton",
    "co": "Corsican",
    "lb": "Luxembourgish",
    "fy": "Western Frisian",
    "yi": "Yiddish",
    "eo": "Esperanto",
    "ia": "Interlingua",
    "la": "Latin",
    "oc": "Occitan",
    "sc": "Sardinian",
    "wa": "Walloon",
    "af": "Afrikaans",
    "sw": "Swahili",
    "zu": "Zulu",
    "xh": "Xhosa",
    "yo": "Yoruba",
    "ig": "Igbo",
    "ha": "Hausa",
    "so": "Somali",
    "mg": "Malagasy",
    "ny": "Chichewa",
    "sn": "Shona",
    "st": "Southern Sotho",
    "tn": "Tswana",
    "ts": "Tsonga",
    "ve": "Venda",
    "xh": "Xhosa",
    "zu": "Zulu",
    "ak": "Akan",
    "ff": "Fulah",
    "lg": "Ganda",
    "ki": "Kikuyu",
    "rw": "Kinyarwanda",
    "luo": "Luo",
    "om": "Oromo",
    "ti": "Tigrinya",
    "wo": "Wolof",
    "xh": "Xhosa",
    "zu": "Zulu",
    "aa": "Afar",
    "ab": "Abkhazian",
    "ae": "Avestan",
    "an": "Aragonese",
    "av": "Avaric",
    "ay": "Aymara",
    "ba": "Bashkir",
    "bi": "Bislama",
    "bm": "Bambara",
    "bo": "Tibetan",
    "ce": "Chechen",
    "ch": "Chamorro",
    "cu": "Church Slavic",
    "cv": "Chuvash",
    "dz": "Dzongkha",
    "ee": "Ewe",
    "fo": "Faroese",
    "fj": "Fijian",
    "gn": "Guarani",
    "gv": "Manx",
    "ht": "Haitian",
    "hz": "Herero",
    "ie": "Interlingue",
    "ik": "Inupiaq",
    "io": "Ido",
    "jv": "Javanese",
    "kg": "Kongo",
    "kj": "Kuanyama",
    "kk": "Kazakh",
    "kl": "Kalaallisut",
    "kr": "Kanuri",
    "ks": "Kashmiri",
    "ku": "Kurdish",
    "kv": "Komi",
    "kw": "Cornish",
    "ky": "Kirghiz",
    "li": "Limburgan",
    "ln": "Lingala",
    "mh": "Marshallese",
    "mi": "Maori",
    "mn": "Mongolian",
    "na": "Nauru",
    "nb": "Norwegian Bokmal",
    "nd": "North Ndebele",
    "ng": "Ndonga",
    "nn": "Norwegian Nynorsk",
    "nr": "South Ndebele",
    "nv": "Navajo",
    "oj": "Ojibwa",
    "os": "Ossetian",
    "pi": "Pali",
    "ps": "Pushto",
    "qu": "Quechua",
    "rm": "Romansh",
    "rn": "Rundi",
    "sa": "Sanskrit",
    "sg": "Sango",
    "sm": "Samoan",
    "ss": "Swati",
    "su": "Sundanese",
    "tg": "Tajik",
    "tk": "Turkmen",
    "tl": "Tagalog",
    "to": "Tonga",
    "tt": "Tatar",
    "tw": "Twi",
    "ty": "Tahitian",
    "ug": "Uighur",
    "uz": "Uzbek",
    "vo": "Volapuk",
    "xh": "Xhosa",
    "yi": "Yiddish",
    "za": "Zhuang",
    "zh": "Chinese",
    "zu": "Zulu",
}


def detect_language_from_text(text: str, min_length: int = 20) -> Dict:
    """
    Detect language from text using langdetect with improved handling for Hindi and other languages

    Args:
        text: Text to analyze
        min_length: Minimum text length for reliable detection (default: 20)

    Returns:
        Dictionary with detected language information
    """
    if not text:
        return {
            "detected_language": "en",
            "language_name": "English",
            "confidence": 0.5,
            "all_languages": []
        }

    # Clean and prepare text
    cleaned_text = text.strip()

    # Remove extra whitespace and normalize
    cleaned_text = re.sub(r'\s+', ' ', cleaned_text)

    if len(cleaned_text) < min_length:
        return {
            "detected_language": "en",
            "language_name": "English",
            "confidence": 0.5,
            "all_languages": [],
            "note": f"Text too short ({len(cleaned_text)} chars, need {min_length})"
        }

    try:
        # Try multiple times with different text samples for better accuracy
        # langdetect works better with longer text
        text_samples = []
        if len(cleaned_text) > 100:
            # Use first 200 chars, middle 200 chars, and last 200 chars
            text_samples = [
                cleaned_text[:200],
                cleaned_text[len(cleaned_text)//2-100:len(cleaned_text)//2+100],
                cleaned_text[-200:]
            ]
        else:
            text_samples = [cleaned_text]

        # Detect from all samples and take the most common result
        detections = []
        all_langs_combined = {}

        for sample in text_samples:
            try:
                detected = detect(sample)
                detections.append(detected)

                # Get confidence scores
                sample_langs = detect_langs(sample)
                for lang in sample_langs:
                    if lang.lang not in all_langs_combined:
                        all_langs_combined[lang.lang] = []
                    all_langs_combined[lang.lang].append(lang.prob)
            except LangDetectException:
                continue

        if not detections:
            raise LangDetectException("No valid detections")

        # Get most common detection
        detection_counts = Counter(detections)
        detected = detection_counts.most_common(1)[0][0]

        # Calculate average confidence for detected language
        if detected in all_langs_combined:
            confidence = sum(all_langs_combined[detected]) / len(all_langs_combined[detected])
        else:
            # Fallback: get confidence from full text
            try:
                all_langs = detect_langs(cleaned_text)
                confidence = next((lang.prob for lang in all_langs if lang.lang == detected), 0.5)
            except:
                confidence = 0.5

        # Get all possible languages with average confidence
        all_langs_list = []
        for lang_code, confidences in all_langs_combined.items():
            avg_conf = sum(confidences) / len(confidences)
            all_langs_list.append({
                "code": lang_code,
                "name": LANGUAGE_NAMES.get(lang_code, lang_code.upper()),
                "confidence": round(avg_conf, 3)
            })

        # Sort by confidence and take top 5
        all_langs_list.sort(key=lambda x: x["confidence"], reverse=True)

        return {
            "detected_language": detected,
            "language_name": LANGUAGE_NAMES.get(detected, detected.upper()),
            "confidence": round(confidence, 3),
            "all_languages": all_langs_list[:5],
            "detection_count": len(detections),
            "agreement": len([d for d in detections if d == detected]) / len(detections) if detections else 0
        }
    except LangDetectException as e:
        return {
            "detected_language": "en",
            "language_name": "English",
            "confidence": 0.5,
            "all_languages": [],
            "error": "LangDetectException: " + str(e)
        }
    except Exception as e:
        return {
            "detected_language": "en",
            "language_name": "English",
            "confidence": 0.5,
            "error": str(e),
            "all_languages": []
        }


def transcribe_with_language(audio_path: str, language: Optional[str] = None, auto_detect: bool = True, model_size: str = "small") -> Dict:
    """
    Transcribe audio with language support and improved Hindi detection

    Args:
        audio_path: Path to audio file
        language: Language code (e.g., 'en', 'hi') or None for auto-detect
        auto_detect: Whether to auto-detect language if not specified
        model_size: Whisper model size - "tiny", "base", "small", "medium", "large" (default: "small" for better accuracy)

    Returns:
        Transcription result with language information
    """
    try:
        # Load Whisper model - use "small" for better accuracy, especially for non-English languages
        # "base" is faster but less accurate for Hindi and other languages
        try:
            model = whisper.load_model(model_size)
        except Exception as e:
            print(f"Warning: Failed to load {model_size} model, falling back to base: {str(e)}")
            model = whisper.load_model("base")
            model_size = "base"

        # Transcribe with or without language specification
        if language:
            # Explicit language specified - use it directly
            result = model.transcribe(audio_path, language=language, task="transcribe")
        elif auto_detect:
            # Let Whisper auto-detect - this is usually more accurate for Hindi
            result = model.transcribe(audio_path, task="transcribe")
        else:
            result = model.transcribe(audio_path, language="en", task="transcribe")

        # Extract detected language from Whisper result
        detected_lang = result.get("language", "en")

        # Whisper's language detection is usually very accurate, especially for Hindi
        whisper_confidence = 0.95  # Whisper's detection is generally reliable

        # Get full text
        text = result.get("text", "").strip()

        # Additional language detection from text (for verification and confidence)
        # Prioritize Whisper's detection, but use text detection as verification
        text_lang_info = None
        if text and len(text) >= 20:
            text_lang_info = detect_language_from_text(text, min_length=20)
        else:
            text_lang_info = {
                "detected_language": detected_lang,
                "language_name": LANGUAGE_NAMES.get(detected_lang, detected_lang.upper()),
                "confidence": 0.7,
                "note": "Text too short for reliable detection"
            }

        # Determine final language - prioritize Whisper if both agree, otherwise use Whisper (more reliable for audio)
        text_detected = text_lang_info.get("detected_language", detected_lang)
        text_confidence = text_lang_info.get("confidence", 0.7)

        # If both agree, use higher confidence
        if detected_lang == text_detected:
            final_confidence = max(whisper_confidence, text_confidence)
        else:
            # If they disagree, trust Whisper more for audio transcription
            final_confidence = whisper_confidence * 0.9
            print(f"Language detection mismatch: Whisper={detected_lang}, Text={text_detected}. Trusting Whisper.")

        return {
            "transcription": result,
            "text": text,
            "language": {
                "whisper_detected": detected_lang,
                "whisper_language_name": LANGUAGE_NAMES.get(detected_lang, detected_lang.upper()),
                "text_detected": text_detected,
                "text_language_name": text_lang_info.get("language_name", LANGUAGE_NAMES.get(detected_lang, detected_lang.upper())),
                "final_detected": detected_lang,  # Final decision: trust Whisper
                "final_language_name": LANGUAGE_NAMES.get(detected_lang, detected_lang.upper()),
                "confidence": round(final_confidence, 3),
                "whisper_confidence": whisper_confidence,
                "text_confidence": text_confidence,
                "agreement": detected_lang == text_detected,
                "all_possible_languages": text_lang_info.get("all_languages", []),
                "model_used": model_size
            },
            "segments": result.get("segments", [])
        }
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"Error in transcribe_with_language: {error_trace}")
        return {
            "transcription": None,
            "text": "",
            "language": {
                "whisper_detected": "en",
                "whisper_language_name": "English",
                "error": str(e)
            },
            "error": str(e)
        }


def get_supported_languages() -> Dict:
    """
    Get list of supported languages

    Returns:
        Dictionary with supported languages
    """
    # Whisper supported languages
    whisper_languages = [
        "af", "am", "ar", "as", "az", "ba", "be", "bg", "bn", "bo", "br", "bs", "ca", "cs", "cy",
        "da", "de", "el", "en", "es", "et", "eu", "fa", "fi", "fo", "fr", "gl", "gu", "ha", "haw",
        "he", "hi", "hr", "ht", "hu", "hy", "id", "is", "it", "ja", "jw", "ka", "kk", "km", "kn",
        "ko", "la", "lb", "ln", "lo", "lt", "lv", "mg", "mi", "mk", "ml", "mn", "mr", "ms", "mt",
        "my", "ne", "nl", "nn", "no", "oc", "pa", "pl", "ps", "pt", "ro", "ru", "sa", "sd", "si",
        "sk", "sl", "sn", "so", "sq", "sr", "su", "sv", "sw", "ta", "te", "tg", "th", "tk", "tl",
        "tr", "tt", "uk", "ur", "uz", "vi", "yi", "yo", "zh", "yue"
    ]

    return {
        "whisper_supported": whisper_languages,
        "language_names": {code: LANGUAGE_NAMES.get(code, code.upper()) for code in whisper_languages},
        "total_count": len(whisper_languages)
    }

