// Episode 2 scene registry for b09-b10 (owned by one builder agent).
import type React from "react";
import { B09 } from "./b09";
import { B10 } from "./b10";

export const REG_B09_B10: Record<string, React.FC> = { b09: B09, b10: B10 };
