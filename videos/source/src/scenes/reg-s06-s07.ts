// Scene registry for s06-s07 (owned by one builder agent).
import type React from "react";
import { S06 } from "./s06";
import { S07 } from "./s07";

export const REG_S06_S07: Record<string, React.FC> = { s06: S06, s07: S07 };
