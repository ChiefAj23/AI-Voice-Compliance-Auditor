from functools import lru_cache

import shap
import numpy as np
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification

MODEL_NAME = "unitary/toxic-bert"


@lru_cache(maxsize=1)
def toxic_bert():
    """
    The tokenizer and model, loaded on first use rather than at import and shared with
    explain_enhanced. Callers get the real objects: SHAP chooses its text masker by the
    tokenizer's class, so a stand-in object would make it treat the text as numbers.
    """
    tok = AutoTokenizer.from_pretrained(MODEL_NAME)
    mdl = AutoModelForSequenceClassification.from_pretrained(MODEL_NAME)
    mdl.eval()
    return tok, mdl


def explain_toxicity(text: str, max_tokens: int = 128):
    """
    Compute SHAP attributions for each token in the input text
    based on its contribution to the toxicity score.
    """
    # Ensure the text input is properly formatted
    if not isinstance(text, str):
        text = str(text)
    tokenizer, model = toxic_bert()

    def predict(batch_texts):
        # SHAP sometimes sends numpy arrays — convert them to list[str]
        if isinstance(batch_texts, np.ndarray):
            batch_texts = batch_texts.tolist()
        if isinstance(batch_texts, str):
            batch_texts = [batch_texts]
        elif not isinstance(batch_texts, list):
            batch_texts = [str(x) for x in batch_texts]

        encodings = tokenizer(
            batch_texts,
            return_tensors="pt",
            padding=True,
            truncation=True,
            max_length=max_tokens
        )

        with torch.no_grad():
            outputs = model(**encodings)
            probs = torch.nn.functional.softmax(outputs.logits, dim=1)

        # Return probability of the "toxic" class
        return probs[:, 1].detach().numpy()

    # Initialize SHAP Explainer
    explainer = shap.Explainer(predict, tokenizer)
    shap_values = explainer([text])

    # Extract SHAP token attributions
    tokens = shap_values.data[0]
    values = shap_values.values[0]  # ✅ fixed typo

    # Normalize to [-1, 1] range for visualization
    max_abs = max(abs(v) for v in values) or 1.0
    normalized_values = [float(v / max_abs) for v in values]

    # Combine tokens and importance scores
    token_importance = list(zip(tokens, normalized_values))
    return token_importance
