from fpdf import FPDF
from datetime import datetime
import os
from pathlib import Path

class CompliancePDF(FPDF):
    def header(self):
        # Title
        self.set_font("Helvetica", "B", 18)
        self.cell(0, 10, "AI Voice Compliance Report", ln=True, align="C")
        self.ln(5)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 9)
        self.set_text_color(100)
        self.cell(0, 10, "Confidential - For Internal Review Only", 0, 0, "C")

def generate_compliance_pdf(data: dict, output_path: str = "compliance_report.pdf"):
    # Ensure output directory exists
    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)

    pdf = CompliancePDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # Header info
    analysis = data.get("analysis", {})
    pdf.set_font("Helvetica", "", 12)
    pdf.cell(0, 10, f"Generated on: {now}", ln=True)
    pdf.cell(0, 10, f"File: {data.get('filename', 'N/A')}", ln=True)
    pdf.ln(5)

    # Helper function to safely get numeric values
    def safe_float(value, default=0.0):
        try:
            return float(value) if value is not None else default
        except (TypeError, ValueError):
            return default

    def safe_percentage(value, default=0.0):
        val = safe_float(value, default)
        return val * 100

    # Compliance Scores Summary
    pdf.set_font("Helvetica", "B", 14)
    compliance_score = analysis.get('compliance_score', 'N/A')
    pdf.cell(0, 10, f"Overall Compliance Score: {compliance_score}", ln=True)
    pdf.set_font("Helvetica", "", 12)

    sentiment = analysis.get('sentiment', 'N/A')
    sentiment_conf = safe_percentage(analysis.get('sentiment_confidence', 0))
    pdf.cell(0, 8, f"Sentiment: {sentiment} ({sentiment_conf:.1f}%)", ln=True)

    emotion = analysis.get('emotion', 'N/A')
    emotion_conf = safe_percentage(analysis.get('emotion_confidence', 0))
    pdf.cell(0, 8, f"Emotion: {emotion} ({emotion_conf:.1f}%)", ln=True)

    toxicity = safe_percentage(analysis.get('toxicity_score', 0))
    pdf.cell(0, 8, f"Toxicity: {toxicity:.1f}%", ln=True)
    pdf.ln(10)

    # Executive Summary
    score = safe_float(compliance_score, 0)
    pdf.set_font("Helvetica", "B", 14)
    pdf.cell(0, 10, "Executive Summary", ln=True)
    pdf.set_font("Helvetica", "", 12)

    if score >= 90:
        summary = (
            "The analyzed audio demonstrates excellent compliance. "
            "The tone remained professional and calm, with no harmful or aggressive language detected."
        )
    elif score >= 75:
        summary = (
            "The audio shows generally good compliance with minor areas for tone improvement. "
            "No severe toxic or offensive language was detected."
        )
    else:
        summary = (
            "Attention Required: The audio contains signs of negative tone or potential non-compliant language. "
            "Please review the highlighted segments for context."
        )
    pdf.multi_cell(0, 8, summary)
    pdf.ln(10)

    # Transcript
    pdf.set_font("Helvetica", "B", 14)
    pdf.cell(0, 10, "Transcript", ln=True)
    pdf.set_font("Helvetica", "", 11)
    pdf.multi_cell(0, 7, data.get("transcription", "N/A"))
    pdf.ln(8)

    # Explainability Highlights
    pdf.set_font("Helvetica", "B", 14)
    pdf.cell(0, 10, "Word Influence Map", ln=True)
    pdf.set_font("Helvetica", "", 11)

    explanation = data.get("explanation", [])
    if not explanation:
        pdf.multi_cell(0, 7, "No token-level explanations available.")
    else:
        try:
            pdf.multi_cell(0, 7, "Color code: Green = Positive influence | Red = Negative influence | Gray = Neutral\n")
            # Ensure explanation is a list and handle slicing safely
            explanation_list = list(explanation)[:80] if explanation else []
            for item in explanation_list:
                # Handle both tuple and list formats
                if isinstance(item, (tuple, list)) and len(item) >= 2:
                    token, value = item[0], item[1]
                    token = str(token) if token is not None else ""
                    value = safe_float(value, 0.0)

                    if value > 0.1:
                        color = (0, 150, 0)
                    elif value < -0.1:
                        color = (200, 0, 0)
                    else:
                        color = (120, 120, 120)
                    pdf.set_text_color(*color)
                    pdf.write(6, token + " ")
                else:
                    # Fallback: just write the token as string
                    pdf.write(6, str(item) + " ")
            pdf.set_text_color(0, 0, 0)
        except Exception as e:
            pdf.multi_cell(0, 7, f"Error rendering word influence map: {str(e)}")

    pdf.ln(10)

    # Metadata
    pdf.set_font("Helvetica", "B", 14)
    pdf.cell(0, 10, "Audit Metadata", ln=True)
    pdf.set_font("Helvetica", "", 11)
    meta = [
        ("File Name", data.get("filename", "N/A")),
        ("Duration", data.get("duration", "N/A")),
        ("Timestamp", now),
        ("Version", "AI Voice Compliance Auditor v1.0"),
    ]
    for key, val in meta:
        pdf.cell(0, 8, f"{key}: {val}", ln=True)

    # Output to absolute path for better compatibility
    abs_output_path = str(output_file.resolve())
    pdf.output(abs_output_path)
    return abs_output_path
