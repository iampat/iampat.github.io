// Scene registry for s21-s23 (owned by one builder agent).
import type React from "react";
import { S21 } from "./s21";
import { S22 } from "./s22";
import { S23 } from "./s23";

export const REG_S21_S23: Record<string, React.FC> = { s21: S21, s22: S22, s23: S23 };
