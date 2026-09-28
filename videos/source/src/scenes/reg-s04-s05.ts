// Scene registry for s04-s05 (owned by one builder agent).
import type React from "react";
import { S04 } from "./s04";
import { S05 } from "./s05";

export const REG_S04_S05: Record<string, React.FC> = { s04: S04, s05: S05 };
