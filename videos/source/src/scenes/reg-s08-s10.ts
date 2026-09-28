// Scene registry for s08-s10 (owned by one builder agent).
import type React from "react";
import { S08 } from "./s08";
import { S09 } from "./s09";
import { S10 } from "./s10";

export const REG_S08_S10: Record<string, React.FC> = { s08: S08, s09: S09, s10: S10 };
