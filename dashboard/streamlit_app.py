import streamlit as st
import requests
import matplotlib.pyplot as plt
import pandas as pd
import base64
import json
from datetime import datetime, timedelta
import plotly.graph_objects as go
import plotly.express as px

# ------------------------------------
# CONFIGURATION
# ------------------------------------
FASTAPI_BASE_URL = "http://127.0.0.1:8000"
FASTAPI_ANALYZE_URL = f"{FASTAPI_BASE_URL}/analyze_audio"
FASTAPI_BATCH_URL = f"{FASTAPI_BASE_URL}/analyze_batch"
FASTAPI_REPORT_URL = f"{FASTAPI_BASE_URL}/generate_report"
FASTAPI_HISTORY_URL = f"{FASTAPI_BASE_URL}/history"
FASTAPI_STATISTICS_URL = f"{FASTAPI_BASE_URL}/statistics"
FASTAPI_EXPORT_JSON_URL = f"{FASTAPI_BASE_URL}/export/json"
FASTAPI_EXPORT_CSV_URL = f"{FASTAPI_BASE_URL}/export/csv"
FASTAPI_EXPORT_JSON_ALL_URL = f"{FASTAPI_BASE_URL}/export/json/all"
FASTAPI_COMPARE_URL = f"{FASTAPI_BASE_URL}/compare"

st.set_page_config(
    page_title="🎙️ AI Voice Compliance Dashboard",
    layout="wide",
    page_icon="🧠",
)


# The API needs a signed-in user: the admin password is ADMIN_PASSWORD, or the one the API
# printed on its first start (see README). Every call below goes through this session.
api = requests.Session()
if "api_token" not in st.session_state:
    st.session_state.api_token = None
with st.sidebar:
    if st.session_state.api_token:
        st.caption(f"Signed in as {st.session_state.get('api_user', '')}")
        if st.button("Sign out"):
            st.session_state.api_token = None
            st.rerun()
    else:
        with st.form("sign_in"):
            st.subheader("Sign in")
            username = st.text_input("Username", value="admin")
            password = st.text_input("Password", type="password")
            if st.form_submit_button("Sign in"):
                try:
                    login = requests.post(
                        f"{FASTAPI_BASE_URL}/api/auth/login",
                        json={"username": username, "password": password},
                        timeout=15,
                    )
                except requests.RequestException:
                    login = None
                if login is not None and login.ok and login.json().get("must_change_password"):
                    # The API refuses everything else until the first or temporary password is replaced.
                    st.warning("This account still has its first or temporary password. Set a new one in the web app, then sign in here.")
                elif login is not None and login.ok:
                    st.session_state.api_token = login.json()["access_token"]
                    st.session_state.api_user = username
                    st.rerun()
                else:
                    st.error("Sign-in failed. Check the username and password, and that the API is running.")
if not st.session_state.api_token:
    st.info("Sign in from the sidebar to use the dashboard.")
    st.stop()
api.headers["Authorization"] = f"Bearer {st.session_state.api_token}"


# ------------------------------------
# SIDEBAR NAVIGATION
# ------------------------------------
st.sidebar.title("🎙️ Voice Compliance Auditor")
page = st.sidebar.selectbox(
    "Navigate",
    ["📊 New Analysis", "📦 Batch Processing", "📜 History", "📈 Statistics & Trends", "⚖️ Compare", "⚙️ Settings"]
)

# ------------------------------------
# INITIALIZE SESSION STATE
# ------------------------------------
if "analysis_data" not in st.session_state:
    st.session_state.analysis_data = None
if "recorded_audio" not in st.session_state:
    st.session_state.recorded_audio = None

# ------------------------------------
# PAGE: NEW ANALYSIS
# ------------------------------------
if page == "📊 New Analysis":
    st.title("📊 New Analysis")
    st.markdown(
        """
        Upload an audio clip or record directly to get:
        - 🎧 Transcription
        - 😄 Sentiment, Emotion & Toxicity analysis
        - 📈 Unified 0–100 compliance score
        - 🧠 Explainability: word influence visualization
        """
    )

    # Tab interface for Upload vs Record
    upload_tab, record_tab = st.tabs(["📤 Upload Audio", "🎤 Record Audio"])

    uploaded_file = None

    with upload_tab:
        uploaded_file = st.file_uploader("Upload an audio file", type=["wav", "mp3"], key="upload")

        if uploaded_file is not None:
            st.audio(uploaded_file, format="audio/wav")
            # Clear recorded audio if user uploads a file
            if "recorded_audio" in st.session_state:
                st.session_state.recorded_audio = None

    with record_tab:
        st.markdown("### 🎤 Record Audio Directly")
        st.info("💡 Use your browser's microphone to record audio. Click 'Record' to start/stop.")

        # Audio recording component (returns UploadedFile object)
        audio_input = st.audio_input("Record your audio", key="recording")

        if audio_input is not None:
            st.audio(audio_input, format="audio/wav")

            # Save recording to session state
            # st.audio_input returns bytes directly (not UploadedFile)
            import io
            try:
                # st.audio_input returns bytes directly, not an UploadedFile
                # But let's handle both cases just in case
                if isinstance(audio_input, bytes):
                    # Direct bytes - most common case
                    audio_bytes = audio_input
                else:
                    # If it's not bytes, try to extract bytes
                    # This handles edge cases where it might be an UploadedFile
                    if hasattr(audio_input, 'getvalue'):
                        result = audio_input.getvalue()
                        # Make sure getvalue() returned bytes, not the object itself
                        if isinstance(result, bytes):
                            audio_bytes = result
                        else:
                            # If getvalue() returned the object itself, try read()
                            if hasattr(audio_input, 'read'):
                                audio_input.seek(0)  # Reset if needed
                                audio_bytes = audio_input.read()
                            else:
                                raise ValueError(f"Could not extract bytes from audio_input of type {type(audio_input)}")
                    elif hasattr(audio_input, 'read'):
                        # File-like object
                        audio_bytes = audio_input.read()
                        if hasattr(audio_input, 'seek'):
                            audio_input.seek(0)  # Reset pointer
                    else:
                        raise ValueError(f"Could not extract bytes from audio_input of type {type(audio_input)}")

                # Double-check we have bytes
                if not isinstance(audio_bytes, bytes):
                    raise TypeError(f"Expected bytes, got {type(audio_bytes)}")

                # Create BytesIO object with filename
                audio_file = io.BytesIO(audio_bytes)
                audio_file.name = f"recording_{datetime.now().strftime('%Y%m%d_%H%M%S')}.wav"
                st.session_state.recorded_audio = audio_file
                st.success("✅ Recording captured! Scroll down to analyze.")
            except Exception as e:
                st.error(f"Error processing recording: {str(e)}")
                import traceback
                st.code(traceback.format_exc())

        # Show if we have a saved recording
        if "recorded_audio" in st.session_state and st.session_state.recorded_audio is not None:
            st.info("🎤 You have a saved recording. Use it in the analysis section below.")

    # Determine which audio to use (prioritize uploaded file)
    if uploaded_file is None and "recorded_audio" in st.session_state and st.session_state.recorded_audio is not None:
        uploaded_file = st.session_state.recorded_audio

    # Handle both uploaded and recorded audio
    if uploaded_file is not None:
        st.divider()
        st.subheader("🎵 Audio Preview")
        st.audio(uploaded_file, format="audio/wav")

        col1, col2 = st.columns([3, 1])
        with col1:
            filename = uploaded_file.name if hasattr(uploaded_file, 'name') else "recording.wav"
            st.write(f"**File:** {filename}")
        with col2:
            if st.button("🗑️ Clear", key="clear_audio"):
                st.session_state.recorded_audio = None
                st.rerun()

        st.divider()
        if st.button("🚀 Run Compliance Analysis", type="primary"):
            with st.spinner("Analyzing audio... this may take a few seconds ⏳"):
                try:
                    # Handle both file upload and recorded audio
                    if hasattr(uploaded_file, 'getvalue'):
                        audio_data = uploaded_file.getvalue()
                    elif hasattr(uploaded_file, 'read'):
                        audio_data = uploaded_file.read()
                        uploaded_file.seek(0)  # Reset pointer
                    else:
                        audio_data = uploaded_file

                    files = {"file": audio_data}
                    response = api.post(FASTAPI_ANALYZE_URL, files=files)

                    if response.status_code != 200:
                        st.error(f"❌ Error {response.status_code}: {response.text}")
                        st.stop()

                    # Save analysis data in session state ✅
                    st.session_state.analysis_data = response.json()
                    st.success("✅ Analysis complete! You can now view results below.")

                    # Clear recorded audio after successful analysis
                    if "recorded_audio" in st.session_state:
                        st.session_state.recorded_audio = None
                except Exception as e:
                    st.error(f"Error analyzing audio: {str(e)}")
                    import traceback
                    st.code(traceback.format_exc())

    # ------------------------------------
    # DISPLAY RESULTS IF AVAILABLE
    # ------------------------------------
    if st.session_state.analysis_data is not None:
        data = st.session_state.analysis_data

        text = data.get("transcription", "")
        analysis = data.get("analysis", {})
        explanations = data.get("explanation", [])

        # SECTION 1 — Transcript
        st.header("🧾 Transcript")
        st.write(text)

        # SECTION 2 — Alerts (if any)
        alerts = data.get("alerts", {})
        if alerts and alerts.get("has_alerts", False):
            st.header("🚨 Compliance Alerts")

            critical_count = alerts.get("critical", 0)
            warning_count = alerts.get("warning", 0)

            if critical_count > 0:
                st.error(f"🚨 **{critical_count} Critical Alert(s)** - Immediate attention required!")
            if warning_count > 0:
                st.warning(f"⚠️ **{warning_count} Warning(s)** - Review recommended")

            # Show alert details
            alert_list = alerts.get("alerts", [])
            if alert_list:
                with st.expander("📋 View All Alerts"):
                    for alert in alert_list:
                        level = alert.get("level", "info")
                        message = alert.get("message", "")
                        metric = alert.get("metric", "")
                        value = alert.get("value", 0)

                        if level == "critical":
                            st.error(f"🔴 **CRITICAL:** {message}")
                        elif level == "warning":
                            st.warning(f"🟡 **WARNING:** {message}")
                        else:
                            st.info(f"ℹ️ **INFO:** {message}")

            st.divider()

        # SECTION 3 — Analytics Summary
        st.header("📊 Model Analysis")

        sentiment = analysis.get("sentiment", "N/A")
        sentiment_conf = analysis.get("sentiment_confidence", 0)
        emotion = analysis.get("emotion", "N/A")
        emotion_conf = analysis.get("emotion_confidence", 0)
        toxicity = analysis.get("toxicity_score", 0)
        compliance = analysis.get("compliance_score", 0)

        col1, col2, col3, col4 = st.columns(4)
        col1.metric("Sentiment", sentiment, f"{sentiment_conf * 100:.1f}%")
        col2.metric("Emotion", emotion, f"{emotion_conf * 100:.1f}%")
        col3.metric("Toxicity", f"{toxicity * 100:.1f}%")
        col4.metric("Compliance Score", f"{compliance:.2f}")

        # SECTION 4 — Sentiment Timeline (if available)
        sentiment_timeline = data.get("sentiment_timeline")
        if sentiment_timeline and sentiment_timeline.get("timeline"):
            st.divider()
            st.header("📈 Sentiment Timeline")
            st.markdown("Track how sentiment and compliance change over time in the audio.")

            timeline = sentiment_timeline.get("timeline", [])
            overall_metrics = sentiment_timeline.get("overall_metrics", {})

            # Timeline metrics
            col1, col2, col3, col4 = st.columns(4)
            col1.metric("Total Segments", overall_metrics.get("total_segments", 0))
            col2.metric("Avg Sentiment", f"{overall_metrics.get('average_sentiment_score', 0):.2f}")
            col3.metric("Sentiment Trend", overall_metrics.get("sentiment_trend", "stable").title())
            col4.metric("Compliance Range", f"{overall_metrics.get('compliance_range', {}).get('min', 0):.0f}-{overall_metrics.get('compliance_range', {}).get('max', 100):.0f}")

            # Create timeline chart
            if timeline:
                df_timeline = pd.DataFrame([
                    {
                        "Time (s)": seg.get("start_time", 0),
                        "Compliance Score": seg.get("compliance_score", 0),
                        "Sentiment Score": seg.get("sentiment", {}).get("score", 0),
                        "Segment": f"Segment {seg.get('segment_id', 0)}"
                    }
                    for seg in timeline
                ])

                # Compliance score over time
                fig_timeline = go.Figure()
                fig_timeline.add_trace(go.Scatter(
                    x=df_timeline["Time (s)"],
                    y=df_timeline["Compliance Score"],
                    mode='lines+markers',
                    name='Compliance Score',
                    line=dict(color='blue', width=2),
                    fill='tozeroy',
                    fillcolor='rgba(0, 0, 255, 0.1)'
                ))
                fig_timeline.update_layout(
                    title="Compliance Score Over Time",
                    xaxis_title="Time (seconds)",
                    yaxis_title="Compliance Score",
                    hovermode='x unified',
                    height=400
                )
                st.plotly_chart(fig_timeline, use_container_width=True)

                # Sentiment score over time
                fig_sentiment = go.Figure()
                fig_sentiment.add_trace(go.Scatter(
                    x=df_timeline["Time (s)"],
                    y=df_timeline["Sentiment Score"],
                    mode='lines+markers',
                    name='Sentiment Score',
                    line=dict(color='green', width=2),
                    fill='tozeroy',
                    fillcolor='rgba(0, 255, 0, 0.1)'
                ))
                fig_sentiment.update_layout(
                    title="Sentiment Score Over Time",
                    xaxis_title="Time (seconds)",
                    yaxis_title="Sentiment Score (-1 to 1)",
                    hovermode='x unified',
                    height=400,
                    yaxis_range=[-1, 1]
                )
                st.plotly_chart(fig_sentiment, use_container_width=True)

                # Timeline segments table
                with st.expander("📋 View Timeline Segments"):
                    segment_data = []
                    for seg in timeline[:20]:  # Show first 20 segments
                        segment_data.append({
                            "Segment": seg.get("segment_id", 0),
                            "Start": f"{seg.get('start_time', 0):.1f}s",
                            "End": f"{seg.get('end_time', 0):.1f}s",
                            "Compliance": f"{seg.get('compliance_score', 0):.1f}",
                            "Sentiment": seg.get("sentiment", {}).get("sentiment", "N/A"),
                            "Emotion": seg.get("emotion", {}).get("emotion", "N/A"),
                            "Text": seg.get("text", "")[:50] + "..." if len(seg.get("text", "")) > 50 else seg.get("text", "")
                        })

                    if segment_data:
                        df_segments = pd.DataFrame(segment_data)
                        st.dataframe(df_segments, use_container_width=True)

            st.divider()

        # SECTION 5 — Gauge
        st.subheader("📈 Compliance Gauge")

        fig, ax = plt.subplots(figsize=(6, 1.5))
        color = "green" if compliance >= 75 else "orange" if compliance >= 50 else "red"
        ax.barh(["Compliance"], [compliance], color=color)
        ax.set_xlim(0, 100)
        ax.set_xlabel("Score (0–100)")
        st.pyplot(fig)

        # SECTION 4 — Enhanced Explainability
        st.header("🧠 Explainability Analysis")

        enhanced_explanation = data.get("enhanced_explanation")

        if enhanced_explanation:
            # Tabs for different explanation views
            tab1, tab2, tab3, tab4 = st.tabs(["📊 Overview", "🔬 Toxicity Analysis", "😊 Sentiment Breakdown", "⚡ Compliance Factors"])

            with tab1:
                st.subheader("📊 Overall Summary")

                insights = enhanced_explanation.get("overall_summary", {}).get("key_insights", {})

                col1, col2 = st.columns(2)
                with col1:
                    st.write("**Top Negative Contributors (Toxicity):**")
                    negative_words = insights.get("most_toxic_words", [])
                    if negative_words:
                        for word in negative_words[:5]:
                            st.write(f"• {word}")
                    else:
                        st.write("None identified")

                with col2:
                    st.write("**Top Positive Contributors:**")
                    positive_words = insights.get("most_positive_words", [])
                    if positive_words:
                        for word in positive_words[:5]:
                            st.write(f"• {word}")
                    else:
                        st.write("None identified")

                # Dominant sentiment
                sentiment_dist = insights.get("dominant_sentiment", {})
                if sentiment_dist:
                    st.write("**Sentiment Distribution:**")
                    fig_sent = px.pie(
                        values=list(sentiment_dist.values()),
                        names=list(sentiment_dist.keys()),
                        title="Sentence-level Sentiment Distribution"
                    )
                    st.plotly_chart(fig_sent, use_container_width=True)

                # Primary emotion
                primary_emotion = insights.get("primary_emotion", "N/A")
                st.metric("Primary Emotion Detected", primary_emotion)

            with tab2:
                st.subheader("🔬 Toxicity Word Influence Map")

                toxicity_exp = enhanced_explanation.get("toxicity", {})
                top_negative = toxicity_exp.get("top_negative", [])
                top_positive = toxicity_exp.get("top_positive", [])
                token_level = enhanced_explanation.get("toxicity", {}).get("token_level", explanations)

                if token_level:
                    st.markdown("Each word is colored based on its toxicity impact:")
                    st.markdown(
                        """
                        <span style="background-color:rgba(0,255,0,0.3);padding:2px 6px;border-radius:4px;">Positive influence</span>
                        <span style="background-color:rgba(255,0,0,0.3);padding:2px 6px;border-radius:4px;">Negative influence</span>
                        """,
                        unsafe_allow_html=True,
                    )

                    colored_tokens = []
                    for token, val in token_level:
                        val = float(val)
                        alpha = min(abs(val), 1.0)
                        color = (
                            f"rgba(0,255,0,{alpha})" if val > 0
                            else f"rgba(255,0,0,{alpha})"
                        )
                        colored_tokens.append(
                            f"<span style='background-color:{color};padding:2px 4px;border-radius:4px;margin:1px'>{token}</span>"
                        )
                    st.markdown(" ".join(colored_tokens), unsafe_allow_html=True)

                    # Top contributors bar chart
                    if top_negative or top_positive:
                        col1, col2 = st.columns(2)

                        with col1:
                            if top_negative:
                                st.write("**Top Negative Contributors:**")
                                df_neg = pd.DataFrame(top_negative[:10], columns=["Word", "Impact"])
                                fig_neg = px.bar(
                                    df_neg,
                                    x="Impact",
                                    y="Word",
                                    orientation='h',
                                    title="Most Toxic Words",
                                    color="Impact",
                                    color_continuous_scale="Reds"
                                )
                                st.plotly_chart(fig_neg, use_container_width=True)

                        with col2:
                            if top_positive:
                                st.write("**Top Positive Contributors:**")
                                df_pos = pd.DataFrame(top_positive[:10], columns=["Word", "Impact"])
                                fig_pos = px.bar(
                                    df_pos,
                                    x="Impact",
                                    y="Word",
                                    orientation='h',
                                    title="Most Positive Words",
                                    color="Impact",
                                    color_continuous_scale="Greens"
                                )
                                st.plotly_chart(fig_pos, use_container_width=True)

            with tab3:
                st.subheader("😊 Sentiment Breakdown by Sentence")

                sentiment_exp = enhanced_explanation.get("sentiment", {})
                sentence_sentiments = sentiment_exp.get("sentence_sentiment", [])

                if sentence_sentiments:
                    # Sentence-level sentiment visualization
                    for sent_data in sentence_sentiments[:10]:  # Show first 10 sentences
                        label = sent_data.get("label", "N/A")
                        score = sent_data.get("score", 0)
                        sentence = sent_data.get("sentence", "")

                        color = "green" if label == "POSITIVE" else "red" if label == "NEGATIVE" else "gray"
                        st.markdown(
                            f"""
                            <div style='padding: 10px; margin: 5px 0; border-left: 4px solid {color}; background-color: rgba(0,0,0,0.05);'>
                                <strong>{label}</strong> ({score*100:.1f}%)<br>
                                <em>{sentence}</em>
                            </div>
                            """,
                            unsafe_allow_html=True
                        )

                    # Sentiment distribution chart
                    sentiment_dist = sentiment_exp.get("summary", {}).get("sentiment_distribution", {})
                    if sentiment_dist:
                        st.subheader("Sentiment Distribution")
                        df_sent = pd.DataFrame(list(sentiment_dist.items()), columns=["Sentiment", "Count"])
                        fig_sent = px.bar(
                            df_sent,
                            x="Sentiment",
                            y="Count",
                            title="Number of Sentences by Sentiment",
                            color="Sentiment",
                            color_discrete_map={"POSITIVE": "green", "NEGATIVE": "red", "NEUTRAL": "gray"}
                        )
                        st.plotly_chart(fig_sent, use_container_width=True)
                else:
                    st.info("Sentence-level sentiment analysis not available.")

            with tab4:
                st.subheader("⚡ Compliance Score Breakdown")

                compliance_exp = enhanced_explanation.get("compliance", {})
                factors = compliance_exp.get("factors", {})
                primary_driver = compliance_exp.get("primary_driver", {})

                if factors:
                    st.write("**Contributing Factors:**")

                    factor_data = []
                    for factor_name, factor_info in factors.items():
                        contribution = factor_info.get("contribution", 0)
                        value = factor_info.get("value", "N/A")
                        impact = factor_info.get("impact", "neutral")

                        factor_data.append({
                            "Factor": factor_name.title(),
                            "Value": str(value),
                            "Contribution": contribution,
                            "Impact": impact
                        })

                    df_factors = pd.DataFrame(factor_data)

                    # Visualize factors
                    fig_factors = px.bar(
                        df_factors,
                        x="Factor",
                        y="Contribution",
                        title="Compliance Score Contributions",
                        color="Impact",
                        color_discrete_map={"positive": "green", "negative": "red", "neutral": "gray"},
                        text="Contribution"
                    )
                    fig_factors.update_traces(texttemplate='%{text:.1f}%', textposition='outside')
                    st.plotly_chart(fig_factors, use_container_width=True)

                    # Primary driver
                    if primary_driver:
                        driver_factor = primary_driver.get("factor", "N/A")
                        driver_impact = primary_driver.get("impact", "N/A")
                        st.info(f"**Primary Factor:** {driver_factor.title()} ({driver_impact} impact)")

                    # Display factor details
                    st.subheader("Factor Details")
                    for factor_name, factor_info in factors.items():
                        with st.expander(f"📌 {factor_name.title()}"):
                            st.write(f"**Value:** {factor_info.get('value', 'N/A')}")
                            st.write(f"**Contribution:** {factor_info.get('contribution', 0):.1f}%")
                            st.write(f"**Impact:** {factor_info.get('impact', 'neutral').title()}")

        elif explanations:
            # Fallback to basic explainability if enhanced is not available
            st.subheader("Word Influence Map")
            st.markdown("Each word is colored based on its impact:")
            st.markdown(
                """
                <span style="background-color:rgba(0,255,0,0.3);padding:2px 6px;border-radius:4px;">Positive influence</span>
                <span style="background-color:rgba(255,0,0,0.3);padding:2px 6px;border-radius:4px;">Negative influence</span>
                """,
                unsafe_allow_html=True,
            )

            colored_tokens = []
            for token, val in explanations:
                val = float(val)
                alpha = min(abs(val), 1.0)
                color = (
                    f"rgba(0,255,0,{alpha})" if val > 0
                    else f"rgba(255,0,0,{alpha})"
                )
                colored_tokens.append(
                    f"<span style='background-color:{color};padding:2px 4px;border-radius:4px;margin:1px'>{token}</span>"
                )

            st.markdown(" ".join(colored_tokens), unsafe_allow_html=True)
        else:
            st.warning("No token-level explanations returned by the model.")

        # SECTION 5 — Keyword Detection
        keyword_detection = data.get("keyword_detection")
        if keyword_detection and keyword_detection.get("flagged"):
            st.divider()
            st.header("🚨 Keyword Detection")

            matches = keyword_detection.get("matches", [])
            stats = keyword_detection.get("statistics", {})

            if matches:
                total = stats.get("total", 0)
                risk_level = stats.get("risk_level", "low")

                col1, col2, col3 = st.columns(3)
                col1.metric("Total Matches", total)
                col2.metric("Risk Level", risk_level.upper())
                col3.metric("Categories", len(keyword_detection.get("by_category", {})))

                # Show matches by category
                by_category = keyword_detection.get("by_category", {})
                if by_category:
                    st.subheader("Matches by Category")
                    for category, category_matches in by_category.items():
                        with st.expander(f"🔍 {category.title()} ({len(category_matches)} matches)"):
                            for match in category_matches[:10]:  # Show first 10
                                st.write(f"• **{match['keyword']}** - *{match['context']}*")

                # Highlighted transcript
                st.subheader("Highlighted Transcript")
                # Create highlighted HTML manually
                highlighted_text = text
                for match in sorted(matches, key=lambda x: x["position"], reverse=True):
                    keyword = match["keyword"]
                    category = match["category"]
                    position = match["position"]

                    category_colors = {
                        "profanity": "red",
                        "unprofessional": "orange",
                        "compliance_risky": "purple",
                        "negative_tone": "yellow"
                    }
                    color = category_colors.get(category, "gray")
                    highlighted = f'<span style="background-color:{color};color:white;padding:2px 6px;border-radius:4px;font-weight:bold;" title="{category}">{keyword}</span>'
                    highlighted_text = highlighted_text[:position] + highlighted + highlighted_text[position + len(keyword):]

                st.markdown(highlighted_text, unsafe_allow_html=True)

        # SECTION 6 — Audio Quality Metrics
        audio_quality = data.get("audio_quality")
        if audio_quality and not audio_quality.get("error"):
            st.divider()
            st.header("🎵 Audio Quality Analysis")

            quality_score = audio_quality.get("quality_score", 0)
            quality_level = audio_quality.get("quality_level", "Unknown")

            col1, col2, col3, col4 = st.columns(4)
            col1.metric("Quality Score", f"{quality_score:.1f}", quality_level)
            col2.metric("Duration", audio_quality.get("duration_formatted", "N/A"))
            col3.metric("Sample Rate", f"{audio_quality.get('sample_rate', 0)} Hz")
            col4.metric("Noise Level", audio_quality.get("noise_classification", "N/A"))

            col5, col6, col7, col8 = st.columns(4)
            col5.metric("Clarity", audio_quality.get("clarity_level", "N/A"))
            col6.metric("Volume", audio_quality.get("volume_level", "N/A"))
            col7.metric("Silence Ratio", f"{audio_quality.get('silence_ratio', 0) * 100:.1f}%")
            col8.metric("File Size", audio_quality.get("file_size_formatted", "N/A"))

            # Quality visualization
            quality_factors = {
                "Quality Score": quality_score,
                "Clarity": audio_quality.get("clarity_score", 0),
                "Noise": 100 - (audio_quality.get("noise_level", 0) * 1000),  # Inverted
                "Volume": audio_quality.get("average_volume", 0) * 100
            }

            df_quality = pd.DataFrame(list(quality_factors.items()), columns=["Metric", "Score"])
            fig_quality = px.bar(
                df_quality,
                x="Metric",
                y="Score",
                title="Audio Quality Breakdown",
                color="Score",
                color_continuous_scale="RdYlGn"
            )
            fig_quality.update_layout(yaxis_range=[0, 100])
            st.plotly_chart(fig_quality, use_container_width=True)

        # SECTION 7 — Export Options
        st.divider()
        st.header("📄 Export & Download")

        col1, col2, col3 = st.columns(3)

        with col1:
            if st.button("📄 Generate PDF Report"):
                with st.spinner("Creating your compliance report..."):
                    try:
                        resp = api.post(FASTAPI_REPORT_URL, json=data)
                        if resp.status_code == 200:
                            pdf_bytes = resp.content
                            b64 = base64.b64encode(pdf_bytes).decode()
                            href = (
                                f'<a href="data:application/pdf;base64,{b64}" '
                                f'download="voice_compliance_report.pdf">'
                                f'📥 Click here to download your Compliance Report</a>'
                            )
                            st.markdown(href, unsafe_allow_html=True)
                        else:
                            try:
                                error_detail = resp.json().get("detail", resp.text)
                                st.error(f"❌ Report generation failed ({resp.status_code}): {error_detail}")
                            except:
                                st.error(f"❌ Report generation failed ({resp.status_code}): {resp.text}")
                    except Exception as e:
                        st.error(f"Error generating report: {e}")

        with col2:
            # JSON Export for current analysis
            json_str = json.dumps(data, indent=2, default=str)
            b64_json = base64.b64encode(json_str.encode()).decode()
            href_json = (
                f'<a href="data:application/json;base64,{b64_json}" '
                f'download="analysis_data.json">'
                f'📥 Download JSON</a>'
            )
            st.markdown(href_json, unsafe_allow_html=True)

        with col3:
            # CSV Export helper function
            def create_csv_from_data(data):
                csv_content = "Field,Value\n"
                csv_content += f"Transcription,\"{data.get('transcription', '').replace(chr(10), ' ').replace(chr(13), '')}\"\n"
                analysis = data.get("analysis", {})
                csv_content += f"Compliance Score,{analysis.get('compliance_score', 0)}\n"
                csv_content += f"Sentiment,{analysis.get('sentiment', 'N/A')}\n"
                csv_content += f"Sentiment Confidence,{analysis.get('sentiment_confidence', 0)}\n"
                csv_content += f"Emotion,{analysis.get('emotion', 'N/A')}\n"
                csv_content += f"Emotion Confidence,{analysis.get('emotion_confidence', 0)}\n"
                csv_content += f"Toxicity Score,{analysis.get('toxicity_score', 0)}\n"
                return csv_content

            csv_content = create_csv_from_data(data)
            b64_csv = base64.b64encode(csv_content.encode()).decode()
            href_csv = (
                f'<a href="data:text/csv;base64,{b64_csv}" '
                f'download="analysis_data.csv">'
                f'📥 Download CSV</a>'
            )
            st.markdown(href_csv, unsafe_allow_html=True)

    else:
        st.info("⬆️ Upload and analyze an audio file first to enable report download.")

# ------------------------------------
# PAGE: BATCH PROCESSING
# ------------------------------------
elif page == "📦 Batch Processing":
    st.title("📦 Batch Processing")
    st.markdown("Upload and analyze multiple audio files at once.")

    uploaded_files = st.file_uploader(
        "Upload multiple audio files",
        type=["wav", "mp3"],
        accept_multiple_files=True
    )

    if uploaded_files:
        st.info(f"📁 {len(uploaded_files)} file(s) selected")

        # Show file list
        with st.expander("📋 View Selected Files"):
            for idx, file in enumerate(uploaded_files, 1):
                st.write(f"{idx}. {file.name} ({file.size:,} bytes)")

        # Process button
        if st.button("🚀 Process All Files", type="primary"):
            progress_bar = st.progress(0)
            status_text = st.empty()

            try:
                status_text.text("Preparing files for upload...")

                # Prepare files for upload
                files_data = []
                for file in uploaded_files:
                    file.seek(0)  # Reset file pointer
                    files_data.append(("files", (file.name, file.getvalue(), file.type)))

                status_text.text(f"Processing {len(uploaded_files)} file(s)... This may take a while ⏳")

                # Send batch request
                response = api.post(FASTAPI_BATCH_URL, files=files_data)

                if response.status_code == 200:
                    batch_result = response.json()

                    total = batch_result.get("total_files", 0)
                    successful = batch_result.get("successful", 0)
                    failed = batch_result.get("failed", 0)
                    results = batch_result.get("results", [])
                    errors = batch_result.get("errors", [])

                    progress_bar.progress(1.0)
                    status_text.text("✅ Batch processing complete!")

                    # Summary
                    st.success(f"✅ Processed {successful} of {total} files successfully")
                    if failed > 0:
                        st.warning(f"⚠️ {failed} file(s) failed to process")

                    # Summary Statistics
                    if results:
                        st.header("📊 Batch Summary")
                        col1, col2, col3, col4 = st.columns(4)

                        avg_compliance = sum(r.get("analysis", {}).get("compliance_score", 0) for r in results) / len(results)
                        avg_toxicity = sum(r.get("analysis", {}).get("toxicity_score", 0) for r in results) / len(results)
                        sentiment_dist = {}
                        for r in results:
                            sentiment = r.get("analysis", {}).get("sentiment", "Unknown")
                            sentiment_dist[sentiment] = sentiment_dist.get(sentiment, 0) + 1

                        col1.metric("Total Files", len(results))
                        col2.metric("Avg Compliance", f"{avg_compliance:.2f}")
                        col3.metric("Avg Toxicity", f"{avg_toxicity * 100:.2f}%")
                        col4.metric("Failed", failed)

                        # Results table
                        st.subheader("📋 Results")
                        results_data = []
                        for result in results:
                            analysis = result.get("analysis", {})
                            results_data.append({
                                "Filename": result.get("filename", "N/A"),
                                "Compliance": round(analysis.get("compliance_score", 0), 2),
                                "Sentiment": analysis.get("sentiment", "N/A"),
                                "Emotion": analysis.get("emotion", "N/A"),
                                "Toxicity": f"{analysis.get('toxicity_score', 0) * 100:.1f}%",
                                "Record ID": result.get("record_id", "N/A")
                            })

                        df_results = pd.DataFrame(results_data)
                        st.dataframe(df_results, use_container_width=True)

                        # Download results as CSV
                        csv_data = df_results.to_csv(index=False)
                        b64_csv = base64.b64encode(csv_data.encode()).decode()
                        href = (
                            f'<a href="data:text/csv;base64,{b64_csv}" '
                            f'download="batch_results.csv">'
                            f'📥 Download Batch Results as CSV</a>'
                        )
                        st.markdown(href, unsafe_allow_html=True)

                        # Download results as JSON
                        json_data = json.dumps(results, indent=2, default=str)
                        b64_json = base64.b64encode(json_data.encode()).decode()
                        href_json = (
                            f'<a href="data:application/json;base64,{b64_json}" '
                            f'download="batch_results.json">'
                            f'📥 Download Batch Results as JSON</a>'
                        )
                        st.markdown(href_json, unsafe_allow_html=True)

                        # Individual results expander
                        st.subheader("📄 Individual Results")
                        for idx, result in enumerate(results):
                            filename = result.get('filename', f'File {idx+1}')
                            compliance = result.get('analysis', {}).get('compliance_score', 0)
                            with st.expander(f"📄 {filename} - Score: {compliance:.2f}"):
                                analysis = result.get("analysis", {})
                                col1, col2, col3 = st.columns(3)
                                col1.metric("Compliance", f"{analysis.get('compliance_score', 0):.2f}")
                                col2.metric("Sentiment", analysis.get("sentiment", "N/A"))
                                col3.metric("Emotion", analysis.get("emotion", "N/A"))

                                st.write("**Transcript:**")
                                st.write(result.get("transcription", "N/A"))

                                # Export buttons for individual result
                                col_exp1, col_exp2, col_exp3 = st.columns(3)
                                with col_exp1:
                                    if st.button(f"📄 PDF", key=f"pdf_batch_{filename}_{idx}"):
                                        with st.spinner("Generating PDF..."):
                                            pdf_resp = api.post(FASTAPI_REPORT_URL, json=result)
                                            if pdf_resp.status_code == 200:
                                                pdf_bytes = pdf_resp.content
                                                b64 = base64.b64encode(pdf_bytes).decode()
                                                href = (
                                                    f'<a href="data:application/pdf;base64,{b64}" '
                                                    f'download="report_{filename}.pdf">'
                                                    f'📥 Download PDF</a>'
                                                )
                                                st.markdown(href, unsafe_allow_html=True)
                                with col_exp2:
                                    json_str = json.dumps(result, indent=2, default=str)
                                    b64_json = base64.b64encode(json_str.encode()).decode()
                                    href_json = (
                                        f'<a href="data:application/json;base64,{b64_json}" '
                                        f'download="{filename}.json">'
                                        f'📥 JSON</a>'
                                    )
                                    st.markdown(href_json, unsafe_allow_html=True)

                    # Show errors if any
                    if errors:
                        st.error("❌ Errors:")
                        for error in errors:
                            st.error(f"**{error.get('filename', 'Unknown')}**: {error.get('error', 'Unknown error')}")

                else:
                    try:
                        error_detail = response.json().get("detail", response.text)
                        st.error(f"❌ Batch processing failed ({response.status_code}): {error_detail}")
                    except:
                        st.error(f"❌ Batch processing failed ({response.status_code}): {response.text}")

            except Exception as e:
                st.error(f"Error during batch processing: {str(e)}")
                import traceback
                st.code(traceback.format_exc())
            finally:
                progress_bar.empty()

    else:
        st.info("⬆️ Upload multiple audio files to process them in batch.")

# ------------------------------------
# PAGE: HISTORY
# ------------------------------------
elif page == "📜 History":
    st.title("📜 Analysis History")
    st.markdown("View and search through your past audio analyses.")

    # Filters
    col1, col2, col3 = st.columns(3)
    with col1:
        min_score = st.number_input("Min Compliance Score", min_value=0, max_value=100, value=0)
    with col2:
        max_score = st.number_input("Max Compliance Score", min_value=0, max_value=100, value=100)
    with col3:
        filename_search = st.text_input("Search Filename", "")

    # Date range filter and export buttons
    col4, col5, col6, col7 = st.columns(4)
    with col4:
        days_back = st.slider("Days Back", min_value=1, max_value=365, value=30)
    with col5:
        limit = st.number_input("Records per page", min_value=10, max_value=100, value=20)
    with col6:
        if st.button("📥 Export CSV", key="export_csv_history"):
            with st.spinner("Exporting CSV..."):
                try:
                    export_params = {
                        "min_score": min_score if min_score > 0 else None,
                        "max_score": max_score if max_score < 100 else None,
                        "filename": filename_search if filename_search else None,
                    }
                    export_params = {k: v for k, v in export_params.items() if v is not None}

                    csv_resp = api.get(FASTAPI_EXPORT_CSV_URL, params=export_params)
                    if csv_resp.status_code == 200:
                        b64_csv = base64.b64encode(csv_resp.content).decode()
                        href = (
                            f'<a href="data:text/csv;base64,{b64_csv}" '
                            f'download="analysis_history.csv">'
                            f'📥 Click here to download CSV</a>'
                        )
                        st.markdown(href, unsafe_allow_html=True)
                    else:
                        st.error(f"Failed to export CSV: {csv_resp.status_code}")
                except Exception as e:
                    st.error(f"Error exporting CSV: {e}")
    with col7:
        if st.button("📥 Export JSON", key="export_json_history"):
            with st.spinner("Exporting JSON..."):
                try:
                    export_params = {
                        "min_score": min_score if min_score > 0 else None,
                        "max_score": max_score if max_score < 100 else None,
                        "filename": filename_search if filename_search else None,
                    }
                    export_params = {k: v for k, v in export_params.items() if v is not None}

                    json_resp = api.get(FASTAPI_EXPORT_JSON_ALL_URL, params=export_params)
                    if json_resp.status_code == 200:
                        json_data = json_resp.json()
                        json_str = json.dumps(json_data, indent=2, default=str)
                        b64_json = base64.b64encode(json_str.encode()).decode()
                        href = (
                            f'<a href="data:application/json;base64,{b64_json}" '
                            f'download="analysis_history.json">'
                            f'📥 Click here to download JSON</a>'
                        )
                        st.markdown(href, unsafe_allow_html=True)
                    else:
                        st.error(f"Failed to export JSON: {json_resp.status_code}")
                except Exception as e:
                    st.error(f"Error exporting JSON: {e}")

    # Fetch history
    try:
        params = {
            "min_score": min_score if min_score > 0 else None,
            "max_score": max_score if max_score < 100 else None,
            "filename": filename_search if filename_search else None,
            "limit": limit
        }
        # Remove None values
        params = {k: v for k, v in params.items() if v is not None}

        response = api.get(FASTAPI_HISTORY_URL, params=params)

        if response.status_code == 200:
            history_data = response.json()
            records = history_data.get("records", [])
            total = history_data.get("total", 0)

            st.info(f"Showing {len(records)} of {total} records")

            if records:
                # Create DataFrame for display
                df_data = []
                for record in records:
                    analysis = record.get("analysis", {})
                    created_at = record.get("created_at", "")
                    # Parse ISO format date
                    try:
                        if created_at:
                            dt = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                            created_at = dt.strftime("%Y-%m-%d %H:%M")
                    except:
                        pass

                    df_data.append({
                        "ID": record.get("id"),
                        "Filename": record.get("filename", "N/A"),
                        "Date": created_at,
                        "Compliance": round(analysis.get("compliance_score", 0), 2),
                        "Sentiment": analysis.get("sentiment", "N/A"),
                        "Emotion": analysis.get("emotion", "N/A"),
                        "Toxicity": f"{analysis.get('toxicity_score', 0) * 100:.1f}%"
                    })

                df = pd.DataFrame(df_data)

                # Display table with expandable rows
                for idx, row in df.iterrows():
                    with st.expander(f"📄 {row['Filename']} - Score: {row['Compliance']} - {row['Date']}"):
                        col1, col2, col3, col4 = st.columns(4)
                        col1.metric("Compliance", f"{row['Compliance']:.2f}")
                        col2.metric("Sentiment", row['Sentiment'])
                        col3.metric("Emotion", row['Emotion'])
                        col4.metric("Toxicity", row['Toxicity'])

                        # Get full record details
                        record_id = row['ID']
                        detail_response = api.get(f"{FASTAPI_HISTORY_URL}/{record_id}")
                        if detail_response.status_code == 200:
                            detail = detail_response.json()
                            st.subheader("Transcript")
                            st.write(detail.get("transcription", ""))

                            # Export buttons
                            col_exp1, col_exp2, col_exp3 = st.columns(3)
                            with col_exp1:
                                if st.button(f"📄 Generate PDF", key=f"pdf_{record_id}"):
                                    with st.spinner("Generating PDF..."):
                                        pdf_resp = api.post(FASTAPI_REPORT_URL, json=detail)
                                        if pdf_resp.status_code == 200:
                                            pdf_bytes = pdf_resp.content
                                            b64 = base64.b64encode(pdf_bytes).decode()
                                            href = (
                                                f'<a href="data:application/pdf;base64,{b64}" '
                                                f'download="voice_compliance_report_{record_id}.pdf">'
                                                f'📥 Click here to download your Compliance Report</a>'
                                            )
                                            st.markdown(href, unsafe_allow_html=True)
                            with col_exp2:
                                # JSON Export
                                json_str = json.dumps(detail, indent=2, default=str)
                                b64_json = base64.b64encode(json_str.encode()).decode()
                                href_json = (
                                    f'<a href="data:application/json;base64,{b64_json}" '
                                    f'download="analysis_{record_id}.json">'
                                    f'📥 Download JSON</a>'
                                )
                                st.markdown(href_json, unsafe_allow_html=True)
                            with col_exp3:
                                # CSV Export for single record
                                csv_lines = [
                                    "Field,Value",
                                    f"ID,{record_id}",
                                    f"Filename,\"{detail.get('filename', 'N/A')}\"",
                                    f"Date,\"{detail.get('created_at', 'N/A')}\"",
                                    f"Compliance Score,{detail.get('analysis', {}).get('compliance_score', 0)}",
                                    f"Sentiment,{detail.get('analysis', {}).get('sentiment', 'N/A')}",
                                    f"Sentiment Confidence,{detail.get('analysis', {}).get('sentiment_confidence', 0)}",
                                    f"Emotion,{detail.get('analysis', {}).get('emotion', 'N/A')}",
                                    f"Emotion Confidence,{detail.get('analysis', {}).get('emotion_confidence', 0)}",
                                    f"Toxicity Score,{detail.get('analysis', {}).get('toxicity_score', 0)}",
                                    f"Transcription,\"{detail.get('transcription', '').replace(chr(10), ' ').replace(chr(13), '')}\""
                                ]
                                csv_content = "\n".join(csv_lines)
                                b64_csv = base64.b64encode(csv_content.encode()).decode()
                                href_csv = (
                                    f'<a href="data:text/csv;base64,{b64_csv}" '
                                    f'download="analysis_{record_id}.csv">'
                                    f'📥 Download CSV</a>'
                                )
                                st.markdown(href_csv, unsafe_allow_html=True)
                        else:
                            st.error("Failed to load record details")
            else:
                st.warning("No records found matching your filters.")
        else:
            st.error(f"Failed to load history: {response.status_code}")
    except Exception as e:
        st.error(f"Error loading history: {str(e)}")

# ------------------------------------
# PAGE: STATISTICS & TRENDS
# ------------------------------------
elif page == "📈 Statistics & Trends":
    st.title("📈 Statistics & Trends")
    st.markdown("View analytics and trends over time.")

    days_range = st.slider("Time Range (days)", min_value=7, max_value=365, value=30)

    try:
        response = api.get(FASTAPI_STATISTICS_URL, params={"days": days_range})

        if response.status_code == 200:
            stats = response.json()

            # Overall Statistics
            st.header("📊 Overall Statistics")
            col1, col2, col3, col4 = st.columns(4)
            col1.metric("Total Analyses", stats.get("total_analyses", 0))
            col2.metric("Average Compliance", f"{stats.get('average_compliance', 0):.2f}")
            col3.metric("Min Compliance", f"{stats.get('min_compliance', 0):.2f}")
            col4.metric("Max Compliance", f"{stats.get('max_compliance', 0):.2f}")

            # Distribution Charts
            if stats.get("by_sentiment"):
                st.subheader("📊 Distribution by Sentiment")
                sentiment_data = stats["by_sentiment"]
                fig_sent = px.pie(
                    values=list(sentiment_data.values()),
                    names=list(sentiment_data.keys()),
                    title="Sentiment Distribution"
                )
                st.plotly_chart(fig_sent, use_container_width=True)

            if stats.get("by_emotion"):
                st.subheader("📊 Distribution by Emotion")
                emotion_data = stats["by_emotion"]
                fig_emotion = px.pie(
                    values=list(emotion_data.values()),
                    names=list(emotion_data.keys()),
                    title="Emotion Distribution"
                )
                st.plotly_chart(fig_emotion, use_container_width=True)

            # Trends Over Time
            trends = stats.get("trends", [])
            if trends:
                st.subheader("📈 Compliance Score Trends")
                df_trends = pd.DataFrame(trends)

                fig_trend = go.Figure()
                fig_trend.add_trace(go.Scatter(
                    x=df_trends['date'],
                    y=df_trends['average_compliance'],
                    mode='lines+markers',
                    name='Average Compliance',
                    line=dict(color='blue', width=2)
                ))
                fig_trend.add_trace(go.Scatter(
                    x=df_trends['date'],
                    y=df_trends['min_compliance'],
                    mode='lines',
                    name='Min Compliance',
                    line=dict(color='red', width=1, dash='dash')
                ))
                fig_trend.add_trace(go.Scatter(
                    x=df_trends['date'],
                    y=df_trends['max_compliance'],
                    mode='lines',
                    name='Max Compliance',
                    line=dict(color='green', width=1, dash='dash')
                ))
                fig_trend.update_layout(
                    title="Compliance Score Over Time",
                    xaxis_title="Date",
                    yaxis_title="Compliance Score",
                    hovermode='x unified'
                )
                st.plotly_chart(fig_trend, use_container_width=True)

                # Daily count chart
                st.subheader("📊 Daily Analysis Count")
                fig_count = px.bar(
                    df_trends,
                    x='date',
                    y='count',
                    title="Number of Analyses per Day"
                )
                st.plotly_chart(fig_count, use_container_width=True)
            else:
                st.info("No trend data available for the selected time range.")
        else:
            st.error(f"Failed to load statistics: {response.status_code}")
    except Exception as e:
        st.error(f"Error loading statistics: {str(e)}")

# ------------------------------------
# PAGE: COMPARE
# ------------------------------------
elif page == "⚖️ Compare":
    st.title("⚖️ Compare Analyses")
    st.markdown("Compare two or more audio analyses side-by-side.")

    # Get available records
    try:
        response = api.get(FASTAPI_HISTORY_URL, params={"limit": 100})
        if response.status_code == 200:
            history_data = response.json()
            available_records = history_data.get("records", [])

            if available_records:
                # Multi-select for records
                record_options = {}
                for r in available_records:
                    filename = r.get('filename', f'Record {r.get("id")}')
                    record_id = r.get("id")
                    compliance = r.get("analysis", {}).get("compliance_score", 0)
                    label = f"{filename} (ID: {record_id}, Score: {compliance:.2f})"
                    record_options[label] = record_id

                selected = st.multiselect(
                    "Select records to compare (2-10):",
                    options=list(record_options.keys()),
                    default=list(record_options.keys())[:2] if len(record_options) >= 2 else []
                )

                if selected and len(selected) >= 2:
                    if len(selected) > 10:
                        st.warning("⚠️ Maximum 10 records can be compared. Please select fewer.")
                    else:
                        record_ids = [record_options[s] for s in selected]

                        if st.button("🔍 Compare Selected Records", type="primary"):
                            with st.spinner("Comparing analyses..."):
                                compare_response = api.post(
                                    FASTAPI_COMPARE_URL,
                                    json={"record_ids": record_ids}
                                )

                                if compare_response.status_code == 200:
                                    comparison = compare_response.json()
                                    records = comparison.get("records", [])
                                    metrics = comparison.get("metrics", {})

                                    # Summary
                                    st.header("📊 Comparison Summary")
                                    col1, col2, col3, col4 = st.columns(4)
                                    col1.metric("Records Compared", len(records))
                                    col2.metric("Avg Compliance", f"{metrics.get('compliance', {}).get('average', 0):.2f}")
                                    col3.metric("Compliance Range", f"{metrics.get('compliance', {}).get('range', 0):.2f}")
                                    col4.metric("Improvement", f"{metrics.get('compliance', {}).get('improvement', 0):.2f}")

                                    # Comparison chart
                                    st.subheader("📈 Compliance Score Comparison")
                                    # Create comparison dataframe
                                    compare_data = []
                                    for r in records:
                                        filename = r.get('filename') or f'Record {r.get("id")}'
                                        analysis = r.get("analysis", {})
                                        compare_data.append({
                                            "Record": filename,
                                            "Compliance": analysis.get("compliance_score", 0),
                                            "Toxicity": analysis.get("toxicity_score", 0) * 100,
                                            "Sentiment": analysis.get("sentiment", "N/A"),
                                            "Emotion": analysis.get("emotion", "N/A")
                                        })
                                    df_compare = pd.DataFrame(compare_data)

                                    fig_compare = go.Figure()
                                    fig_compare.add_trace(go.Bar(
                                        x=df_compare["Record"],
                                        y=df_compare["Compliance"],
                                        name="Compliance Score",
                                        marker_color='blue'
                                    ))
                                    fig_compare.update_layout(
                                        title="Compliance Scores Comparison",
                                        xaxis_title="Records",
                                        yaxis_title="Compliance Score",
                                        yaxis_range=[0, 100]
                                    )
                                    st.plotly_chart(fig_compare, use_container_width=True)

                                    # Detailed comparison table
                                    st.subheader("📋 Detailed Comparison")
                                    st.dataframe(df_compare, use_container_width=True)

                                    # Side-by-side view
                                    st.subheader("📄 Detailed Records")
                                    for r in records:
                                        with st.expander(f"📄 {r.get('filename', 'Unknown')} - Score: {r.get('analysis', {}).get('compliance_score', 0):.2f}"):
                                            analysis = r.get("analysis", {})
                                            col1, col2, col3, col4 = st.columns(4)
                                            col1.metric("Compliance", f"{analysis.get('compliance_score', 0):.2f}")
                                            col2.metric("Sentiment", analysis.get("sentiment", "N/A"))
                                            col3.metric("Emotion", analysis.get("emotion", "N/A"))
                                            col4.metric("Toxicity", f"{analysis.get('toxicity_score', 0) * 100:.1f}%")
                                            st.write("**Transcript:**")
                                            st.write(r.get("transcription", "N/A")[:500] + "..." if len(r.get("transcription", "")) > 500 else r.get("transcription", "N/A"))
                                else:
                                    st.error(f"Failed to compare: {compare_response.status_code}")
            else:
                st.info("No records available to compare. Please analyze some audio files first.")
        else:
            st.error("Failed to load history for comparison.")
    except Exception as e:
        st.error(f"Error loading records: {str(e)}")

# ------------------------------------
# PAGE: SETTINGS
# ------------------------------------
elif page == "⚙️ Settings":
    st.title("⚙️ Settings")
    st.markdown("Configure keyword detection and compliance rules.")

    st.subheader("🔍 Keyword Detection Settings")

    # Custom keyword lists
    st.write("**Default Keyword Categories:**")

    with st.expander("Profanity Keywords"):
        profanity_kw = st.text_area(
            "Keywords (one per line):",
            value="\n".join(["damn", "hell", "crap", "screw", "idiot", "stupid"]),
            height=100,
            key="profanity"
        )

    with st.expander("Unprofessional Keywords"):
        unprof_kw = st.text_area(
            "Keywords (one per line):",
            value="\n".join(["whatever", "who cares", "not my problem", "i don't care"]),
            height=100,
            key="unprofessional"
        )

    with st.expander("Compliance Risky Keywords"):
        compliance_kw = st.text_area(
            "Keywords (one per line):",
            value="\n".join(["discrimination", "lawsuit", "legal action", "sue", "harassment"]),
            height=100,
            key="compliance"
        )

    with st.expander("Negative Tone Keywords"):
        negative_kw = st.text_area(
            "Keywords (one per line):",
            value="\n".join(["terrible", "awful", "horrible", "disgusting", "pathetic"]),
            height=100,
            key="negative"
        )

    st.info("💡 Note: Keyword detection is currently using default lists. Custom keyword lists will be available in a future update.")

    st.subheader("📊 Compliance Rules")

    col1, col2 = st.columns(2)
    with col1:
        st.write("**Sentiment Weights:**")
        sentiment_pos = st.slider("Positive", min_value=0.0, max_value=1.0, value=1.0, step=0.1)
        sentiment_neu = st.slider("Neutral", min_value=0.0, max_value=1.0, value=0.9, step=0.1)
        sentiment_neg = st.slider("Negative", min_value=0.0, max_value=1.0, value=0.6, step=0.1)

    with col2:
        st.write("**Compliance Thresholds:**")
        threshold_excellent = st.slider("Excellent (≥)", min_value=0, max_value=100, value=90)
        threshold_good = st.slider("Good (≥)", min_value=0, max_value=100, value=75)
        threshold_fair = st.slider("Fair (≥)", min_value=0, max_value=100, value=50)

    st.info("💡 Note: Custom compliance rules will be implemented in a future update.")
