#!/usr/bin/env bash
# Original sound effects, synthesised with ffmpeg. No samples, no licences needed.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=public/sfx
mkdir -p "$OUT"
f() { ffmpeg -y -v error "$@"; }

# Ball thump: a short pitch-dropping sine with a fast decay.
f -f lavfi -i "aevalsrc='0.9*sin(2*PI*(120*t-150*t*t))*exp(-t*25)':s=48000:d=0.25" -af "afade=t=in:d=0.002" "$OUT/thump.wav"
# Pop (element appears): a quick chirp down.
f -f lavfi -i "aevalsrc='0.6*sin(2*PI*(700*t-2500*t*t))*exp(-t*35)':s=48000:d=0.15" -af "afade=t=in:d=0.003" "$OUT/pop.wav"
# Soft pop (small labels).
f -f lavfi -i "aevalsrc='0.35*sin(2*PI*(900*t-3000*t*t))*exp(-t*45)':s=48000:d=0.12" -af "afade=t=in:d=0.003" "$OUT/pop-soft.wav"
# Tick (clock, counter).
f -f lavfi -i "aevalsrc='0.5*sin(2*PI*2000*t)*exp(-t*300)':s=48000:d=0.03" "$OUT/tick.wav"
# Whoosh: pink noise, bell-shaped envelope, band-limited.
f -f lavfi -i "anoisesrc=color=pink:amplitude=0.9:d=0.7:r=48000" -af "volume='exp(-pow((t-0.35)/0.13,2))':eval=frame,highpass=f=250,lowpass=f=4500,afade=t=out:st=0.6:d=0.1" "$OUT/whoosh.wav"
# Long whoosh for zooms and camera moves.
f -f lavfi -i "anoisesrc=color=pink:amplitude=0.8:d=1.4:r=48000" -af "volume='exp(-pow((t-0.8)/0.3,2))':eval=frame,highpass=f=180,lowpass=f=3000,afade=t=out:st=1.3:d=0.1" "$OUT/whoosh-long.wav"
# Net swish: brown and white noise burst with a soft tail.
f -f lavfi -i "anoisesrc=color=white:amplitude=0.5:d=0.6:r=48000" -af "volume='exp(-t*6)':eval=frame,highpass=f=1200,lowpass=f=7000,afade=t=in:d=0.02" "$OUT/net.wav"
# Post clang: two detuned metallic partials.
f -f lavfi -i "aevalsrc='0.4*(sin(2*PI*880*t)+0.6*sin(2*PI*1320.5*t)+0.3*sin(2*PI*2210*t))*exp(-t*6)':s=48000:d=1.2" "$OUT/clang.wav"
# Floodlight on: low clunk plus a rising hum.
f -f lavfi -i "aevalsrc='0.8*sin(2*PI*(90*t-100*t*t))*exp(-t*30)+0.08*sin(2*PI*100*t)*(1-exp(-t*4))*exp(-t*1.2)':s=48000:d=1.5" "$OUT/light-on.wav"
# Floodlight off: clunk and a falling hum.
f -f lavfi -i "aevalsrc='0.8*sin(2*PI*(90*t-100*t*t))*exp(-t*30)+0.08*sin(2*PI*(100-30*t)*t)*exp(-t*2.5)':s=48000:d=1.2" "$OUT/light-off.wav"
# Chalk scratch: filtered noise with a scratchy wobble.
f -f lavfi -i "anoisesrc=color=white:amplitude=0.35:d=0.5:r=48000" -af "volume='0.6+0.4*sin(2*PI*28*t)':eval=frame,bandpass=f=3500:w=2500,afade=t=in:d=0.03,afade=t=out:st=0.4:d=0.1" "$OUT/chalk.wav"
# Stamp (practice board): low thud plus a short noise hit.
f -f lavfi -i "aevalsrc='0.9*sin(2*PI*(70*t-60*t*t))*exp(-t*28)':s=48000:d=0.3" -af "afade=t=in:d=0.002" "$OUT/stamp.wav"
# Comic blip (low, for jokes).
f -f lavfi -i "aevalsrc='0.4*sin(2*PI*(220*t-300*t*t))*exp(-t*12)':s=48000:d=0.35" "$OUT/blip.wav"
# Sub drop into slow motion.
f -f lavfi -i "aevalsrc='0.9*sin(2*PI*(80*t-35*t*t))*exp(-t*2.2)':s=48000:d=1.2" -af "afade=t=in:d=0.01" "$OUT/subdrop.wav"
# Bell (a soft, single note for "Remember that line").
f -f lavfi -i "aevalsrc='0.35*(sin(2*PI*659.25*t)+0.4*sin(2*PI*1318.5*t)+0.15*sin(2*PI*1977.75*t))*exp(-t*2.2)':s=48000:d=2.5" "$OUT/bell.wav"
# Air hiss (under the Air Crowd): soft band-passed noise.
f -f lavfi -i "anoisesrc=color=pink:amplitude=0.25:d=4:r=48000" -af "bandpass=f=1800:w=1500,afade=t=in:d=0.5,afade=t=out:st=3.4:d=0.6" "$OUT/air.wav"

# Car alarm chirp (far away): two quick tones.
f -f lavfi -i "aevalsrc='0.35*sin(2*PI*1250*t)*between(t,0,0.09)+0.35*sin(2*PI*950*t)*between(t,0.12,0.21)':s=48000:d=0.25" -af "lowpass=f=2500,aecho=0.6:0.5:60:0.3" "$OUT/alarm.wav"

ls "$OUT"
