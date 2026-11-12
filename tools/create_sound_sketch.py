"""Render the 20-second wish-lantern sound sketch, without samples or services.

Requires numpy. Run: python tools/create_sound_sketch.py
Timeline: 0–5 gathering, 5 birth, 7 ignition, 10 release, 16–20 afterglow.
The WAV is a listening sketch, not a fixed soundtrack for the interactive site.
"""

from pathlib import Path
import json
import wave

import numpy as np


RATE = 48000
SECONDS = 20
N = RATE * SECONDS
RNG = np.random.default_rng(2027)
MUSIC = np.zeros((N, 2), dtype=np.float64)
FOLEY = np.zeros_like(MUSIC)
TIME = np.arange(N) / RATE


def hz(note):
    return 440 * 2 ** ((note - 69) / 12)


def smooth(values):
    x = np.clip(values, 0, 1)
    return x * x * (3 - 2 * x)


def envelope(t, duration, attack, release):
    return smooth(t / attack) * smooth((duration - t) / release)


def place(bus, signal, start, pan=0):
    offset = round(start * RATE)
    length = min(len(signal), N - offset)
    if length <= 0:
        return
    angle = (pan + 1) * np.pi / 4
    bus[offset:offset + length, 0] += signal[:length] * np.cos(angle)
    bus[offset:offset + length, 1] += signal[:length] * np.sin(angle)


def filtered_noise(duration, low, high):
    size = round(duration * RATE)
    frequencies = np.fft.rfftfreq(size, 1 / RATE)
    spectrum = np.fft.rfft(RNG.normal(size=size))
    # Smooth spectral slopes, no abrupt band edges or periodic clicks.
    shape = (1 - np.exp(-(frequencies / low) ** 4)) / (1 + (frequencies / high) ** 6)
    signal = np.fft.irfft(spectrum * shape, n=size)
    return signal / max(np.std(signal), 1e-9)


def pad(note, start, duration, level, pan):
    t = np.arange(round(duration * RATE)) / RATE
    f = hz(note)
    tone = np.zeros_like(t)
    for harmonic, amplitude in [(1, 1), (2, 0.14), (3, 0.035)]:
        phase = RNG.uniform(0, 2 * np.pi)
        tone += amplitude * np.sin(2 * np.pi * f * harmonic * t + phase
                                  + 0.09 * np.sin(2 * np.pi * 0.22 * t))
    tone += 0.22 * np.sin(2 * np.pi * f * 1.0012 * t + 0.7)
    breath = 0.92 + 0.08 * np.sin(2 * np.pi * 0.16 * t)
    place(MUSIC, tone * envelope(t, duration, 2.2, 2.8) * breath * level, start, pan)


def bell(note, start, level, pan=0, duration=4.5):
    t = np.arange(round(duration * RATE)) / RATE
    f = hz(note)
    tone = np.zeros_like(t)
    for ratio, strength, decay in [(1, 1, 1.65), (2, 0.16, 0.9), (3, 0.035, 0.45), (4.01, 0.012, 0.3)]:
        tone += strength * np.sin(2 * np.pi * f * ratio * t) * np.exp(-t / decay)
    place(MUSIC, tone * envelope(t, duration, 0.018, 0.8) * level, start, pan)


# Slowly overlapping D(add9), Bm7, Gmaj9, D6/9 voicings; no dramatic bass hits.
chords = [
    (0, [50, 57, 64, 66], 7.2, 0.022),
    (4.8, [47, 57, 62, 66], 7.3, 0.025),
    (9.6, [43, 57, 62, 66], 7.6, 0.029),
    (14.3, [50, 59, 64, 66], 5.7, 0.023),
]
for start, notes, duration, level in chords:
    for index, note in enumerate(notes):
        pad(note, start, duration, level * (0.75 if index == 0 else 1), (index - 1.5) * 0.32)

# A small, unhurried motif, with space for the visitor's own wish.
for note, start, level, pan in [
    (74, 0.8, 0.070, -0.2), (69, 2.3, 0.045, 0.18),
    (76, 3.7, 0.054, -0.1), (78, 5.05, 0.080, 0.08),
    (74, 6.6, 0.040, -0.28), (71, 8.1, 0.050, 0.24),
    (74, 10.15, 0.073, -0.38), (76, 11.6, 0.056, 0.35),
    (78, 13.0, 0.062, -0.22), (81, 14.4, 0.048, 0.28),
    (78, 16.0, 0.042, -0.16), (74, 17.2, 0.043, 0.10),
]:
    bell(note, start, level, pan)

# The rounded energy hum gathers gently in the palms, without a sci-fi siren.
t = np.arange(round(5.8 * RATE)) / RATE
hum = np.sin(2 * np.pi * hz(62) * t + 0.25 * np.sin(2 * np.pi * 0.65 * t))
hum += 0.18 * np.sin(2 * np.pi * hz(69) * t)
breath = 0.82 + 0.18 * np.sin(2 * np.pi * 0.8 * t)
place(FOLEY, hum * breath * envelope(t, 5.8, 3.7, 1.3) * 0.023, 0.5)
bell(86, 5.12, 0.019, 0.3, 3.4)

# A small, close flame: subdued low noise and tiny soft crackles.
t = np.arange(round(5.5 * RATE)) / RATE
fire = filtered_noise(5.5, 100, 850)
fire *= (0.65 + 0.18 * np.sin(2 * np.pi * 2.7 * t) + 0.12 * np.sin(2 * np.pi * 4.3 * t))
place(FOLEY, fire * envelope(t, 5.5, 0.7, 1.8) * 0.008, 5.0)
for start in [5.5, 6.3, 7.4, 8.2, 9.0]:
    duration = RNG.uniform(0.045, 0.095)
    t = np.arange(round(duration * RATE)) / RATE
    grain = filtered_noise(duration, 500, 2300)
    place(FOLEY, grain * envelope(t, duration, 0.012, duration * 0.7) * 0.008,
          start, RNG.uniform(-0.25, 0.25))

# Ignition and the release are breath-like swells, kept below the melody.
for start, duration, level, pan in [(6.9, 1.7, 0.014, 0), (9.9, 3.2, 0.020, 0.12)]:
    t = np.arange(round(duration * RATE)) / RATE
    breath = filtered_noise(duration, 160, 1300)
    place(FOLEY, breath * np.sin(np.pi * t / duration) ** 2 * level, start, pan)

# Paper and distant river air are suggestions of texture, without fake dialogue.
for start, duration in [(8.0, 0.65), (9.4, 0.85)]:
    t = np.arange(round(duration * RATE)) / RATE
    paper = filtered_noise(duration, 650, 2100)
    place(FOLEY, paper * envelope(t, duration, 0.16, 0.35) * 0.004, start, -0.2)
for pan in [-0.65, 0.65]:
    air = filtered_noise(SECONDS, 100, 750)
    movement = 0.7 + 0.3 * np.sin(2 * np.pi * (0.11 * TIME + pan))
    amount = 0.0018 + smooth((TIME - 14) / 4) * 0.003
    place(FOLEY, air * movement * amount * envelope(TIME, SECONDS, 3, 2.5), 0, pan)


def reverberate(signal):
    # Independent stereo room tails; a short predelay preserves the round attack.
    length = round(RATE * 2.8)
    t = np.arange(length) / RATE
    size = 1 << (N + length - 2).bit_length()
    result = np.zeros_like(signal)
    for channel in range(2):
        impulse = filtered_noise(2.8, 100, 3400) * np.exp(-t / 0.46)
        impulse *= smooth((t - 0.028) / 0.035)
        impulse /= np.sqrt(np.sum(impulse * impulse))
        source = signal[:, channel] * 0.8 + signal[:, 1 - channel] * 0.2
        result[:, channel] = np.fft.irfft(np.fft.rfft(source, size)
                                            * np.fft.rfft(impulse, size), size)[:N]
    return result


mix = MUSIC + FOLEY + reverberate(MUSIC * 0.85 + FOLEY * 0.15) * 0.24
mix -= mix.mean(axis=0)
mix *= envelope(TIME, SECONDS, 0.25, 2.6)[:, None]
peak = np.max(np.abs(mix))
rms = np.sqrt(np.mean(mix * mix))
mix *= min(0.70 / peak, 0.115 / rms)
assert np.isfinite(mix).all()
assert np.max(np.abs(mix)) <= 0.701

output = Path(__file__).resolve().parents[1] / 'audio' / 'wish-night-sketch.wav'
output.parent.mkdir(exist_ok=True)
dither = (RNG.random(mix.shape) - RNG.random(mix.shape)) / 65536
pcm = np.rint((mix + dither) * 32767).astype('<i2')
with wave.open(str(output), 'wb') as wav:
    wav.setnchannels(2)
    wav.setsampwidth(2)
    wav.setframerate(RATE)
    wav.writeframes(pcm.tobytes())

print(json.dumps({
    'file': str(output), 'seconds': SECONDS, 'sample_rate': RATE,
    'peak_dbfs': round(20 * np.log10(np.max(np.abs(mix))), 2),
    'rms_dbfs': round(20 * np.log10(np.sqrt(np.mean(mix * mix))), 2),
    'stereo_correlation': round(float(np.corrcoef(mix.T)[0, 1]), 3),
}, ensure_ascii=False))
