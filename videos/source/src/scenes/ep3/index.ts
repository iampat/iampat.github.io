// Episode 3 scenes, merged from one registry per builder (each builder edits only its own file).
import type React from "react";
import { REG_C01_C03 } from "./reg-c01-c03";
import { REG_C04_C07 } from "./reg-c04-c07";
import { REG_C08_C11 } from "./reg-c08-c11";
import { REG_C12_C15 } from "./reg-c12-c15";
import { REG_C16_C19 } from "./reg-c16-c19";
import { REG_C17_C20 } from "./reg-c17-c20";

export const EP3_SCENES: Record<string, React.FC> = { ...REG_C01_C03, ...REG_C04_C07, ...REG_C08_C11, ...REG_C12_C15, ...REG_C16_C19, ...REG_C17_C20 };
