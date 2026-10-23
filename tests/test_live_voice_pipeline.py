"""
ULTRON Live Voice, Hearing & Speech Pipeline Audit
Tests:
1. Audio input device enumeration & physical mic stream capture
2. Piper offline Neural TTS synthesis latency & output
3. Faster-Whisper local STT transcription latency & accuracy
4. OpenWakeWord model loading & prediction loop
"""

import sys
import os
import time
import io
import sounddevice as sd
import numpy as np

# Ensure root directory is in sys.path
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

def run_voice_audit():
    report = {}

    # --- 1. Audio Devices ---
    print("=== 1. AUDIO DEVICES ===")
    devices = sd.query_devices()
    default_input = sd.default.device[0]
    default_output = sd.default.device[1]
    print(f"Default Input Device Index: {default_input} ({devices[default_input]['name']})")
    print(f"Default Output Device Index: {default_output} ({devices[default_output]['name']})")

    input_devices = [
        {"index": i, "name": d["name"], "hostapi": d["hostapi"], "max_input_channels": d["max_input_channels"]}
        for i, d in enumerate(devices) if d["max_input_channels"] > 0
    ]
    report["input_devices_count"] = len(input_devices)
    report["default_input"] = devices[default_input]["name"]

    # Test capturing 0.5s of live audio from default microphone
    print("\n=== 2. PHYSICAL MIC CAPTURE TEST ===")
    mic_test_status = "error"
    mic_rms = 0.0
    try:
        t0 = time.time()
        sample_rate = 16000
        recording = sd.rec(int(0.5 * sample_rate), samplerate=sample_rate, channels=1, dtype='int16')
        sd.wait()
        t_capture = time.time() - t0
        mic_rms = float(np.sqrt(np.mean(recording.astype(np.float32)**2)))
        mic_test_status = "success"
        print(f"Live Mic Capture: Success ({t_capture:.2f}s, RMS amplitude: {mic_rms:.2f}, shape: {recording.shape})")
    except Exception as e:
        print(f"Live Mic Capture Error: {e}")
        mic_test_status = f"failed: {e}"

    report["mic_test"] = {"status": mic_test_status, "rms_amplitude": mic_rms}

    # --- 3. Piper Neural TTS ---
    print("\n=== 3. PIPER NEURAL TTS SYNTHESIS TEST ===")
    tts_status = "error"
    tts_latency = 0.0
    wav_bytes_len = 0
    test_phrase = "ULTRON system online. All local neural subroutines operational."
    try:
        from ultron_voice_core import UltronNeuralTTS
        tts = UltronNeuralTTS()
        t0 = time.time()
        wav_bytes = tts.synthesize_wav_bytes(test_phrase)
        tts_latency = time.time() - t0
        wav_bytes_len = len(wav_bytes)
        tts_status = "success"
        print(f"Piper TTS: Success ({tts_latency:.3f}s latency, {wav_bytes_len} bytes WAV)")
    except Exception as e:
        print(f"Piper TTS Error: {e}")
        tts_status = f"failed: {e}"

    report["tts_test"] = {
        "status": tts_status,
        "latency_sec": round(tts_latency, 3),
        "wav_bytes": wav_bytes_len,
        "test_phrase": test_phrase
    }

    # --- 4. Faster-Whisper Local STT ---
    print("\n=== 4. FASTER-WHISPER LOCAL STT TEST ===")
    stt_status = "error"
    stt_latency = 0.0
    transcribed_text = ""
    try:
        from faster_whisper import WhisperModel
        import soundfile as sf

        t0 = time.time()
        model = WhisperModel("tiny", device="cpu", compute_type="int8")
        load_time = time.time() - t0

        if wav_bytes_len > 0:
            audio_buf = io.BytesIO(wav_bytes)
            audio_data, sr = sf.read(audio_buf, dtype="float32")

            t1 = time.time()
            segments, info = model.transcribe(audio_data, language="en", beam_size=1)
            transcribed_text = " ".join([s.text.strip() for s in segments])
            stt_latency = time.time() - t1
            stt_status = "success"
            print(f"Faster-Whisper: Success (Model load: {load_time:.2f}s, Inference: {stt_latency:.3f}s)")
            print(f"Original Text:    '{test_phrase}'")
            print(f"Transcribed Text: '{transcribed_text}'")
    except Exception as e:
        print(f"Faster-Whisper Error: {e}")
        stt_status = f"failed: {e}"

    report["stt_test"] = {
        "status": stt_status,
        "latency_sec": round(stt_latency, 3),
        "transcript": transcribed_text,
        "accuracy_match": "ultron" in transcribed_text.lower()
    }

    # --- 5. OpenWakeWord Initialization & Prediction ---
    print("\n=== 5. OPENWAKEWORD MODEL TEST ===")
    ww_status = "error"
    ww_latency = 0.0
    try:
        from openwakeword.model import Model
        t0 = time.time()
        ww_model = Model(wakeword_models=["hey_jarvis_v0.1.onnx"], inference_framework="onnx")
        # Run a test inference on 80ms dummy audio
        dummy_chunk = np.zeros(1280, dtype=np.int16)
        preds = ww_model.predict(dummy_chunk)
        ww_latency = time.time() - t0
        ww_status = "success"
        print(f"OpenWakeWord: Success ({ww_latency:.3f}s init+predict, preds: {preds})")
    except Exception as e:
        print(f"OpenWakeWord Error: {e}")
        ww_status = f"failed: {e}"

    report["wakeword_test"] = {
        "status": ww_status,
        "latency_sec": round(ww_latency, 3),
        "model": "hey_jarvis_v0.1.onnx"
    }

    import json
    with open("tests/voice_audit_result.json", "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
    print("\nVoice Audit Summary written to tests/voice_audit_result.json")

if __name__ == "__main__":
    run_voice_audit()

