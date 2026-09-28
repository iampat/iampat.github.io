// Episode 2 scenes: one registry file per builder agent.
import type React from "react";
import { REG_B01_B03 } from "./reg-b01-b03";
import { REG_B04_B05 } from "./reg-b04-b05";
import { REG_B06_B08 } from "./reg-b06-b08";
import { REG_B09_B10 } from "./reg-b09-b10";
import { REG_B11_B12 } from "./reg-b11-b12";
import { REG_B13_B15 } from "./reg-b13-b15";
import { REG_B16_B17 } from "./reg-b16-b17";
import { REG_B18_B19 } from "./reg-b18-b19";
import { REG_B20_B22 } from "./reg-b20-b22";

export const EP2_SCENES: Record<string, React.FC> = { ...REG_B01_B03, ...REG_B04_B05, ...REG_B06_B08, ...REG_B09_B10, ...REG_B11_B12, ...REG_B13_B15, ...REG_B16_B17, ...REG_B18_B19, ...REG_B20_B22 };
