// Scene registry for s16-s18 (owned by one builder agent).
import type React from "react";
import { S16 } from "./s16";
import { S17 } from "./s17";
import { S18 } from "./s18";

export const REG_S16_S18: Record<string, React.FC> = { s16: S16, s17: S17, s18: S18 };
