// Episode 2 scene registry for b20-b22 (owned by one builder agent).
import type React from "react";
import { B20 } from "./b20";
import { B21 } from "./b21";
import { B22 } from "./b22";

export const REG_B20_B22: Record<string, React.FC> = { b20: B20, b21: B21, b22: B22 };
