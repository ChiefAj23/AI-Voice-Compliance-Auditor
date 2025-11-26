from transformers import pipeline
from detoxify import Detoxify

sentiment_pipeline = pipeline("sentiment-analysis", model="cardiffnlp/twitter-roberta-base-sentiment")
emotion_pipeline = pipeline("text-classification", model="SamLowe/roberta-base-go_emotions")
toxicity_model = Detoxify('original')

def analyze_text(text: str):
    sentiment_result = sentiment_pipeline(text)[0]
    sentiment = sentiment_result["label"]
    sentiment_conf=round(sentiment_result["score"],3)

    emotion_result = emotion_pipeline(text)[0]
    emotion = emotion_result["label"]
    emotion_conf = round(emotion_result["score"], 3)

    tox=toxicity_model.predict(text)
    toxicity_score=round(float(tox.get("toxicity",0.0)),3)

    sentiment_weight={"NEGATIVE": 0.6, "NEUTRAL": 0.9, "POSITIVE": 1.0}
    emotion_penalty={"anger":0.6,"fear":0.8,"joy":1.0,"calm":1.0,"sadness":0.8}
    toxicity_penalty=1.0-min(1.0,toxicity_score)

    raw_score=(
    sentiment_weight.get(sentiment.upper(),1.0)
    * emotion_penalty.get(emotion.lower(),1.0)
    * toxicity_penalty
    )
    compliance_score=round(raw_score * 100,2)

    return {
        "sentiment": sentiment,
        "sentiment_confidence": sentiment_conf,
        "emotion": emotion,
        "emotion_confidence": emotion_conf,
        "toxicity_score": toxicity_score,
        "compliance_score": compliance_score
    }