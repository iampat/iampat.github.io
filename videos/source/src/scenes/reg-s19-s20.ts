// Scene registry for s19-s20 (owned by one builder agent).
import type React from "react";
import { S19 } from "./s19";
import { S20 } from "./s20";

export const REG_S19_S20: Record<string, React.FC> = { s19: S19, s20: S20 };
