// Episode 2 scene registry for b16-b17 (owned by one builder agent).
import type React from "react";
import { B16 } from "./b16";
import { B17 } from "./b17";

export const REG_B16_B17: Record<string, React.FC> = { b16: B16, b17: B17 };
