// Episode 2 scene registry for b18-b19 (owned by one builder agent).
import type React from "react";
import { B18 } from "./b18";
import { B19 } from "./b19";

export const REG_B18_B19: Record<string, React.FC> = { b18: B18, b19: B19 };
