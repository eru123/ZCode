// @vitest-environment jsdom

import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  AssistantTextRow,
  ConversationRow,
  UserInputRow,
} from "@zcode/shared/zcode-protocol-v4";
import {
  buildConversationTurnRenderUnits,
  type ConversationTurnRenderUnit,
} from "@/v4/conversationTurnRenderUnits.js";
import { useShareSelectionRenderUnits } from "@/v4/useShareSelectionRenderUnits.js";

vi.mock("@/v4/conversationTurnRenderUnits.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/v4/conversationTurnRenderUnits.js")>();
  return {
    ...actual,
    buildConversationTurnRenderUnits: vi.fn(actual.buildConversationTurnRenderUnits),
  };
});

const buildSpy = vi.mocked(buildConversationTurnRenderUnits);

function baseRow<T extends ConversationRow>(
  row: Omit<T, "createdAt" | "createdAtSeq" | "rowId" | "turnId"> & {
    rowId: number;
    turnId?: string;
  },
): T {
  return {
    createdAt: 1_700_000_000_000 + row.rowId,
    createdAtSeq: row.rowId,
    turnId: row.turnId ?? "turn-1",
    ...row,
  } as T;
}

function userInput(rowId: number, text: string, turnId: string): UserInputRow {
  return baseRow<UserInputRow>({
    rowId,
    kind: "userInput",
    text,
    origin: "realUser",
    turnId,
  });
}

function assistantText(rowId: number, text: string, turnId: string): AssistantTextRow {
  return baseRow<AssistantTextRow>({
    rowId,
    kind: "assistantText",
    text,
    state: "complete",
    turnId,
  });
}

const firstWindow: readonly ConversationRow[] = [
  userInput(1, "hello", "turn-1"),
  assistantText(2, "hi there", "turn-1"),
];

const secondWindow: readonly ConversationRow[] = [
  ...firstWindow,
  userInput(3, "more", "turn-2"),
  assistantText(4, "streaming reply", "turn-2"),
];

afterEach(() => {
  cleanup();
  buildSpy.mockClear();
});

describe("useShareSelectionRenderUnits", () => {
  it("未激活共享选择时：rows.window 逐帧变更不触发派生，且返回引用稳定的空数组", () => {
    const { result, rerender } = renderHook(
      ({ rows, active }: { rows: readonly ConversationRow[]; active: boolean }) =>
        useShareSelectionRenderUnits(rows, active),
      { initialProps: { rows: firstWindow, active: false } },
    );

    const inactiveUnits = result.current;
    expect(inactiveUnits).toEqual([]);
    expect(buildSpy).not.toHaveBeenCalled();

    // 模拟流式帧：window 引用变化但共享选择仍未激活，派生必须被跳过。
    rerender({ rows: secondWindow, active: false });
    rerender({ rows: [...secondWindow, assistantText(5, "delta", "turn-2")], active: false });

    expect(buildSpy).not.toHaveBeenCalled();
    // 同一空数组身份让下游 shareItems / eligibleShareItems memo 不逐帧重算。
    expect(result.current).toBe(inactiveUnits);
  });

  it("激活共享选择时：按当前 rows.window 重建 units", () => {
    const { result, rerender } = renderHook(
      ({ rows, active }: { rows: readonly ConversationRow[]; active: boolean }) =>
        useShareSelectionRenderUnits(rows, active),
      { initialProps: { rows: firstWindow, active: true } },
    );

    expect(buildSpy).toHaveBeenCalledTimes(1);
    expect(buildSpy).toHaveBeenCalledWith(firstWindow);
    // 两轮对话各含可渲染的助手内容，都应保留为独立 unit。
    expect(result.current.length).toBe(1);

    rerender({ rows: secondWindow, active: true });
    expect(buildSpy).toHaveBeenCalledTimes(2);
    expect(buildSpy).toHaveBeenLastCalledWith(secondWindow);
    expect(result.current.length).toBe(2);
  });

  it("从激活回到未激活：清空派生结果且不额外触发重建", () => {
    const { result, rerender } = renderHook(
      ({ rows, active }: { rows: readonly ConversationRow[]; active: boolean }) =>
        useShareSelectionRenderUnits(rows, active),
      { initialProps: { rows: firstWindow, active: true } },
    );

    expect(result.current.length).toBeGreaterThan(0);

    rerender({ rows: firstWindow, active: false });
    expect(result.current).toEqual([]);
    expect(buildSpy).toHaveBeenCalledTimes(1);

    const units: ConversationTurnRenderUnit[] = result.current;
    rerender({ rows: secondWindow, active: false });
    expect(result.current).toBe(units);
  });
});
