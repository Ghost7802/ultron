"""
Profile Piper Neural TTS synthesis vs playback latency
"""
import sys
import os
import time
import io
import wave
from pathlib import Path

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def profile_tts():
    from ultron_voice_core import UltronNeuralTTS

    tts = UltronNeuralTTS()

    # Test 1: Short sentence
    short_phrase = "Hello, I am ULTRON."
    t0 = time.perf_counter()
    w1 = tts.synthesize_wav_bytes(short_phrase)
    t_short = time.perf_counter() - t0
    print(f"Short phrase ('{short_phrase}') synthesis time: {t_short:.3f}s (Bytes: {len(w1)})")

    # Test 2: Medium sentence (Warm model)
    medium_phrase = "ULTRON system online. All local subroutines operational."
    t0 = time.perf_counter()
    w2 = tts.synthesize_wav_bytes(medium_phrase)
    t_med = time.perf_counter() - t0
    print(f"Medium phrase ('{medium_phrase}') synthesis time: {t_med:.3f}s (Bytes: {len(w2)})")

    # Audio playback test: Play short audio chunk
    import sounddevice as sd
    import soundfile as sf
    data, sr = sf.read(io.BytesIO(w1))
    t0 = time.perf_counter()
    sd.play(data, sr)
    sd.wait()
    t_play = time.perf_counter() - t0
    print(f"Playback duration: {t_play:.3f}s (Audio length: {len(data)/sr:.2f}s)")

if __name__ == "__main__":
    profile_tts()
