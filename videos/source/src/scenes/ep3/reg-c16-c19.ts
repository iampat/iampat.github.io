// Episode 3 scene registry for c16 and c19 (owned by one builder agent). Add your scenes here.
import type React from "react";
import { C16 } from "./c16";
import { C19 } from "./c19";

export const REG_C16_C19: Record<string, React.FC> = { c16: C16, c19: C19 };
