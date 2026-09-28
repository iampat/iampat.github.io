// Scene registry: storyboard id -> component. Missing ids render a placeholder.
// Each builder agent owns one reg-*.ts file, so scenes can be built in parallel.
import type React from "react";
import { CH_OPEN } from "./ch-open";
import { EP2_SCENES } from "./ep2";
import { REG_S02_S03 } from "./reg-s02-s03";
import { REG_S04_S05 } from "./reg-s04-s05";
import { REG_S06_S07 } from "./reg-s06-s07";
import { REG_S08_S10 } from "./reg-s08-s10";
import { REG_S11_S12 } from "./reg-s11-s12";
import { REG_S13_S15 } from "./reg-s13-s15";
import { REG_S16_S18 } from "./reg-s16-s18";
import { REG_S19_S20 } from "./reg-s19-s20";
import { REG_S21_S23 } from "./reg-s21-s23";

export const SCENES: Record<string, React.FC> = { ...EP2_SCENES, ...CH_OPEN, ...REG_S02_S03, ...REG_S04_S05, ...REG_S06_S07, ...REG_S08_S10, ...REG_S11_S12, ...REG_S13_S15, ...REG_S16_S18, ...REG_S19_S20, ...REG_S21_S23 };
