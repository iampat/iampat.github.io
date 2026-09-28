// Episode 2 scene registry for b04-b05 (owned by one builder agent).
import type React from "react";
import { B04 } from "./b04";
import { B05 } from "./b05";

export const REG_B04_B05: Record<string, React.FC> = { b04: B04, b05: B05 };
