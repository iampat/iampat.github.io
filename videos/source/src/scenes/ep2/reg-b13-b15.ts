// Episode 2 scene registry for b13-b15 (owned by one builder agent).
import type React from "react";
import { B13 } from "./b13";
import { B14 } from "./b14";
import { B15 } from "./b15";

export const REG_B13_B15: Record<string, React.FC> = { b13: B13, b14: B14, b15: B15 };
