"""Build the 10-minute hunting call tracks (MP3) and videos (MP4).

Usage: python3 build.py [track ...]  (needs ffmpeg and numpy; default builds every track)

Each source clip is used at its original level (no gain, compression or
limiting), placed on a 10-minute timeline with silent listening gaps. The video is one still photo
with the track as its audio, so it can be saved to the iPhone photo album.

HME Products clips (hmeproducts.com/sounds-download) sit behind bot protection:
download them in a browser into .cache/ under the names in HME below.
"""
import os, random, subprocess, sys, urllib.request
import numpy as np

SR = 44100
LENGTH = 600  # seconds
HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, ".cache")
USE_HME = True
OUT = os.path.join(HERE, "media")
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

WWH = "https://wideworldofhunting.com/soundsofwhitetail/"
NPS = "https://www.nps.gov/nps-audiovideo/legacy/mp3/imr/avElement/"
SOURCES = {
    # Public domain, U.S. Fish & Wildlife Service (via SoundBible)
    "moose_cow": "https://soundbible.com/grab.php?id=1225&type=wav",
    # Public domain, Yellowstone National Park sound library
    "elk_calf_nps": NPS + "yell-YELLMJ23ElkCalf20051116.mp3",
    "elk_bugle1_nps": NPS + "yell-ElkBugle1.mp3",
    "elk_bugle2_nps": NPS + "yell-ElkBugle2.mp3",
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
HME = {  # .cache name -> HME Products sound library file (Dave Kelso recordings)
    "moose_cow_heat_ready": "Moose/CowInHeatReady1 by Dave Kelso.mp3",
    "moose_cow_heat_long": "Moose/CowinHeatLong1 By Dave Kelso.mp3",
    "moose_cow_come_get_me": "Moose/03-Old Cow Come Get Me Big Boy by Dave Kelso.mp3",
    "moose_bull_grunt": "Moose/BullGruntSingle by Dave Kelso.mp3",
    "moose_bull_challenge": "Moose/07-Old Bull Challenge Call by Dave Kelso.mp3",
    "moose_bull_fight_old": "Moose/08-Old Bull Wants To Fight by Dave Kelso.mp3",
    "moose_bull_fight_young": "Moose/10-Young Bull Wants To Fight by Dave Kelso.mp3",
    "moose_bull_raking": "Moose/05-Bull Raking Bush by Dave Kelso.mp3",
    "moose_bulls_fighting": "Moose/05-Bulls Fighting by Dave Kelso.mp3",
    "elk_cow": "Elk/146-Elk - Cow Adult.mp3",
    "elk_bugle_hme": "Elk/153-Elk Bugle Adult.mp3",
}
PHOTOS = {  # Public domain, USFWS
    "moose": "https://www.fws.gov/sites/default/files/images/2007-09/13581.jpg",
    "deer": "https://www.fws.gov/sites/default/files/images/2014-09/31183.jpg",
    "elk": "https://www.fws.gov/sites/default/files/images/2024-03-1/2011.jpg",
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


_clips = {}


def clip(name):
    """Load a source clip as mono float32 at its original level."""
    if name in _clips:
        return _clips[name]
    if name in HME:
        src = os.path.join(CACHE, name + ".mp3")
    else:
        url = SOURCES[name]
        src = fetch(name, url, ".mp3" if url.endswith(".mp3") else ".wav")
    x = ff(["-i", src], "anull")  # original level, no gain or compression
    f = int(0.01 * SR)
    x[:f] *= np.linspace(0, 1, f)
    x[-f:] *= np.linspace(1, 0, f)
    _clips[name] = x
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


def bouts(r, names, reps=(1, 2), gap=(2, 5), wait=(30, 60)):
    """Random calling bouts from a clip list, with listening waits between them."""
    names = [n for n in names if USE_HME or n not in HME]
    tr = Track()
    while tr.t < LENGTH - 20:
        for _ in range(r.randint(*reps)):
            tr.put(clip(r.choice(names)), r.choice([1.0, 0.9]), r.uniform(*gap))
        tr.wait(r.uniform(*wait))
    return tr.buf


def moose_bull(r):
    """Grunt series, challenge calls, and brush raking: a rival bull looking for a fight."""
    tr = Track()
    calls = ["moose_bull_challenge", "moose_bull_fight_old", "moose_bull_fight_young"]
    fight = clip("moose_bulls_fighting")[: 20 * SR]
    k = 0
    while tr.t < LENGTH - 20:
        for _ in range(r.randint(3, 6)):
            tr.put(clip("moose_bull_grunt"), 1.0, r.uniform(1.0, 2.5))
        tr.put(clip(calls[k % 3]), 1.0, 3)
        tr.put(clip("moose_bull_raking") if k % 2 == 0 else fight, 1.0, 2)
        tr.wait(r.uniform(40, 70))
        k += 1
    return tr.buf


def deer_buck(r):
    """Grunts, snort-wheeze, and antler rattling: two bucks fighting."""
    tr = Track()
    while tr.t < LENGTH - 30:
        for _ in range(3):
            tr.put(clip("buck_grunt"), 1.0, r.uniform(0.6, 1.4))
        tr.put(clip("sniff"), 1.0, 0.4)
        tr.put(clip("wheeze"), 1.0, 1.0)
        tr.put(clip("rattle"), 1.0, 0.5)
        tr.put(clip("rattle")[: 8 * SR], 0.9, 1.0)
        for _ in range(4):
            tr.put(clip("buck_grunt"), 1.0, r.uniform(0.6, 1.4))
        tr.wait(r.uniform(15, 25))
        tr.put(clip("tending"))
        tr.wait(r.uniform(50, 80))
    return tr.buf


def deer_mix(r):
    """Full rut sequence: doe calls, tending grunts and two buck fights."""
    tr = Track()

    def grunts(n):
        for _ in range(n):
            tr.put(clip("buck_grunt"), 1.0, r.uniform(0.6, 1.4))

    def bleats(n):
        for _ in range(n):
            tr.put(clip("estrus_bleat"), 1.0, r.uniform(1.5, 3.5))

    def fight():
        grunts(3)
        tr.put(clip("sniff"), 1.0, 0.4)
        tr.put(clip("wheeze"), 1.0, 1.0)
        tr.put(clip("rattle"), 1.0, 0.5)
        tr.put(clip("rattle")[: 8 * SR], 0.9, 1.0)
        grunts(4)

    plan = [
        lambda: (tr.put(clip("contact"), 1.0, 2), tr.put(clip("doe_grunt"), 1.0, 1), tr.put(clip("doe_grunt"))),
        lambda: bleats(3),
        lambda: tr.put(clip("tending")),
        fight,
        lambda: bleats(2),
        lambda: (tr.put(clip("tending"), 1.0, 3), grunts(2)),
        lambda: (tr.put(clip("bellow"), 1.0, 4), bleats(2)),
        fight,
        lambda: bleats(3),
        lambda: tr.put(clip("tending")),
    ]
    for step, w in zip(plan, [30, 40, 45, 75, 45, 45, 50, 75, 45, 0]):
        step()
        tr.wait(w)
    return tr.buf


# id: (photo, title, subtitle, builder)
TRACKS = {
    "moose-cow": ("moose", "Moose: Cow in Heat", "Female call - brings bulls in",
                  lambda r: bouts(r, ["moose_cow", "moose_cow_heat_ready", "moose_cow_heat_long",
                                      "moose_cow_come_get_me"])),
    "moose-bull": ("moose", "Moose: Bull Challenge", "Male grunts, challenge calls, raking", moose_bull),
    "elk-cow": ("elk", "Elk: Cow and Calf Calls", "Female mews - brings bulls in",
                lambda r: bouts(r, ["elk_cow", "elk_calf_nps"], reps=(1, 3))),
    "elk-bull": ("elk", "Elk: Bull Bugle", "Male bugles - challenge to fight",
                 lambda r: bouts(r, ["elk_bugle1_nps", "elk_bugle2_nps", "elk_bugle_hme"], wait=(40, 70))),
    "deer-doe": ("deer", "Whitetail: Doe Estrus Bleats", "Female calls - brings bucks in",
                 lambda r: bouts(r, ["estrus_bleat", "estrus_bleat", "bellow", "doe_grunt", "contact"],
                                 reps=(2, 4), gap=(1.5, 3.5))),
    "deer-buck": ("deer", "Whitetail: Buck Fight", "Grunts, snort-wheeze, rattling", deer_buck),
    "deer-mix": ("deer", "Whitetail: Full Rut Mix", "Doe calls, grunts and two fights", deer_mix),
}


def build(tid):
    photo_key, title, sub, fn = TRACKS[tid]
    buf = np.clip(fn(random.Random(7)), -1.0, 1.0)
    os.makedirs(OUT, exist_ok=True)
    mp3 = os.path.join(OUT, tid + ".mp3")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-",
                    "-c:a", "libmp3lame", "-b:a", "192k", "-metadata", "title=" + title, mp3],
                   input=buf.tobytes(), check=True)
    photo = fetch(photo_key + "_photo", PHOTOS[photo_key], ".jpg")
    vf = ("scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,setsar=1,"
          "drawbox=y=560:w=1280:h=160:color=black@0.55:t=fill,"
          f"drawtext=fontfile={FONT}:text='{title}':x=40:y=585:fontsize=46:fontcolor=white,"
          f"drawtext=fontfile={FONT}:text='{sub} - 10 min':x=40:y=645:fontsize=26:fontcolor=white@0.85,"
          "format=yuv420p")
    still = os.path.join(CACHE, tid + "_frame.png")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", photo, "-vf", vf, "-frames:v", "1", still], check=True)
    mp4 = os.path.join(OUT, tid + ".mp4")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-loop", "1", "-framerate", "1", "-i", still, "-i", mp3,
                    "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-tune", "stillimage", "-preset", "veryfast",
                    "-pix_fmt", "yuv420p", "-r", "1", "-c:a", "aac", "-b:a", "192k", "-shortest",
                    "-movflags", "+faststart", mp4], check=True)
    print("wrote", tid)


if __name__ == "__main__":
    ids = [a for a in sys.argv[1:] if a != "--hme"] or list(TRACKS)
    for tid in ids:
        if tid == "moose-bull" and not USE_HME:
            continue  # only HME bull recordings available
        build(tid)
