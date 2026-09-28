// Episode 2 scene registry for b06-b08 (owned by one builder agent).
import type React from "react";
import { B06 } from "./b06";
import { B07 } from "./b07";
import { B08 } from "./b08";

export const REG_B06_B08: Record<string, React.FC> = { b06: B06, b07: B07, b08: B08 };
