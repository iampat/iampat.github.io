"""Build the 10-minute hunting call tracks (MP3) and videos (MP4).

Usage: python3 build.py moose|deer  (needs ffmpeg and numpy; downloads the source clips)

Each source clip is compressed and limited so the calls play loud on a phone
speaker (about -10 to -14 dBFS RMS while calling, peaks at -1 dBFS), then placed on a
10-minute timeline with silent listening gaps.
"""
import os, random, subprocess, sys, urllib.request
import numpy as np

SR = 44100
LENGTH = 600  # seconds
HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, ".cache")
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

WWH = "https://wideworldofhunting.com/soundsofwhitetail/"
SOURCES = {
    # Public domain, U.S. Fish & Wildlife Service (via SoundBible)
    "moose_cow": "https://soundbible.com/grab.php?id=1225&type=wav",
    # Deerdope / Wide World of Hunting whitetail recordings
    "buck_grunt": WWH + "nonagressive/bkgrunt12kb.wav",
    "tending": WWH + "nonagressive/tending369kb.wav",
    "estrus_bleat": WWH + "nonagressive/estrusbleat41kb.wav",
    "bellow": WWH + "nonagressive/bellow170kb.wav",
    "contact": WWH + "nonagressive/contact45kb.wav",
    "doe_grunt": WWH + "nonagressive/doegrunt17kb.wav",
    "sniff": WWH + "agressive/sniff26kb.wav",
    "wheeze": WWH + "agressive/wheeze56kb.wav",
    "rattle": WWH + "agressive/rattle324kb.wav",
}
PHOTOS = {  # Public domain, USFWS
    "moose": "https://www.fws.gov/sites/default/files/images/2007-09/13581.jpg",
    "deer": "https://www.fws.gov/sites/default/files/images/2014-09/31183.jpg",
}


def fetch(name, url, ext):
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, name + ext)
    if not os.path.exists(path):
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req) as r, open(path, "wb") as f:
            f.write(r.read())
    return path


def ff(inp, af, data=None):
    out = subprocess.run(["ffmpeg", "-v", "error", *inp, "-af", af, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         input=data, capture_output=True, check=True).stdout
    return np.frombuffer(out, np.float32).copy()


def clip(name):
    """Load a source clip as loud, limited mono float32."""
    src = fetch(name, SOURCES[name], ".wav")
    af = "highpass=f=90,acompressor=threshold=-24dB:ratio=6:attack=3:release=80:makeup=6dB"
    x = ff(["-i", src], af)
    # Gain the voiced part to -10 dBFS RMS and limit peaks to -1 dBFS (repeat: the limiter eats some gain)
    blk = int(0.02 * SR)
    for _ in range(3):
        frames = x[: len(x) // blk * blk].reshape(-1, blk)
        rms = np.sqrt((frames ** 2).mean(axis=1))
        voiced = frames[rms > rms.max() * 0.1]
        gain = min(4.0, 10 ** (-10 / 20) / np.sqrt((voiced ** 2).mean()))
        x = ff(["-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-"],
               f"volume={gain:.3f},alimiter=limit=0.89:attack=1:release=50:level=false", x.tobytes())
    x = np.clip(x, -0.89, 0.89)
    f = int(0.01 * SR)
    x[:f] *= np.linspace(0, 1, f)
    x[-f:] *= np.linspace(1, 0, f)
    return x


class Track:
    def __init__(self):
        self.buf = np.zeros(LENGTH * SR, np.float32)
        self.t = 2.0

    def put(self, x, gain=1.0, gap=0.0):
        i = int(self.t * SR)
        n = min(len(x), len(self.buf) - i)
        if n > 0:
            self.buf[i:i + n] += x[:n] * gain
        self.t += len(x) / SR + gap

    def wait(self, s):
        self.t += s


def moose(r):
    cow = clip("moose_cow")
    tr = Track()
    while tr.t < LENGTH - 20:
        tr.put(cow, r.choice([1.0, 0.9]), r.uniform(2, 5))
        if r.random() < 0.35:
            tr.put(cow, 0.9)
        tr.wait(r.uniform(30, 60))
    return tr.buf


def deer(r):
    c = {k: clip(k) for k in SOURCES if k != "moose_cow"}
    tr = Track()

    def grunts(n, g=1.0):
        for _ in range(n):
            tr.put(c["buck_grunt"], g, r.uniform(0.6, 1.4))

    def bleats(n):
        for _ in range(n):
            tr.put(c["estrus_bleat"], 1.0, r.uniform(1.5, 3.5))

    def fight():  # grunts, snort-wheeze, rattling, winner's grunts
        grunts(3)
        tr.put(c["sniff"], 1.0, 0.4)
        tr.put(c["wheeze"], 1.0, 1.0)
        tr.put(c["rattle"], 1.0, 0.5)
        tr.put(c["rattle"][: 8 * SR], 0.9, 1.0)
        grunts(4)

    # Calm open, build to a fight, quiet listening, repeat
    plan = [
        lambda: (tr.put(c["contact"], 1.0, 2), tr.put(c["doe_grunt"], 1.0, 1), tr.put(c["doe_grunt"])),
        lambda: bleats(3),
        lambda: tr.put(c["tending"]),
        fight,
        lambda: bleats(2),
        lambda: (tr.put(c["tending"], 1.0, 3), grunts(2)),
        lambda: (tr.put(c["bellow"], 1.0, 4), bleats(2)),
        fight,
        lambda: bleats(3),
        lambda: tr.put(c["tending"]),
    ]
    waits = [30, 40, 45, 75, 45, 45, 50, 75, 45, 0]
    for step, w in zip(plan, waits):
        step()
        tr.wait(w)
        if tr.t > LENGTH - 10:
            break
    return tr.buf


TITLES = {"moose": ("Cow Moose Call", "Rut calling sequence - 10 min"),
          "deer": ("Whitetail Rut Calls", "Grunts, bleats and rattling - 10 min")}


def main(kind):
    buf = {"moose": moose, "deer": deer}[kind](random.Random(7))
    buf = np.clip(buf, -0.89, 0.89)
    raw = os.path.join(CACHE, kind + ".f32")
    buf.tofile(raw)
    out = os.path.join(HERE, kind)
    os.makedirs(out, exist_ok=True)
    mp3 = os.path.join(out, kind + "-call-10min.mp3")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", raw,
                    "-c:a", "libmp3lame", "-b:a", "128k", "-metadata", "title=" + TITLES[kind][0], mp3], check=True)

    photo = os.path.join(CACHE, kind + "_720.jpg")  # scale once, not per frame
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", fetch(kind + "_photo", PHOTOS[kind], ".jpg"), "-vf",
                    "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720", photo], check=True)
    title, sub = TITLES[kind]
    vf = (f"[0:v]setsar=1,"
          f"drawbox=y=560:w=1280:h=160:color=black@0.55:t=fill,"
          f"drawtext=fontfile={FONT}:text='{title}':x=40:y=585:fontsize=46:fontcolor=white,"
          f"drawtext=fontfile={FONT}:text='{sub}':x=40:y=645:fontsize=26:fontcolor=white@0.85[bg];"
          f"[1:a]showwaves=s=1280x120:mode=cline:rate=10:colors=white@0.8,format=rgba[w];"
          f"[bg][w]overlay=0:440:format=auto,format=yuv420p[v]")
    mp4 = os.path.join(out, kind + "-call-10min.mp4")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-loop", "1", "-framerate", "10", "-i", photo, "-i", mp3,
                    "-filter_complex", vf, "-map", "[v]", "-map", "1:a", "-c:v", "libx264", "-preset", "veryfast",
                    "-crf", "30", "-r", "10", "-c:a", "aac", "-b:a", "160k", "-shortest",
                    "-movflags", "+faststart", mp4], check=True)
    print("wrote", mp3, mp4)


if __name__ == "__main__":
    main(sys.argv[1])
