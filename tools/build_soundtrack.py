"""Build original, sample-free audio for the interactive wish-lantern experience.

Run ``python tools/build_soundtrack.py`` (numpy required).
All files are 32 kHz, 16-bit stereo PCM. Loop tracks use periodic oscillators,
wrapped notes, and circular reverb; callers should fade them in/out when switching.
"""

from pathlib import Path
import json
import wave

import numpy as np


RATE = 32000
OUTPUT = Path(__file__).resolve().parents[1] / "audio"
RNG = np.random.default_rng(20271112)


def hz(note):
    return 440 * 2 ** ((note - 69) / 12)


def smooth(value):
    x = np.clip(value, 0, 1)
    return x * x * (3 - 2 * x)


def envelope(t, duration, attack, release):
    return smooth(t / attack) * smooth((duration - t) / release)


def stereo(signal, pan=0):
    angle = (pan + 1) * np.pi / 4
    return np.column_stack((signal * np.cos(angle), signal * np.sin(angle)))


def place(bus, signal, start, pan=0, wrap=False):
    signal = stereo(signal, pan)
    offset = round(start * RATE)
    if wrap:
        indices = (np.arange(len(signal)) + offset) % len(bus)
        np.add.at(bus, indices, signal)
    else:
        end = min(len(bus), offset + len(signal))
        if end > offset:
            bus[offset:end] += signal[:end - offset]


def noise(duration, low=100, high=1000):
    count = round(duration * RATE)
    frequencies = np.fft.rfftfreq(count, 1 / RATE)
    shape = (1 - np.exp(-(frequencies / low) ** 4)) / (1 + (frequencies / high) ** 6)
    result = np.fft.irfft(np.fft.rfft(RNG.normal(size=count)) * shape, n=count)
    return result / max(np.std(result), 1e-9)


def bell(note, duration=4.5):
    t = np.arange(round(duration * RATE)) / RATE
    signal = np.zeros_like(t)
    for ratio, amplitude, decay in [(1, 1, 1.65), (2, 0.16, 0.9), (3, 0.035, 0.45), (4.01, 0.012, 0.3)]:
        signal += amplitude * np.sin(2 * np.pi * hz(note) * ratio * t) * np.exp(-t / decay)
    return signal * envelope(t, duration, 0.025, 0.8)


def pad(note, duration, periodic=False):
    t = np.arange(round(duration * RATE)) / RATE
    base = round(hz(note) * duration) / duration if periodic else hz(note)
    lfo = 4 / duration if periodic else 0.16
    signal = np.zeros_like(t)
    for harmonic, amplitude in [(1, 1), (2, 0.14), (3, 0.035)]:
        phase = RNG.uniform(0, 2 * np.pi)
        signal += amplitude * np.sin(2 * np.pi * base * harmonic * t + phase
                                     + 0.09 * np.sin(2 * np.pi * lfo * t))
    signal *= 0.92 + 0.08 * np.sin(2 * np.pi * lfo * t)
    if not periodic:
        signal *= envelope(t, duration, 2.0, 2.8)
    return signal


def reverb(signal, periodic=False):
    duration = 2.8
    impulse_count = round(duration * RATE)
    t = np.arange(impulse_count) / RATE
    count = len(signal) if periodic else 1 << (len(signal) + impulse_count - 2).bit_length()
    result = np.zeros_like(signal)
    for channel in range(2):
        impulse = noise(duration, 100, 3400) * np.exp(-t / 0.46)
        impulse *= smooth((t - 0.028) / 0.035) * smooth((duration - t) / 0.2)
        impulse /= np.sqrt(np.sum(impulse * impulse))
        source = signal[:, channel] * 0.8 + signal[:, 1 - channel] * 0.2
        result[:, channel] = np.fft.irfft(np.fft.rfft(source, count)
                                             * np.fft.rfft(impulse, count), count)[:len(signal)]
    return signal + result * 0.24


def quiet_loop():
    duration = 24
    t = np.arange(RATE * duration) / RATE
    bus = np.zeros((len(t), 2))
    for index, note in enumerate([50, 57, 64, 66]):
        place(bus, pad(note, duration, True) * (0.017 if index == 0 else 0.022), 0, (index - 1.5) * 0.3)
    for note, start, level, pan in [
        (74, 0.8, 0.054, -0.2), (69, 3.5, 0.037, 0.18),
        (76, 6.8, 0.043, -0.1), (78, 10.6, 0.045, 0.2),
        (74, 15.0, 0.035, -0.22), (69, 20.8, 0.032, 0.17),
    ]:
        place(bus, bell(note) * level, start, pan, True)
    return reverb(bus, True)


def flight():
    duration = 26
    t = np.arange(RATE * duration) / RATE
    bus = np.zeros((len(t), 2))
    for start, notes, length, level in [
        (0, [50, 57, 64, 66], 8.5, 0.021),
        (5.2, [47, 57, 62, 66], 8.8, 0.025),
        (10.6, [43, 57, 62, 66], 9.5, 0.028),
        (16.8, [50, 59, 64, 66], 9.2, 0.022),
    ]:
        for index, note in enumerate(notes):
            place(bus, pad(note, length) * level * (0.75 if index == 0 else 1), start, (index - 1.5) * 0.34)
    for index, (note, start) in enumerate([
        (74, 0.3), (76, 2.8), (78, 5.0), (74, 7.5), (71, 9.9),
        (74, 12.2), (78, 14.6), (81, 16.9), (78, 19.3), (74, 22.0),
    ]):
        place(bus, bell(note) * (0.059 if index < 8 else 0.042), start, (-1 if index % 2 else 1) * 0.28)
    bus = reverb(bus)
    return bus * envelope(t, duration, 0.35, 3.8)[:, None]


def park_loop():
    duration = 24
    t = np.arange(RATE * duration) / RATE
    bus = np.zeros((len(t), 2))
    for index, note in enumerate([50, 57, 59, 66]):
        place(bus, pad(note, duration, True) * (0.015 if index == 0 else 0.019), 0, (index - 1.5) * 0.32)
    for note, start, pan in [(74, 1.4, -0.15), (78, 7.0, 0.2), (76, 13.0, -0.18), (74, 19.4, 0.1)]:
        place(bus, bell(note, 5.0) * 0.032, start, pan, True)
    bus = reverb(bus, True)
    for pan in [-0.6, 0.6]:
        air = noise(duration, 90, 650)
        air *= (0.7 + 0.3 * np.sin(2 * np.pi * (3 * t / duration + pan))) * 0.004
        place(bus, air, 0, pan)
    return bus


def effects():
    birth = np.zeros((RATE * 3, 2))
    for note, start, level, pan in [(78, 0, 0.08, 0), (81, 0.12, 0.025, -0.25), (86, 0.25, 0.013, 0.25)]:
        place(birth, bell(note, 2.6) * level, start, pan)
    birth = reverb(birth)
    birth *= envelope(np.arange(len(birth)) / RATE, 3, 0.02, 0.7)[:, None]
    result = {"birth.wav": (birth, 0.070)}
    for name, duration, low, high, level in [
        ("ignite.wav", 1.7, 130, 950, 0.040),
        ("grip.wav", 0.7, 650, 2100, 0.025),
        ("release.wav", 3.0, 160, 1300, 0.045),
    ]:
        t = np.arange(round(duration * RATE)) / RATE
        breath = noise(duration, low, high)
        breath *= np.sin(np.pi * t / duration) ** 2
        if name == "ignite.wav":
            breath *= 0.85 + 0.1 * np.sin(2 * np.pi * 2.7 * t)
        if name == "grip.wav":
            breath *= 0.65 + 0.35 * np.sin(np.pi * t / duration * 3) ** 2
        signal = stereo(breath)
        if name == "release.wav":
            place(signal, bell(81, 2.7) * 0.08, 0.15, 0.15)
        result[name] = (signal, level)
    return result


def save(name, signal, target_rms, loop=False):
    assert np.isfinite(signal).all()
    signal -= signal.mean(axis=0)
    if not loop:
        t = np.arange(len(signal)) / RATE
        signal *= envelope(t, len(signal) / RATE, 0.012, 0.03)[:, None]
    rms = np.sqrt(np.mean(signal * signal))
    peak = np.max(np.abs(signal))
    signal *= min(target_rms / rms, 0.65 / peak)
    pcm = np.rint(signal * 32767).astype('<i2')
    path = OUTPUT / name
    with wave.open(str(path), "wb") as out:
        out.setnchannels(2)
        out.setsampwidth(2)
        out.setframerate(RATE)
        out.writeframes(pcm.tobytes())
    decoded = pcm.astype(np.float64) / 32768
    assert np.max(np.abs(decoded)) <= 0.651
    mono_ratio = np.sqrt(np.mean(decoded.mean(axis=1) ** 2)) / np.sqrt(np.mean(decoded ** 2))
    assert mono_ratio > 0.7
    seam = float(np.max(np.abs(decoded[0] - decoded[-1])))
    if loop:
        # A loop boundary is one normal sample interval, not an amplitude jump.
        assert seam <= np.max(np.abs(np.diff(decoded, axis=0)))
    else:
        assert np.max(np.abs(decoded[[0, -1]])) <= 1 / 32768
    return {
        "file": name, "seconds": len(signal) / RATE,
        "peak_dbfs": round(float(20 * np.log10(np.max(np.abs(decoded)))), 2),
        "rms_dbfs": round(float(20 * np.log10(np.sqrt(np.mean(decoded ** 2)))), 2),
        "mono_loss_db": round(float(20 * np.log10(mono_ratio)), 2),
        "seam_delta": round(seam, 6), "bytes": path.stat().st_size,
    }


def main():
    OUTPUT.mkdir(exist_ok=True)
    results = [
        save("quiet-loop.wav", quiet_loop(), 0.0794, True),
        save("flight.wav", flight(), 0.1000),
        save("park-loop.wav", park_loop(), 0.0501, True),
    ]
    for name, (signal, level) in effects().items():
        results.append(save(name, signal, level))
    print(json.dumps({"sample_rate": RATE, "assets": results,
                      "total_bytes": sum(row["bytes"] for row in results)}, indent=2))


if __name__ == "__main__":
    main()
