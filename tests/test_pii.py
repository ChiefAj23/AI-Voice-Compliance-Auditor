"""Personal data in transcripts: what is found and replaced, and what is left alone."""
import pytest

from api.pii import SENSITIVE, TOKENS, redact, redact_transcription, summary


@pytest.mark.parametrize("text, kind", [
    # Cards pass the Luhn check, with or without separators, and spoken digit by digit.
    ("my card is 4111 1111 1111 1111 thanks", "card_number"),
    ("card 4111-1111-1111-1111", "card_number"),
    ("it's 5555555555554444", "card_number"),
    ("the number is four one one one one one one one one one one one one one one one", "card_number"),
    ("social is 123-45-6789", "ssn"),
    ("my SSN is 123 45 6789", "ssn"),
    ("social security number 123456789", "ssn"),
    ("email me at jane.doe@example.com please", "email"),
    ("it's jane dot doe at example dot com", "email"),
    ("call me on (212) 555-0199 tomorrow", "phone"),
    ("my number is 212-555-0199", "phone"),
    ("reach me at +44 20 7946 0958", "phone"),
    ("IBAN GB82 WEST 1234 5698 7654 32", "iban"),
    ("my account number is 00123456789", "account_number"),
    ("member ID is AB1234567", "account_number"),
    ("the security code is 123", "cvv"),
    ("CVV 4321", "cvv"),
    ("my pin is 4455", "pin"),
    ("expiration date 09/28", "card_expiry"),
    ("date of birth is 04/12/1985", "date_of_birth"),
    ("I was born on March 3rd, 1990", "date_of_birth"),
    ("your tracking number is 1234 5678 9012", "number"),
    ("that's 123456789", "number"),
    # A long number that fails the Luhn check may be a misheard card: it is still removed.
    ("the ticket number is 4111 1111 1111 1112", "number"),
])
def test_personal_data_is_replaced(text, kind):
    result = redact(text)
    assert result.counts == {kind: 1}, (text, result)
    assert TOKENS[kind] in result.text


# What Whisper (small) really wrote for a synthetic call voiced by macOS's British "Daniel" voice.
# The voice read each group of card digits as a number ("four thousand one hundred and eleven...")
# and the slash in "09/28" as "stroke". Whisper wrote the digits back as one long number with commas,
# heard "stroke" as "strobe", and put punctuation inside the spoken email. Read digit by digit, the
# way a person reads a card, Whisper gets every digit right; only the punctuation between groups
# varies, which the last cases cover.
@pytest.mark.parametrize("text, counts, expected", [
    ("Please read me the card number. It is 4111,111,111,111. The expiration date is 09 strobe 28. "
     "And the security code is 123.",
     {"card_number": 1, "card_expiry": 1, "cvv": 1},
     "Please read me the card number. It is [CARD]. The expiration date is [EXPIRY]. And the security code is [CVV]."),
    ("My email is jane.doe. At example, dot com and my phone number is 212-555-0199.",
     {"email": 1, "phone": 1},
     "My email is [EMAIL] and my phone number is [PHONE]."),
    # The same call transcribed again: Whisper does not write it the same way twice.
    ("The expiration date is 0 9Strogue 28 and the security code is 123",
     {"card_expiry": 1, "cvv": 1},
     "The expiration date is [EXPIRY] and the security code is [CVV]"),
    ("My email is Jane.doe.at. Example.com and my phone number is [PHONE].",
     {"email": 1},
     "My email is [EMAIL] and my phone number is [PHONE]."),
    ("it's jane dot doe at example dot com", {"email": 1}, "it's [EMAIL]"),
    # Read the way a person would (digit by digit, "zero nine, twenty-eight", "jane dot doe at
    # example dot com"), transcribed by Whisper small at temperature 0.
    ("It is 4111. 1111. 1111. 1111.", {"card_number": 1}, "It is [CARD]."),
    ("The expiration date is 09.28.", {"card_expiry": 1}, "The expiration date is [EXPIRY]."),
    ("The expiry is 09, 28, and the security code is 123.", {"card_expiry": 1, "cvv": 1},
     "The expiry is [EXPIRY], and the security code is [CVV]."),
    ("The expiry is 0.928.", {"card_expiry": 1}, "The expiry is [EXPIRY]."),
    ("My email is jane.doatexample.com", {"email": 1}, "My email is [EMAIL]"),
    ("My phone number is 212-555-0199.", {"phone": 1}, "My phone number is [PHONE]."),
])
def test_what_speech_to_text_really_writes(text, counts, expected):
    result = redact(text)
    assert result.counts == counts
    assert result.text == expected


@pytest.mark.parametrize("text", [
    "Thank you for calling, this call may be recorded for quality and training.",
    "I'll call you back in 5 minutes, around 3:30.",
    "The refund of $1,250.00 will arrive within 5 to 7 business days.",
    "Your order 12345 ships in 2026.",
    "Card ending in 1111 is on file.",
    "The refund of $1,250,000.00 was approved, it costs 4,111.11.",
    "Scores this week were 87. 99. 85. 91. 77.",
    "Visit northwind.com for your bill.",
    "Press 1 for billing or 2 for support.",
    "My account is locked and customer service was great.",
    "Oh no, one two three, that is not right.",  # three spoken digits are not a number
])
def test_ordinary_speech_is_left_alone(text):
    result = redact(text)
    assert result.counts == {}, (text, result)
    assert result.text == text


def test_never_issued_ssn_ranges_are_not_counted_as_ssns():
    result = redact("That is 000-12-3456 and 666-12-3456.")
    assert "ssn" not in result.counts and result.counts == {"number": 2}


def test_several_findings_are_counted_and_the_rest_kept():
    text = "Card 4111 1111 1111 1111, code 123? No, CVV 123. Email jane@example.com. Thanks!"
    result = redact(text)
    assert result.counts == {"card_number": 1, "cvv": 1, "email": 1}
    assert result.text == "Card [CARD], code 123? No, CVV [CVV]. Email [EMAIL]. Thanks!"
    assert result.sensitive == ["card_number", "cvv"]


def test_segments_are_redacted_across_boundaries():
    text = "My card is 4111 1111 1111 1111. Thanks."
    result = {
        "text": text,
        "segments": [
            {"start": 0.0, "end": 2.0, "text": " My card is 4111 1111", "tokens": [1, 2, 3]},
            {"start": 2.0, "end": 4.0, "text": " 1111 1111. Thanks.", "tokens": [4, 5], "words": [{"word": "1111"}]},
        ],
    }
    new_text, new_result, found = redact_transcription(text, result)
    assert new_text == "My card is [CARD]. Thanks."
    assert found.counts == {"card_number": 1}
    first, second = new_result["segments"]
    assert "4111" not in first["text"] and "[CARD]" in first["text"]
    assert "1111" not in second["text"] and "[CARD]" not in second["text"] and "Thanks" in second["text"]
    assert "tokens" not in first and "tokens" not in second and "words" not in second
    assert result["segments"][0]["text"] == " My card is 4111 1111"  # the input is not modified


def test_summary_is_what_an_analysis_keeps():
    found = redact("CVV 123 and email jane@example.com")
    assert summary(found) == {"redacted": True, "counts": {"cvv": 1, "email": 1}, "sensitive": ["cvv"]}
    assert {"card_number", "ssn", "cvv"} <= SENSITIVE and "email" not in SENSITIVE


def test_empty_and_missing_text():
    assert redact("").text == "" and redact("").counts == {}
    new_text, new_result, found = redact_transcription("", None)
    assert new_text == "" and new_result is None and found.counts == {}
