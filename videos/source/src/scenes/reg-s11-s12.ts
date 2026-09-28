// Scene registry for s11-s12 (owned by one builder agent).
import type React from "react";
import { S11 } from "./s11";
import { S12 } from "./s12";

export const REG_S11_S12: Record<string, React.FC> = { s11: S11, s12: S12 };
