// Scene registry for s13-s15 (owned by one builder agent).
import type React from "react";
import { S13 } from "./s13";
import { S14 } from "./s14";
import { S15 } from "./s15";

export const REG_S13_S15: Record<string, React.FC> = { s13: S13, s14: S14, s15: S15 };
