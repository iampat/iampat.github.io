// Colours, fonts and sizes. Three original palettes from the style guide
// (research/wf1-result.json -> styleGuide.palettes). No Kurzgesagt colours or fonts.

import { loadFont as loadRubik } from "@remotion/google-fonts/Rubik";
import { loadFont as loadNunito } from "@remotion/google-fonts/Nunito";
import { loadFont as loadSpaceGrotesk } from "@remotion/google-fonts/SpaceGrotesk";
import { loadFont as loadJetBrains } from "@remotion/google-fonts/JetBrainsMono";

export const WIDTH = 1920;
export const HEIGHT = 1080;

export const FONTS = {
  title: loadRubik("normal", { weights: ["700", "800"], subsets: ["latin"] }).fontFamily,
  label: loadNunito("normal", { weights: ["700", "800"], subsets: ["latin"] }).fontFamily,
  hud: loadSpaceGrotesk("normal", { weights: ["500", "700"], subsets: ["latin"] }).fontFamily,
  mono: loadJetBrains("normal", { weights: ["500"], subsets: ["latin"] }).fontFamily,
};

/** Night pitch views. */
export const PITCH = {
  sky: "#151A3D",
  skyHigh: "#0E1230",
  stands: "#232B5C",
  standsLight: "#2E3874",
  grassDark: "#0F5A45",
  grass: "#177A58",
  grassLight: "#1F8E68",
  chalk: "#F4F1E8",
  light: "#FFD166",
  lightSoft: "#FFE9B0",
  accent: "#FF7A3D",
  teal: "#3FE0D0",
};

/** Sky views for full ball flights. */
export const SKY = {
  top: "#1A4FA3",
  mid: "#4A93E6",
  horizon: "#9FD8F5",
  cloud: "#F4FBFF",
  cloudShade: "#C7E3F5",
  sun: "#FFE08A",
  accent: "#FF7A3D",
  sunSoft: "#FFF4D6",
  deep: "#1B2A6B",
};

/** X-ray physics views: slow-motion contact and air flow. */
export const XRAY = {
  bg: "#06202A",
  grid: "#0F3A47",
  tissue: "#2A7F8F",
  bone: "#C9F6FF",
  ball: "#FF7A3D",
  pink: "#FF4FA3",
  air: "#7FB8FF",
  lime: "#B6F24A",
};

/** Characters and shared objects. */
export const CAST = {
  shirt: "#3FE0D0",
  shirtShade: "#27B3A6",
  shorts: "#232B5C",
  skin: "#A0673F",
  skinShade: "#7E4E2F",
  hair: "#232B5C",
  boot: "#F4F1E8",
  bootShade: "#CFC8B8",
  bootLaces: "#E4DECF",
  sock: "#3FE0D0",
  sockShade: "#27B3A6",
  band: "#FF7A3D",
  ball: "#FF7A3D",
  ballShade: "#D95A22",
  ballRim: "#FFB38A",
  ballLine: "#F4F1E8",
  keeper: "#F4F1E8",
  keeperShade: "#D9D3C3",
  keeperEye: "#151A3D",
  mistake: "#FF4FA3",
  fix: "#3FE0D0",
};

export type PaletteName = "Floodlit Pitch" | "Open Sky" | "X-ray Physics" | "Title";

export const BACKGROUND: Record<PaletteName, string> = {
  "Floodlit Pitch": PITCH.sky,
  "Open Sky": SKY.mid,
  "X-ray Physics": XRAY.bg,
  Title: PITCH.skyHigh,
};

/** Pixels per metre in the default side-on pitch view. */
export const PX_PER_M = 60;
