Add-Type -AssemblyName System.Speech

function Export-SpeechWav([string]$text, [string]$outputPath) {
    $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
    $synth.Rate = 0
    $synth.Volume = 100
    $synth.SetOutputToWaveFile($outputPath)
    $synth.Speak($text)
    $synth.Dispose()
    Write-Host "Created speech file: $outputPath ($(Get-Item $outputPath).Length bytes)"
}

Export-SpeechWav -text "Hello Ultron what time is it" -outputPath "tests/speech_english.wav"
Export-SpeechWav -text "Status report" -outputPath "tests/speech_status.wav"
Export-SpeechWav -text "What is the difference between RAM and storage" -outputPath "tests/speech_ram.wav"

