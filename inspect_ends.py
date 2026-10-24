import glob
files = [
    "ultron_engine/engines/conversation.py",
    "ultron_engine/engines/multimodal.py",
    "ultron_engine/engines/perception.py",
    "ultron_engine/engines/personality.py",
    "ultron_engine/engines/tts.py",
]
for f in files:
    lines = open(f).read().splitlines()
    print(f, "total lines:", len(lines))
    for i in range(max(0, len(lines) - 4), len(lines)):
        print(f"  {i+1}: {lines[i]!r}")