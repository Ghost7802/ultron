"""
ULTRON High-Performance Local Speech-to-Text & Voice Microservice.

Subsystem:
Python Backend Audio Core running on http://127.0.0.1:5001.

Key Responsibilities:
- Hosts lightweight, high-performance Faster-Whisper (INT8 quantized) for speech recognition.
- Provides REST endpoints:
    /transcribe       -> Converts user WAV/WebM audio buffer into text.
    /tts/synthesize   -> Synthesizes neural voice audio via Piper ONNX.
    /tts/stop         -> Immediately silences audio playback for barge-in interruptions.
    /wakeword/poll    -> Relays live wake-word events ("Ultron") to the frontend.
    /health           -> Reports operational readiness and subsystem statuses.
- Runs multi-threaded request handlers with zero cloud dependencies.
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
from socketserver import ThreadingMixIn
import json
import os
import tempfile
import sys
import threading
import time
import numpy as np
import soundfile as sf
import io
from urllib.parse import urlparse, parse_qs
from faster_whisper import WhisperModel

from ultron_memory import UltronMemory
from ultron_tools import ToolRegistry
from ultron_planner import UltronPlanner
from ultron_voice_core import UltronWakeWord, UltronNeuralTTS

for output_stream in (sys.stdout, sys.stderr):
    if hasattr(output_stream, "reconfigure"):
        output_stream.reconfigure(errors="backslashreplace")

print("[ULTRON BACKEND] Initializing offline Whisper STT & System Core...", flush=True)
try:
    model = WhisperModel("tiny", device="cpu", compute_type="int8", cpu_threads=4)
    print("[ULTRON BACKEND] Whisper STT & System Core ready on http://127.0.0.1:5001", flush=True)
except Exception as e:
    print(f"[ULTRON BACKEND ERROR] Error loading Whisper model: {e}", flush=True)
    sys.exit(1)

model_lock = threading.Lock()

# Initialize offline wake-word listener
wake_word_engine = None
try:
    wake_word_engine = UltronWakeWord()
    wake_word_engine.start()
    print("[ULTRON BACKEND] Wake-word listener active (phrase: 'Ultron')", flush=True)
except Exception as e:
    print(f"[ULTRON BACKEND WARNING] Wake-word listener deferred: {e}", flush=True)

# Initialize offline neural TTS engine
tts_engine = None
try:
    tts_engine = UltronNeuralTTS()
    print("[ULTRON BACKEND] Offline Piper neural TTS engine ready", flush=True)
except Exception as e:
    print(f"[ULTRON BACKEND WARNING] Offline neural TTS deferred: {e}", flush=True)

class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True

class STTHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path in ['/', '/health']:
            self.respond_json({
                'status': 'ok',
                'service': 'ultron-backend',
                'model': 'whisper-tiny',
                'tools_active': True,
                'memory_active': True,
                'wakeword_active': wake_word_engine.running if wake_word_engine else False,
                'tts_active': tts_engine is not None,
            })
            return

        elif path == '/wakeword/poll':
            evt = wake_word_engine.poll_event() if wake_word_engine else None
            self.respond_json({'status': 'ok', 'event': evt})
            return

        elif path == '/wakeword/status':
            st = wake_word_engine.get_status() if wake_word_engine else {'running': False}
            self.respond_json({'status': 'ok', 'wakeword': st})
            return

        elif path == '/tts/status':
            is_speaking = tts_engine.is_speaking if tts_engine else False
            self.respond_json({'status': 'ok', 'is_speaking': is_speaking})
            return

        elif path == '/system/diagnostics':
            diag = ToolRegistry.get_system_diagnostics()
            self.respond_json(diag)
            return

        elif path == '/memory/facts':
            params = parse_qs(parsed.query)
            cat = params.get('category', [None])[0]
            facts = UltronMemory.list_facts(cat)
            self.respond_json({'status': 'success', 'facts': facts})
            return

        else:
            self.respond_json({'error': 'Not Found'}, status=404)

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        # 1. Transcribe Endpoint (Whisper STT with Hindi/Hinglish tuning)
        if path == '/transcribe':
            request_started = time.perf_counter()
            content_length = int(self.headers.get('Content-Length', 0))
            audio_bytes = self.rfile.read(content_length)

            if not audio_bytes or len(audio_bytes) < 1000:
                self.respond_json({'text': ''})
                return

            tmp_path = None
            text = ""
            try:
                try:
                    data, samplerate = sf.read(io.BytesIO(audio_bytes))
                    max_vol = np.max(np.abs(data)) if len(data) > 0 else 0
                    if max_vol < 0.01:
                        self.respond_json({'text': ''})
                        return
                except Exception:
                    pass

                with tempfile.NamedTemporaryFile(delete=False, suffix='.webm') as tmp:
                    tmp.write(audio_bytes)
                    tmp_path = tmp.name

                with model_lock:
                    # initial_prompt guides Whisper for Hinglish/Hindi spoken queries
                    segments, info = model.transcribe(
                        tmp_path,
                        beam_size=1,
                        vad_filter=False,
                        initial_prompt="Hindi, English, Hinglish: Ashish, Ultron, Chrome, YouTube, VS Code, open, kholo, band, scroll, search, system"
                    )
                    text = " ".join([seg.text.strip() for seg in segments if seg.text.strip()])

                print(f"[STT RECOGNIZED] text='{text}' audio={info.duration:.2f}s elapsed={time.perf_counter() - request_started:.2f}s", flush=True)

            except Exception as e:
                print(f"[STT ERROR] {e}", flush=True)
                self.respond_json({'error': 'Transcription failed'}, status=500)
                return
            finally:
                if tmp_path and os.path.exists(tmp_path):
                    try:
                        os.remove(tmp_path)
                    except Exception:
                        pass

            self.respond_json({'text': text})
            return

        # Dedicated TTS Synthesis & Control endpoints
        if path == '/tts/synthesize':
            content_length = int(self.headers.get('Content-Length', 0))
            raw_data = self.rfile.read(content_length).decode('utf-8') if content_length > 0 else '{}'
            try:
                body_json = json.loads(raw_data)
                text = body_json.get('text', '')
            except Exception:
                text = raw_data
            if not text:
                self.respond_json({'error': 'text parameter is required'}, status=400)
                return
            if not tts_engine:
                self.respond_json({'error': 'TTS engine unavailable'}, status=503)
                return
            try:
                wav_bytes = tts_engine.synthesize_wav_bytes(text)
                self.send_response(200)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', 'audio/wav')
                self.send_header('Content-Length', str(len(wav_bytes)))
                self.end_headers()
                self.wfile.write(wav_bytes)
            except Exception as e:
                self.respond_json({'error': f'TTS synthesis failed: {e}'}, status=500)
            return

        # Read JSON body for API endpoints
        content_length = int(self.headers.get('Content-Length', 0))
        body = {}
        if content_length > 0:
            try:
                body = json.loads(self.rfile.read(content_length).decode('utf-8'))
            except Exception:
                self.respond_json({'error': 'Invalid JSON body'}, status=400)
                return

        # 2. Memory endpoints
        if path == '/memory/save':
            key = body.get('key')
            val = body.get('value')
            cat = body.get('category', 'general')
            tags = body.get('tags', '')
            if not key or not val:
                self.respond_json({'error': 'key and value are required'}, status=400)
                return
            res = UltronMemory.save_fact(key, val, cat, tags)
            self.respond_json(res)
            return

        elif path == '/memory/search':
            query = body.get('query', '')
            limit = int(body.get('limit', 5))
            res = UltronMemory.search_memories(query, limit)
            self.respond_json(res)
            return

        elif path == '/memory/delete':
            key = body.get('key')
            if not key:
                self.respond_json({'error': 'key is required'}, status=400)
                return
            deleted = UltronMemory.delete_fact(key)
            self.respond_json({'status': 'success' if deleted else 'not_found', 'key': key})
            return

        elif path == '/memory/reset':
            confirm = body.get('confirm', False)
            if not confirm:
                self.respond_json({'error': 'Explicit confirm: true required to reset memory'}, status=400)
                return
            res = UltronMemory.reset_all_memories()
            self.respond_json(res)
            return

        elif path == '/memory/record_turn':
            sess = body.get('session_id', 'default')
            role = body.get('role', 'user')
            content = body.get('content', '')
            summary = body.get('summary', '')
            UltronMemory.record_conversation(sess, role, content, summary)
            # Also run selective fact extraction
            if role == 'user':
                fact = UltronMemory.selective_fact_extraction(content)
                if fact:
                    UltronMemory.save_fact(fact['key'], fact['value'], fact['category'])
            self.respond_json({'status': 'recorded'})
            return

        # Voice Core: TTS direct playback & Barge-in controls
        if path == '/tts/speak':
            text = body.get('text', '')
            if not text:
                self.respond_json({'error': 'text is required'}, status=400)
                return
            if not tts_engine:
                self.respond_json({'error': 'TTS engine unavailable'}, status=503)
                return
            if wake_word_engine:
                wake_word_engine.set_suppressed(True)
            def _on_done():
                if wake_word_engine:
                    wake_word_engine.set_suppressed(False)
            tts_engine.speak(text, on_done=_on_done)
            self.respond_json({'status': 'speaking', 'text': text})
            return

        elif path == '/tts/stop':
            if tts_engine:
                tts_engine.stop()
            if wake_word_engine:
                wake_word_engine.set_suppressed(False)
            self.respond_json({'status': 'stopped'})
            return

        elif path == '/wakeword/control':
            action = body.get('action', 'status')
            if not wake_word_engine:
                self.respond_json({'error': 'Wakeword engine unavailable'}, status=503)
                return
            if action == 'start':
                wake_word_engine.start()
            elif action == 'stop':
                wake_word_engine.stop()
            self.respond_json(wake_word_engine.get_status())
            return

        # 3. Dedicated Tool Execution endpoint
        elif path == '/tools/execute':
            tool_name = body.get('tool')
            params = body.get('params', {})
            confirm_token = body.get('confirm_token')
            auto_confirm = body.get('auto_confirm', False)

            if tool_name == 'system_diagnostics':
                self.respond_json(ToolRegistry.get_system_diagnostics())
            elif tool_name == 'launch_app':
                app = params.get('app_name', '')
                self.respond_json(ToolRegistry.launch_application(app))
            elif tool_name == 'close_app':
                app = params.get('app_name', '')
                self.respond_json(ToolRegistry.close_application(app, confirm_token, auto_confirm=auto_confirm))
            elif tool_name == 'search_files':
                pattern = params.get('query_pattern', '')
                base_dir = params.get('base_dir')
                self.respond_json(ToolRegistry.search_files(pattern, base_dir))
            elif tool_name == 'read_file':
                path = params.get('file_path', '')
                self.respond_json(ToolRegistry.read_file(path))
            elif tool_name == 'write_file':
                path = params.get('file_path', '')
                content = params.get('content', '')
                mode = params.get('mode', 'write')
                self.respond_json(ToolRegistry.write_file(path, content, mode, confirm_token))
            elif tool_name == 'delete_file':
                path = params.get('file_path', '')
                self.respond_json(ToolRegistry.delete_file(path, confirm_token, auto_confirm=auto_confirm))
            elif tool_name == 'run_command':
                cmd = params.get('command', '')
                cwd = params.get('cwd')
                self.respond_json(ToolRegistry.run_developer_command(cmd, cwd))
            elif tool_name == 'capture_screen':
                self.respond_json(ToolRegistry.capture_screen(params.get('target_window'), params.get('max_width', 1280)))
            elif tool_name == 'analyze_screen':
                self.respond_json(ToolRegistry.analyze_screen(params.get('query', 'Describe what is currently visible on the screen.')))
            elif tool_name == 'web_search':
                self.respond_json(ToolRegistry.web_search(params.get('query', '')))
            elif tool_name == 'fetch_web_page':
                self.respond_json(ToolRegistry.fetch_web_page(params.get('url', '')))
            else:
                self.respond_json({'error': f'Unknown tool: {tool_name}'}, status=400)
            return

        # 4. Agent Planner endpoint
        elif path == '/agent/plan':
            goal = body.get('goal', '')
            workspace = body.get('workspace')
            if not goal:
                self.respond_json({'error': 'goal is required'}, status=400)
                return
            planner = UltronPlanner(goal, workspace)
            report = planner.execute_plan()
            self.respond_json(report)
            return

        self.respond_json({'error': 'Not Found'}, status=404)

    def respond_json(self, data, status=200):
        try:
            self.send_response(status)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(data).encode('utf-8'))
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError) as exc:
            pass

    def log_message(self, format, *args):
        pass

if __name__ == '__main__':
    server = ThreadedHTTPServer(('127.0.0.1', 5001), STTHandler)
    server.serve_forever()
