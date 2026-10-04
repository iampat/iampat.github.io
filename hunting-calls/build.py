"""Build one video (MP4) and MP3 per hunting call recording.

Usage: python3 build.py [call ...]  (needs ffmpeg; default builds every call)

Each video is one still photo with a single recording as its audio, played
once, so it can be saved to the iPhone photo album. restore.py repairs
clipping, removes hiss and evens out the level (see there).

HME Products clips (hmeproducts.com/sounds-download) sit behind bot protection:
download them in a browser into .cache/ under the names in HME below.
"""
import os, subprocess, sys, urllib.request

import restore

SR = restore.SR

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, ".cache")
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
    "bellow": WWH + "nonagressive/bellow170kb.wav",
    "doe_grunt": WWH + "nonagressive/doegrunt17kb.wav",
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
    "elk_grunt": "Elk/159-Elk Grunt.mp3",
    "elk_bellow": "Elk/148-Elk Bellows 1 ORION.mp3",
    "deer_estrus_bleat_heavy": "Deer/138-Doe Estrus Bleat Heavy.mp3",
    "deer_doe_bleats": "Deer/136-Doe Bleats.mp3",
    "deer_doe_in_heat": "Deer/DoeInHeat by Dave Kelso.mp3",
    "deer_tending_grunt": "Deer/026-Buck Tending Grunt.mp3",
    "deer_buck_grunt_big": "Deer/BuckGruntBig By Dave Kelso.mp3",
    "deer_buck_dominant_grunt": "Deer/015-Buck Dominant Grunt.mp3",
    "deer_snort_wheeze": "Deer/023-Buck Snort Wheeze.mp3",
    "deer_buck_snort": "Deer/021-Buck Snort.mp3",
    "deer_bucks_fighting": "Deer/028-Bucks Fighting.mp3",
    "deer_bucks_sparring": "Deer/030-Bucks Sparring.mp3",
    "deer_buck_challenge": "Deer/BuckChallenge by Dave Kelso.mp3",
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


# id: (source, photo, title, subtitle)
CALLS = {
    "moose-cow-usfws": ("moose_cow", "moose", "Moose: Cow Call", "Female - cow in heat (USFWS)"),
    "moose-cow-ready": ("moose_cow_heat_ready", "moose", "Moose: Cow in Heat, Ready", "Female - brings bulls in"),
    "moose-cow-long": ("moose_cow_heat_long", "moose", "Moose: Cow in Heat, Long", "Female - brings bulls in"),
    "moose-cow-come-get-me": ("moose_cow_come_get_me", "moose", "Moose: Old Cow, Come Get Me", "Female - brings bulls in"),
    "moose-bull-grunt": ("moose_bull_grunt", "moose", "Moose: Bull Grunt", "Male - single grunt"),
    "moose-bull-challenge": ("moose_bull_challenge", "moose", "Moose: Old Bull Challenge", "Male - calls bulls to fight"),
    "moose-bull-fight-old": ("moose_bull_fight_old", "moose", "Moose: Old Bull Wants to Fight", "Male - calls bulls to fight"),
    "moose-bull-fight-young": ("moose_bull_fight_young", "moose", "Moose: Young Bull Wants to Fight", "Male - calls bulls to fight"),
    "moose-bull-raking": ("moose_bull_raking", "moose", "Moose: Bull Raking Brush", "Male - antlers on brush"),
    "moose-bulls-fighting": ("moose_bulls_fighting", "moose", "Moose: Bulls Fighting", "Two bulls fighting"),
    "elk-cow": ("elk_cow", "elk", "Elk: Cow Call", "Female - brings bulls in"),
    "elk-calf": ("elk_calf_nps", "elk", "Elk: Calf Mews", "Calf - brings cows and bulls in"),
    "elk-bugle-1": ("elk_bugle1_nps", "elk", "Elk: Bull Bugle 1", "Male - challenge (Yellowstone)"),
    "elk-bugle-2": ("elk_bugle2_nps", "elk", "Elk: Bull Bugle 2", "Male - challenge (Yellowstone)"),
    "elk-bugle-3": ("elk_bugle_hme", "elk", "Elk: Bull Bugle 3", "Male - challenge"),
    "elk-grunt": ("elk_grunt", "elk", "Elk: Bull Grunt", "Male - after the bugle"),
    "elk-bellow": ("elk_bellow", "elk", "Elk: Bull Bellow", "Male - challenge"),
    "deer-estrus-bleat": ("deer_estrus_bleat_heavy", "deer", "Whitetail: Doe Estrus Bleat", "Female - brings bucks in"),
    "deer-doe-bleats": ("deer_doe_bleats", "deer", "Whitetail: Doe Bleats", "Female - brings bucks in"),
    "deer-doe-in-heat": ("deer_doe_in_heat", "deer", "Whitetail: Doe in Heat", "Female - brings bucks in"),
    "deer-breeding-bellow": ("bellow", "deer", "Whitetail: Doe Breeding Bellow", "Female - ready to breed"),
    "deer-doe-grunt": ("doe_grunt", "deer", "Whitetail: Doe Grunt", "Female - come here"),
    "deer-buck-grunt": ("deer_buck_grunt_big", "deer", "Whitetail: Buck Grunt", "Male - big buck"),
    "deer-buck-dominant-grunt": ("deer_buck_dominant_grunt", "deer", "Whitetail: Buck Dominant Grunt", "Male - claims the area"),
    "deer-tending-grunt": ("deer_tending_grunt", "deer", "Whitetail: Buck Tending Grunt", "Male - trailing a doe"),
    "deer-buck-challenge": ("deer_buck_challenge", "deer", "Whitetail: Buck Challenge", "Male - calls bucks to fight"),
    "deer-snort": ("deer_buck_snort", "deer", "Whitetail: Buck Snort", "Male - intimidation"),
    "deer-snort-wheeze": ("deer_snort_wheeze", "deer", "Whitetail: Snort-Wheeze", "Male - calls bucks to fight"),
    "deer-sparring": ("deer_bucks_sparring", "deer", "Whitetail: Bucks Sparring", "Two bucks, light antler contact"),
    "deer-fighting": ("deer_bucks_fighting", "deer", "Whitetail: Bucks Fighting", "Two bucks fighting"),
    "deer-rattling": ("rattle", "deer", "Whitetail: Antler Rattling", "Two bucks fighting"),
}


def source(name):
    if name in HME:
        return os.path.join(CACHE, name + ".mp3")
    url = SOURCES[name]
    return fetch(name, url, ".mp3" if url.endswith(".mp3") else ".wav")


def build(cid):
    src_name, photo_key, title, sub = CALLS[cid]
    x = restore.run(["-i", source(src_name)], "anull")
    if len(x) > 60 * SR:  # electronic-caller loops: keep one call
        x = restore.single_call(x, join_s=3.0)
    x = restore.restore(x)
    os.makedirs(OUT, exist_ok=True)
    wav = os.path.join(CACHE, cid + ".wav")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-", wav],
                   input=x.tobytes(), check=True)
    mp3 = os.path.join(OUT, cid + ".mp3")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", wav, "-c:a", "libmp3lame", "-b:a", "192k",
                    "-metadata", "title=" + title, mp3], check=True)
    photo = fetch(photo_key + "_photo", PHOTOS[photo_key], ".jpg")
    vf = ("scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,setsar=1,"
          "drawbox=y=560:w=1280:h=160:color=black@0.55:t=fill,"
          f"drawtext=fontfile={FONT}:text='{title}':x=40:y=585:fontsize=46:fontcolor=white,"
          f"drawtext=fontfile={FONT}:text='{sub}':x=40:y=645:fontsize=26:fontcolor=white@0.85,"
          "format=yuv420p")
    still = os.path.join(CACHE, cid + "_frame.png")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", photo, "-vf", vf, "-frames:v", "1", still], check=True)
    # Pad one second of silence so very short calls still make a playable video
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-loop", "1", "-framerate", "5", "-i", still, "-i", wav,
                    "-map", "0:v", "-map", "1:a", "-af", "apad=pad_dur=1", "-c:v", "libx264", "-tune", "stillimage",
                    "-preset", "veryfast", "-pix_fmt", "yuv420p", "-r", "5", "-c:a", "aac", "-b:a", "192k",
                    "-shortest", "-movflags", "+faststart", os.path.join(OUT, cid + ".mp4")], check=True)
    print("wrote", cid)


if __name__ == "__main__":
    for cid in sys.argv[1:] or CALLS:
        build(cid)
