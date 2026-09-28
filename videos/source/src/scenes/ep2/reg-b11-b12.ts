// Episode 2 scene registry for b11-b12 (owned by one builder agent).
import type React from "react";
import { B11 } from "./b11";
import { B12 } from "./b12";

export const REG_B11_B12: Record<string, React.FC> = { b11: B11, b12: B12 };
