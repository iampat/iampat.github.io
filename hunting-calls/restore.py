"""Clean up a call recording: repair clipping, remove hiss, even out the level.

restore(src) -> float32 mono 44.1 kHz array. Levels are matched gently: the
call is brought to about -15 dBFS RMS, with at most 4 dB of limiting, so the
original dynamics stay intact and nothing saturates.
"""
import subprocess
import numpy as np

SR = 44100


def run(inp, af, data=None):
    out = subprocess.run(["ffmpeg", "-v", "error", *inp, "-af", af, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         input=data, capture_output=True, check=True).stdout
    return np.frombuffer(out, np.float32).copy()


def levels(x):
    """(call level, noise floor) in dBFS from 50 ms RMS frames."""
    blk = SR // 20
    fr = x[: len(x) // blk * blk].reshape(-1, blk)
    db = 20 * np.log10(np.sqrt((fr ** 2).mean(1)) + 1e-9)
    return np.percentile(db, 95), np.percentile(db, 10)


def restore(src, target=-15.0):
    x = src if isinstance(src, np.ndarray) else run(["-i", src], "anull")
    call, floor = levels(x)
    snr = call - floor
    # Hiss removal: stronger when the recording is noisier. nf must stay in [-80, -20].
    nr = 20 if snr < 15 else 12 if snr < 30 else 6
    nf = float(np.clip(floor - 3, -80, -20))
    x = run(["-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-"],
            f"adeclip,highpass=f=70,afftdn=nr={nr}:nf={nf:.0f}:tn=1", x.tobytes())
    # Level: aim for the target, but never ask the limiter for more than 4 dB.
    call, _ = levels(x)
    peak = 20 * np.log10(np.abs(x).max() + 1e-9)
    gain_db = min(target - call, (-1.0 - peak) + 4.0)
    x = run(["-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-"],
            f"volume={gain_db:.2f}dB,alimiter=limit=0.89:attack=2:release=60:level=false", x.tobytes())
    f = SR // 100
    x[:f] *= np.linspace(0, 1, f)
    x[-f:] *= np.linspace(1, 0, f)
    return x


def single_call(x, max_s=30.0, pad_s=0.4, join_s=1.5):
    """Cut one call (the first bout of sound) out of a recording that repeats."""
    blk = SR // 20
    fr = x[: len(x) // blk * blk].reshape(-1, blk)
    db = 20 * np.log10(np.sqrt((fr ** 2).mean(1)) + 1e-9)
    on = db > np.percentile(db, 10) + 15
    idx = np.flatnonzero(on)
    if len(idx) == 0:
        return x[: int(max_s * SR)]
    start = idx[0]
    end = start
    for i in idx:
        if (i - end) * blk / SR > join_s or (i - start) * blk / SR > max_s:
            break
        end = i
    a = max(0, int(start * blk - pad_s * SR))
    b = min(len(x), int((end + 1) * blk + pad_s * SR))
    y = x[a:b].copy()
    f = SR // 100
    y[:f] *= np.linspace(0, 1, f)
    y[-f:] *= np.linspace(1, 0, f)
    return y
