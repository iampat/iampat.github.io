// Episode 2 scene registry for b01-b03 (owned by one builder agent).
import type React from "react";
import { B01 } from "./b01";
import { B02 } from "./b02";
import { B03 } from "./b03";

export const REG_B01_B03: Record<string, React.FC> = { b01: B01, b02: B02, b03: B03 };
